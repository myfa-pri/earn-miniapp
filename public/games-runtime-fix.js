(() => {
  'use strict';

  // Scratch and Pro Spin reference globalData directly from the main inline game code.
  // Restore it as a real shared global and hydrate it from the public config endpoint.
  var globalData = window.globalData = window.globalData || { config: {} };
  if (!globalData.config || typeof globalData.config !== 'object') globalData.config = {};

  const mergeConfig = (data) => {
    if (!data || typeof data !== 'object') return;
    globalData = window.globalData = {
      ...globalData,
      ...data,
      config: { ...(globalData.config || {}), ...(data.config || data) }
    };
  };

  fetch('/api/config', { credentials: 'same-origin', cache: 'no-store' })
    .then(r => r.ok ? r.json() : {})
    .then(mergeConfig)
    .catch(() => {});

  // -------------------------------------------------------------------------
  // Real Telegram profile avatar for the current Mini App user.
  // Telegram exposes the current user's photo_url to Mini Apps when allowed
  // by the user's privacy settings. MYFA also has a same-origin Bot API proxy
  // at /api/avatar/:userId, so the avatar still works when photo_url is absent.
  // -------------------------------------------------------------------------
  const telegramUser = () => window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  const currentUserId = () => String(
    telegramUser()?.id || new URLSearchParams(location.search).get('userId') || ''
  );
  const telegramPhoto = () => String(telegramUser()?.photo_url || '');
  const avatarProxy = () => {
    const id = currentUserId();
    return id ? `/api/avatar/${encodeURIComponent(id)}?v=live` : '';
  };

  const setOwnAvatar = () => {
    const id = currentUserId();
    if (!id) return;

    const direct = telegramPhoto();
    const proxy = avatarProxy();
    const preferred = direct || proxy;
    if (!preferred) return;

    // Main home profile avatar(s).
    document.querySelectorAll('.avatar-inner, #pageHeaderAvatar').forEach(el => {
      if (el.dataset.myfaOwnAvatar === preferred) return;
      el.style.backgroundImage = `url("${preferred.replace(/"/g, '%22')}")`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
      el.dataset.myfaOwnAvatar = preferred;
    });

    // First-open / other real image avatars.
    document.querySelectorAll('img.fop-avatar, img.lb-avatar').forEach(img => {
      if (img.dataset.myfaOwnAvatar !== preferred) {
        img.src = preferred;
        img.dataset.myfaOwnAvatar = preferred;
      }
      if (proxy) {
        img.onerror = () => {
          if (img.src !== proxy) {
            img.onerror = null;
            img.src = proxy;
            img.dataset.myfaOwnAvatar = proxy;
          }
        };
      }
    });

    // The home leaderboard/profile podium uses .premium-avatar. Only replace
    // the rank-1 image when the current Telegram user is actually rank 1, so
    // ranks 2/3 and other users keep their own real pictures.
    const ownRank = Number(
      window.currentUser?.rank ||
      (typeof currentUser !== 'undefined' ? currentUser?.rank : 0) ||
      0
    );
    if (ownRank === 1) {
      document.querySelectorAll('img.premium-avatar.rank-1').forEach(img => {
        if (img.dataset.myfaOwnAvatar !== preferred) {
          img.src = preferred;
          img.dataset.myfaOwnAvatar = preferred;
        }
        if (proxy) {
          img.onerror = () => {
            if (img.src !== proxy) {
              img.onerror = null;
              img.src = proxy;
              img.dataset.myfaOwnAvatar = proxy;
            }
          };
        }
      });
    }
  };

  // Apply before and after the page containers are rendered.
  const startAvatarFix = () => {
    setOwnAvatar();
    const observer = new MutationObserver(() => setOwnAvatar());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', () => setOwnAvatar(), { once: true });
    setInterval(setOwnAvatar, 15000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAvatarFix, { once: true });
  } else {
    startAvatarFix();
  }
})();
