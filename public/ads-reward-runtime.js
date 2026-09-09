(() => {
  'use strict';
  const getTelegramUser = () => window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  const getUserId = () => String(getTelegramUser()?.id || new URLSearchParams(location.search).get('userId') || '');
  window.MYFA_TELEGRAM_USER_ID = getUserId();

  const withUserQuery = (url, key='userId') => {
    try {
      const u = new URL(url, location.origin);
      if (!u.searchParams.get(key)) u.searchParams.set(key, getUserId());
      return u.pathname + (u.search ? u.search : '') + (u.hash || '');
    } catch { return url; }
  };

  const originalFetch = window.fetch.bind(window);
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
      if (/\/api\/(myfa-ads\/get|ads\/eligible)/.test(url)) {
        url = withUserQuery(url, 'userId');
      } else if (/\/api\/adsgram-reward/.test(url)) {
        url = withUserQuery(url, 'userid');
      }

      if (/\/api\/(watch-ad|myfa-ads\/claim)/.test(url) && init.body) {
        try {
          const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;
          if (body) {
            body.userId = body.userId || id;
            if (/watch-ad/.test(url)) body.network = body.network || 'monetag';
            init = { ...init, body: JSON.stringify(body) };
          }
        } catch {}
      }
    }

    return originalFetch(url, { ...init, headers });
  };

  const guardProviderButton = name => {
    const fn = window[name];
    if (typeof fn !== 'function' || fn.__myfaIdentityGuard) return false;
    const wrapped = async function(...args) {
      const id = getUserId();
      if (!id) {
        const message = 'Open MYFA BIRR inside Telegram so your account can receive the reward.';
        if (typeof window.showToast === 'function') window.showToast(message, 'error');
        else console.warn(message);
        return;
      }
      window.MYFA_TELEGRAM_USER_ID = id;
      return fn.apply(this, args);
    };
    wrapped.__myfaIdentityGuard = true;
    window[name] = wrapped;
    return true;
  };

  const installGuards = () => {
    const names = ['watchMonetagAd','triggerAdsterra'];
    return names.every(name => guardProviderButton(name));
  };

  document.addEventListener('DOMContentLoaded', () => {
    window.MYFA_TELEGRAM_USER_ID = getUserId();
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (installGuards() || attempts >= 30) clearInterval(timer);
    }, 300);
  });
})();
