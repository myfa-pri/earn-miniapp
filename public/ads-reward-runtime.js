(() => {
  'use strict';

  const getTelegramUser = () => window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  const getUserId = () => String(getTelegramUser()?.id || new URLSearchParams(location.search).get('userId') || '');
  const originalFetch = window.fetch.bind(window);
  const pending = new Map();
  const MONETAG_ZONE = '11759807';
  let monetagSdkPromise = null;
  let monetagInAppConfigured = false;
  let monetagOfferObserver = null;

  window.MYFA_TELEGRAM_USER_ID = getUserId();

  const withUserQuery = (url, key='userId') => {
    try {
      const u = new URL(url, location.origin);
      const id = getUserId();
      if (id && !u.searchParams.get(key)) u.searchParams.set(key, id);
      return u.pathname + (u.search ? u.search : '') + (u.hash || '');
    } catch { return url; }
  };

  const startProviderSession = async network => {
    const id = getUserId();
    if (!id) throw new Error('Open MYFA BIRR inside Telegram so your account can receive the reward.');
    const r = await originalFetch(`/api/ads?action=start`, {
      method:'POST',
      headers:{'Content-Type':'application/json','X-Telegram-User-ID':id},
      body:JSON.stringify({userId:id,network})
    });
    const d = await r.json().catch(()=>({}));
    if (!r.ok || !d.success || !d.token) throw new Error(d.error || `${network} ad is not available right now`);
    const session = { token:d.token, userId:id, network, startedAt:Date.now() };
    pending.set(network, session);
    window.MYFA_AD_SESSION = session;
    return session;
  };

  const finishProviderSession = async (network, providerResult) => {
    const session = pending.get(network);
    if (!session) return null;
    pending.delete(network);
    const safeResult = providerResult && typeof providerResult === 'object'
      ? {...providerResult,network}
      : {value:providerResult,network};
    try {
      return await originalFetch(`/api/ads?action=complete`, {
        method:'POST',
        headers:{'Content-Type':'application/json','X-Telegram-User-ID':session.userId},
        body:JSON.stringify({token:session.token,providerResult:safeResult})
      });
    } finally {
      if (window.MYFA_AD_SESSION?.token === session.token) window.MYFA_AD_SESSION = null;
    }
  };

  window.fetch = async (input, init={}) => {
    let url = typeof input === 'string' ? input : input?.url || '';
    const headers = new Headers(init.headers || {});
    const id = getUserId();
    if (id) {
      window.MYFA_TELEGRAM_USER_ID = id;
      headers.set('X-Telegram-User-ID', id);
    }

    const isApi = /\/api\//.test(url);
    if (isApi) {
      if (/\/api\/(myfa-ads\/get|ads\/eligible)/.test(url)) url = withUserQuery(url, 'userId');
      else if (/\/api\/adsgram-reward/.test(url)) url = withUserQuery(url, 'userid');

      if (/\/api\/watch-ad/.test(url) && init.body) {
        try {
          const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
          const network = String(body?.network || 'monetag');
          const session = pending.get(network);
          if (session) {
            return finishProviderSession(network, {done:true, providerCallback:'sdk-resolved'});
          }
          if (body) {
            body.userId = body.userId || id;
            body.network = network;
            init = {...init,body:JSON.stringify(body)};
          }
        } catch {}
      }

      if (/\/api\/adsterra-reward/.test(url) && init.body) {
        const session = pending.get('adsterra');
        if (session) {
          return finishProviderSession('adsterra', {visited:true,providerCallback:'sdk-return'});
        }
      }
    }

    return originalFetch(url, {...init,headers});
  };

  const showError = message => {
    if (typeof window.showToast === 'function') window.showToast(message,'error');
    else console.warn(message);
  };

  // ------------------------------------------------------------
  // Monetag zone 11759807: load early and keep ready for all uses.
  // ------------------------------------------------------------
  const removeOldMonetagTag = () => {
    document.querySelectorAll('script[data-sdk="show_41731"],script[data-zone="41731"]').forEach(script => script.remove());
  };

  const ensureMonetagSdk = () => {
    if (typeof window.show_11759807 === 'function') return Promise.resolve(window.show_11759807);
    if (monetagSdkPromise) return monetagSdkPromise;

    monetagSdkPromise = new Promise((resolve,reject) => {
      removeOldMonetagTag();
      let settled = false;
      const finish = (err) => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timeout);
        if (err) reject(err); else resolve(window.show_11759807);
      };
      const poll = setInterval(() => {
        if (typeof window.show_11759807 === 'function') finish();
      }, 50);
      const timeout = setTimeout(() => {
        finish(new Error('Monetag ad is not available right now.'));
      }, 12000);

      const existing = document.querySelector('script[data-sdk="show_11759807"][data-zone="11759807"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = '//libtl.com/sdk.js';
        script.dataset.zone = MONETAG_ZONE;
        script.dataset.sdk = `show_${MONETAG_ZONE}`;
        script.async = true;
        script.onload = () => { if (typeof window.show_11759807 === 'function') finish(); };
        script.onerror = () => finish(new Error('Unable to load Monetag ads.'));
        (document.head || document.documentElement).appendChild(script);
      }
    }).catch(err => {
      monetagSdkPromise = null;
      throw err;
    });

    return monetagSdkPromise;
  };

  // Start the exact replacement SDK immediately. No user click is needed.
  removeOldMonetagTag();
  ensureMonetagSdk().then(() => configureMonetagInApp()).catch(() => {});

  const refreshCurrentUser = async id => {
    try {
      const res = await originalFetch(`/api/user/${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const updated = await res.json();
      if (updated && typeof updated === 'object') {
        try { window.currentUser = updated; } catch {}
        if (typeof window.updateUI === 'function') window.updateUI();
      }
    } catch {}
  };

  const getDailyAdsWatched = () => {
    try { return Number(window.currentUser?.dailyAdsWatched || (typeof currentUser !== 'undefined' && currentUser?.dailyAdsWatched) || 0); }
    catch { return 0; }
  };

  const clearMonetagSession = network => {
    pending.delete(network);
    window.MYFA_AD_SESSION = null;
  };

  const runMonetagReward = async format => {
    const id = getUserId();
    if (!id) {
      showError('Open MYFA BIRR inside Telegram so your account can receive the reward.');
      return false;
    }
    if (getDailyAdsWatched() >= 10) {
      showError('Daily ad limit reached. Come back tomorrow.');
      return false;
    }

    try {
      await ensureMonetagSdk();
      await startProviderSession('monetag');

      let providerResult;
      if (format === 'popup') providerResult = await window.show_11759807('pop');
      else providerResult = await window.show_11759807();

      const response = await finishProviderSession('monetag', {
        done:true,
        providerCallback:'monetag-sdk',
        format:format === 'popup' ? 'rewarded-popup' : 'rewarded-interstitial',
        providerResult: providerResult && typeof providerResult === 'object' ? providerResult : String(providerResult ?? '')
      });
      const data = await response?.json?.().catch?.(() => ({}));
      if (!response || !response.ok || !data?.success) {
        throw new Error(data?.error || 'Reward could not be credited.');
      }

      await refreshCurrentUser(id);
      if (typeof window.showToast === 'function') window.showToast(`+${Number(data.reward || 0)} Gems`, 'success');
      return true;
    } catch (e) {
      clearMonetagSession('monetag');
      showError(e?.message || 'Monetag ad could not be completed.');
      return false;
    }
  };

  const installMonetagRewardFunctions = () => {
    const rewarded = async function() { return runMonetagReward('interstitial'); };
    rewarded.__myfaIdentityGuard = true;
    rewarded.__myfaMonetag11759807 = true;
    window.watchMonetagAd = rewarded;
    window.triggerMonetagAd = rewarded;

    // Preserve compatibility for any old code that explicitly calls this name.
    const existing = window.triggerAdsterra;
    if (typeof existing === 'function' && !existing.__myfaIdentityGuard) {
      // Leave Adsterra behavior intact; Monetag replaces only Monetag calls.
    }
  };

  // ------------------------------------------------------------
  // In-app interstitial: automatic, non-rewarded exposure using
  // the exact settings supplied by the user.
  // ------------------------------------------------------------
  function configureMonetagInApp() {
    if (monetagInAppConfigured || typeof window.show_11759807 !== 'function') return;
    monetagInAppConfigured = true;
    try {
      window.show_11759807({
        type:'inApp',
        inAppSettings:{
          frequency:2,
          capping:0.1,
          interval:30,
          timeout:5,
          everyPage:false
        }
      });
    } catch (e) {
      monetagInAppConfigured = false;
      console.warn('Monetag in-app interstitial setup failed', e);
    }
  }

  // ------------------------------------------------------------
  // Permanent Official Tasks offer.
  // It is not a banner. Clicking it launches the Monetag rewarded
  // popup directly and credits the user only after completion.
  // ------------------------------------------------------------
  const officialTasksActive = () => {
    const tab = document.getElementById('tabOfficial');
    if (!tab) return true;
    return tab.classList.contains('active') || !document.getElementById('tabSponsor')?.classList.contains('active');
  };

  const syncOfferVisibility = card => {
    if (!card) return;
    card.style.display = officialTasksActive() ? 'flex' : 'none';
  };

  const ensurePermanentOfferTask = () => {
    const page = document.getElementById('page-tasks');
    if (!page) return;

    let card = document.getElementById('myfa-monetag-offer-task');
    if (!card) {
      card = document.createElement('div');
      card.id = 'myfa-monetag-offer-task';
      card.className = 'ad-card';
      card.style.cssText = [
        'display:flex','align-items:center','justify-content:space-between','gap:14px',
        'margin:14px 0 90px','padding:16px','border-radius:18px',
        'border:1px solid rgba(0,242,254,.28)',
        'background:linear-gradient(135deg,rgba(0,242,254,.10),rgba(176,38,255,.13))',
        'box-shadow:0 8px 28px rgba(0,0,0,.18)','cursor:pointer','user-select:none'
      ].join(';');
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;min-width:0;">
          <div style="width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:rgba(0,242,254,.14);font-size:1.35rem;color:#00F2FE;flex:0 0 auto;"><i class="fa-solid fa-bolt"></i></div>
          <div style="min-width:0;">
            <div style="font-weight:900;color:white;font-size:1rem;">Earn with a Quick Offer</div>
            <div style="font-size:.78rem;color:#94A3B8;margin-top:3px;">Tap to open a rewarded offer and earn Gems.</div>
          </div>
        </div>
        <div style="flex:0 0 auto;padding:9px 13px;border-radius:999px;background:linear-gradient(90deg,#00F2FE,#B026FF);color:white;font-weight:900;font-size:.78rem;">Open Offer</div>
      `;
      card.addEventListener('click', () => runMonetagReward('popup'));

      const watchCard = [...page.querySelectorAll('.ad-card')].find(el => {
        const onclick = String(el.getAttribute('onclick') || '');
        const text = String(el.textContent || '');
        return /triggerMonetagAd|watchMonetagAd/.test(onclick) || /Watch Ad/i.test(text);
      });
      if (watchCard && watchCard.parentNode) watchCard.insertAdjacentElement('afterend', card);
      else page.appendChild(card);
    }

    syncOfferVisibility(card);
  };

  const startPermanentOfferWatcher = () => {
    const boot = () => {
      ensurePermanentOfferTask();
      const page = document.getElementById('page-tasks');
      if (!page || monetagOfferObserver) return;
      monetagOfferObserver = new MutationObserver(() => ensurePermanentOfferTask());
      monetagOfferObserver.observe(page, {childList:true,subtree:true});
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
    else boot();
    setInterval(() => ensurePermanentOfferTask(), 2000);
  };

  const install = () => {
    // Never use the old 41731 Monetag wrapper after this point.
    installMonetagRewardFunctions();
    // Keep legacy Adsterra session protection intact.
    const adsterra = window.triggerAdsterra;
    if (typeof adsterra === 'function' && !adsterra.__myfaIdentityGuard) {
      const wrapped = wrapProvider('triggerAdsterra','adsterra');
      void wrapped;
    }
    configureMonetagInApp();
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.MYFA_TELEGRAM_USER_ID = getUserId();
    install();
    startPermanentOfferWatcher();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      install();
      if (attempts >= 10) clearInterval(timer);
    }, 500);
  });
})();
