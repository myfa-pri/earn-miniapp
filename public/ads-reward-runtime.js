(() => {
  'use strict';
  const getTelegramUser = () => window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  const getUserId = () => String(getTelegramUser()?.id || new URLSearchParams(location.search).get('userId') || '');
  const originalFetch = window.fetch.bind(window);
  const pending = new Map();

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
    try {
      return await originalFetch(`/api/ads?action=complete`, {
        method:'POST',
        headers:{'Content-Type':'application/json','X-Telegram-User-ID':session.userId},
        body:JSON.stringify({token:session.token,providerResult:{...providerResult,network}})
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

  const wrapProvider = (name, network) => {
    const fn = window[name];
    if (typeof fn !== 'function' || fn.__myfaIdentityGuard) return false;
    const wrapped = async function(...args) {
      const id = getUserId();
      if (!id) {
        showError('Open MYFA BIRR inside Telegram so your account can receive the reward.');
        return;
      }
      try {
        await startProviderSession(network);
        return await fn.apply(this,args);
      } catch (e) {
        pending.delete(network);
        window.MYFA_AD_SESSION = null;
        showError(e.message || `${network} ad could not be started.`);
      }
    };
    wrapped.__myfaIdentityGuard = true;
    wrapped.__myfaOriginal = fn;
    window[name] = wrapped;
    return true;
  };

  const install = () => {
    wrapProvider('watchMonetagAd','monetag');
    wrapProvider('triggerAdsterra','adsterra');
    return true;
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.MYFA_TELEGRAM_USER_ID = getUserId();
    install();
    let attempts = 0;
    const timer = setInterval(() => { attempts += 1; install(); if (attempts >= 30) clearInterval(timer); }, 300);
  });
})();
