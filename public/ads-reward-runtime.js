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
  let premiumUiObserver = null;

  window.MYFA_TELEGRAM_USER_ID = getUserId();

  const withUserQuery = (url, key = 'userId') => {
    try {
      const u = new URL(url, location.origin);
      const id = getUserId();
      if (id && !u.searchParams.get(key)) u.searchParams.set(key, id);
      return u.pathname + (u.search ? u.search : '') + (u.hash || '');
    } catch {
      return url;
    }
  };

  const startProviderSession = async network => {
    const id = getUserId();
    if (!id) throw new Error('Open MYFA BIRR inside Telegram so your account can receive the reward.');
    const r = await originalFetch('/api/ads?action=start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-User-ID': id },
      body: JSON.stringify({ userId: id, network })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.success || !d.token) throw new Error(d.error || `${network} ad is not available right now`);
    const session = { token: d.token, userId: id, network, startedAt: Date.now() };
    pending.set(network, session);
    window.MYFA_AD_SESSION = session;
    return session;
  };

  const finishProviderSession = async (network, providerResult) => {
    const session = pending.get(network);
    if (!session) return null;
    pending.delete(network);
    const safeResult = providerResult && typeof providerResult === 'object'
      ? { ...providerResult, network }
      : { value: providerResult, network };
    try {
      return await originalFetch('/api/ads?action=complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-User-ID': session.userId },
        body: JSON.stringify({ token: session.token, providerResult: safeResult })
      });
    } finally {
      if (window.MYFA_AD_SESSION?.token === session.token) window.MYFA_AD_SESSION = null;
    }
  };

  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : input?.url || '';
    const headers = new Headers(init.headers || {});
    const id = getUserId();
    if (id) {
      window.MYFA_TELEGRAM_USER_ID = id;
      headers.set('X-Telegram-User-ID', id);
    }

    if (/\/api\//.test(url)) {
      if (/\/api\/(myfa-ads\/get|ads\/eligible)/.test(url)) url = withUserQuery(url, 'userId');
      else if (/\/api\/adsgram-reward/.test(url)) url = withUserQuery(url, 'userid');

      if (/\/api\/watch-ad/.test(url) && init.body) {
        try {
          const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
          const network = String(body?.network || 'monetag');
          const session = pending.get(network);
          if (session) return finishProviderSession(network, { done: true, providerCallback: 'sdk-resolved' });
          if (body) {
            body.userId = body.userId || id;
            body.network = network;
            init = { ...init, body: JSON.stringify(body) };
          }
        } catch {}
      }
      if (/\/api\/adsterra-reward/.test(url)) {
        // Premium Ads are disabled in the Mini App UI. Preserve the API request shape only.
      }
    }

    return originalFetch(url, { ...init, headers });
  };

  const showError = message => {
    if (typeof window.showToast === 'function') window.showToast(message, 'error');
    else console.warn(message);
  };

  const removeOldMonetagTag = () => {
    document.querySelectorAll('script[data-sdk="show_41731"],script[data-zone="41731"]').forEach(script => script.remove());
  };

  const ensureMonetagSdk = () => {
    if (typeof window.show_11759807 === 'function') return Promise.resolve(window.show_11759807);
    if (monetagSdkPromise) return monetagSdkPromise;

    monetagSdkPromise = new Promise((resolve, reject) => {
      removeOldMonetagTag();
      let settled = false;
      const finish = err => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(timeout);
        if (err) reject(err); else resolve(window.show_11759807);
      };
      const poll = setInterval(() => {
        if (typeof window.show_11759807 === 'function') finish();
      }, 50);
      const timeout = setTimeout(() => finish(new Error('Monetag ad is not available right now.')), 12000);

      const existing = document.querySelector('script[data-sdk="show_11759807"][data-zone="11759807"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = '//libtl.com/sdk.js';
        script.dataset.zone = MONETAG_ZONE;
        script.dataset.sdk = `show_${MONETAG_ZONE}`;
        script.async = true;
        script.onload = () => {
          if (typeof window.show_11759807 === 'function') finish();
        };
        script.onerror = () => finish(new Error('Unable to load Monetag ads.'));
        (document.head || document.documentElement).appendChild(script);
      }
    }).catch(err => {
      monetagSdkPromise = null;
      throw err;
    });

    return monetagSdkPromise;
  };

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
    try {
      return Number(window.currentUser?.dailyAdsWatched || (typeof currentUser !== 'undefined' && currentUser?.dailyAdsWatched) || 0);
    } catch {
      return 0;
    }
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
      const providerResult = format === 'popup'
        ? await window.show_11759807('pop')
        : await window.show_11759807();

      const response = await finishProviderSession('monetag', {
        done: true,
        providerCallback: 'monetag-sdk',
        format: format === 'popup' ? 'rewarded-popup' : 'rewarded-interstitial',
        providerResult: providerResult && typeof providerResult === 'object'
          ? providerResult
          : String(providerResult ?? '')
      });
      const data = await response?.json?.().catch?.(() => ({}));
      if (!response || !response.ok || !data?.success) {
        throw new Error(data?.error || 'Reward could not be credited.');
      }
      await refreshCurrentUser(id);
      if (typeof window.showToast === 'function') {
        window.showToast(`+${Number(data.reward || 0)} Gems`, 'success');
      }
      return true;
    } catch (e) {
      clearMonetagSession('monetag');
      showError(e?.message || 'Monetag ad could not be completed.');
      return false;
    }
  };

  const installMonetagRewardFunctions = () => {
    const rewarded = async function () {
      return runMonetagReward('interstitial');
    };
    rewarded.__myfaIdentityGuard = true;
    rewarded.__myfaMonetag11759807 = true;
    window.watchMonetagAd = rewarded;
    window.triggerMonetagAd = rewarded;
  };

  // Deliberately NO Monetag initialization here.
  // Ads are loaded only after an explicit user action (watch/open offer).
  const configureMonetagInApp = () => {};

  const officialTasksActive = () => {
    const tab = document.getElementById('tabOfficial');
    if (!tab) return true;
    return tab.classList.contains('active') || !document.getElementById('tabSponsor')?.classList.contains('active');
  };

  const hidePremiumAds = () => {
    const selectors = [
      '[data-provider="adsterra"]', '[data-network="adsterra"]',
      '.adsterra-ad', '.premium-ad', '.premium-ads',
      '#premium-ad', '#premium-ads', '[id*="adsterra" i]', '[class*="adsterra" i]'
    ];
    document.querySelectorAll(selectors.join(',')).forEach(el => el.style.setProperty('display', 'none', 'important'));

    const textNodes = document.querySelectorAll('button,a,[role="button"],.ad-card,.task-card,.task-item,.ad-banner,.ad-slot,.ad-container');
    for (const el of textNodes) {
      const text = String(el.textContent || '').trim();
      if (text.length <= 160 && /premium\s*ads?|premium\s*ad|adsterra/i.test(text)) {
        el.style.setProperty('display', 'none', 'important');
      }
    }

    if (typeof window.triggerAdsterraAd === 'function') {
      window.triggerAdsterraAd = () => showError('Premium Ads are disabled.');
    }
    if (typeof window.triggerAdsterra === 'function') {
      window.triggerAdsterra = () => showError('Premium Ads are disabled.');
    }
  };

  const syncOfferVisibility = card => {
    if (!card) return;
    card.style.display = officialTasksActive() ? 'flex' : 'none';
  };

  const ensurePermanentOfferTask = () => {
    hidePremiumAds();
    const page = document.getElementById('page-tasks');
    if (!page) return;

    let card = document.getElementById('myfa-monetag-offer-task');
    if (!card) {
      card = document.createElement('div');
      card.id = 'myfa-monetag-offer-task';
      card.className = 'ad-card';
      card.style.cssText = [
        'display:flex','align-items:center','justify-content:space-between','width:100%',
        'max-width:100%','box-sizing:border-box','min-width:0','height:58px','min-height:58px',
        'margin:10px 0 14px','padding:9px 10px','border-radius:15px',
        'border:1px solid rgba(0,242,254,.26)',
        'background:linear-gradient(135deg,rgba(0,242,254,.08),rgba(176,38,255,.10))',
        'box-shadow:0 5px 16px rgba(0,0,0,.14)','cursor:pointer','user-select:none','overflow:hidden'
      ].join(';');
      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:9px;min-width:0;flex:1 1 auto;overflow:hidden;">
          <div style="width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:rgba(0,242,254,.12);font-size:1rem;color:#00F2FE;flex:0 0 38px;"><i class="fa-solid fa-bolt"></i></div>
          <div style="min-width:0;overflow:hidden;">
            <div style="font-weight:900;color:white;font-size:.88rem;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Quick Offer</div>
            <div style="font-size:.68rem;color:#94A3B8;margin-top:3px;line-height:1;">Reward</div>
          </div>
        </div>
        <div style="flex:0 0 auto;padding:8px 11px;border-radius:10px;background:linear-gradient(90deg,#00F2FE,#B026FF);color:white;font-weight:900;font-size:.7rem;line-height:1;white-space:nowrap;">Open Offer</div>
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
      hidePremiumAds();
      const page = document.getElementById('page-tasks');
      if (page && !monetagOfferObserver) {
        monetagOfferObserver = new MutationObserver(() => ensurePermanentOfferTask());
        monetagOfferObserver.observe(page, { childList: true, subtree: true });
      }
      if (!premiumUiObserver) {
        premiumUiObserver = new MutationObserver(() => hidePremiumAds());
        premiumUiObserver.observe(document.body, { childList: true, subtree: true });
      }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();
  };

  // Remove any legacy auto-ad script tag, but never load a new ad SDK during startup.
  removeOldMonetagTag();

  const install = () => {
    installMonetagRewardFunctions();
    hidePremiumAds();
    startPermanentOfferWatcher();
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.MYFA_TELEGRAM_USER_ID = getUserId();
    install();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      install();
      if (attempts >= 10) clearInterval(timer);
    }, 500);
  });
})();
