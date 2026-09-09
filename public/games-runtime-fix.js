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

    document.querySelectorAll('.avatar-inner, #pageHeaderAvatar').forEach(el => {
      if (el.dataset.myfaOwnAvatar === preferred) return;
      el.style.backgroundImage = `url(\"${preferred.replace(/\"/g, '%22')}\")`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
      el.dataset.myfaOwnAvatar = preferred;
    });

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

  const startAvatarFix = () => {
    setOwnAvatar();
    const observer = new MutationObserver(() => setOwnAvatar());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', () => setOwnAvatar(), { once: true });
    setInterval(setOwnAvatar, 15000);
  };

  // -------------------------------------------------------------------------
  // TURBO INTERNAL MINIAPP NAVIGATION
  // -------------------------------------------------------------------------
  // The real lag is inside index.html's Home/Tasks/Games/Leaderboard/Wallet
  // navigation. The old runtime inserted a visible loading shell and then
  // ran the renderer. That makes every first tab feel slow.
  //
  // This patch:
  //   1. Removes the previous visible loading-shell wrappers.
  //   2. Keeps each internal page mounted after its first render.
  //   3. Pre-renders the heavy pages in the background after the user loads.
  //   4. Switches between already-rendered containers synchronously.
  //   5. Gives an unready page one animation frame to paint before rendering.
  // -------------------------------------------------------------------------
  const rendererNames = [
    'renderHome', 'renderSettings', 'renderAds', 'renderWithdraw',
    'renderTasks', 'renderReferrals', 'renderLeaderboard', 'renderGames'
  ];

  // Undo the earlier myfa-runtime-fixes wrappers. They created a visible
  // loading shell before calling the real renderer and are the source of the
  // exact "Loading…" delay the user does not want.
  rendererNames.forEach(name => {
    const fn = window[name];
    if (fn && fn.__myfaOriginal) window[name] = fn.__myfaOriginal;
  });

  const baseNav = window.nav;
  if (typeof baseNav === 'function' && !baseNav.__myfaTurboNav) {
    const pages = ['home','tasks','games','leaderboard','withdraw','referrals','ads','settings'];
    const rendererFor = {
      home: 'renderHome',
      tasks: 'renderTasks',
      games: 'renderGames',
      leaderboard: 'renderLeaderboard',
      withdraw: 'renderWithdraw',
      referrals: 'renderReferrals',
      ads: 'renderAds',
      settings: 'renderSettings'
    };
    const rendered = window.renderedPages = window.renderedPages || {};
    const ready = window.__myfaTurboPages = window.__myfaTurboPages || {};
    const pending = window.__myfaTurboPending = window.__myfaTurboPending || {};

    const showPageInstant = (page) => {
      const target = document.getElementById(`page-${page}`);
      if (!target) return false;

      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      const item = document.querySelector(`.nav-item[data-page="${page}"]`);
      if (item) item.classList.add('active');

      document.querySelectorAll('.page-container').forEach(el => {
        if (el === target) {
          el.style.display = 'block';
          el.style.opacity = '1';
          el.style.visibility = 'visible';
          el.style.transform = 'none';
          el.style.pointerEvents = 'auto';
        } else {
          el.style.display = 'none';
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          el.style.pointerEvents = 'none';
        }
      });

      const gameWrapper = document.getElementById('gameCanvasWrapper');
      const main = document.getElementById('mainContent');
      const header = document.getElementById('pageHeader');
      if (gameWrapper) gameWrapper.style.display = 'none';
      if (main) main.style.display = 'block';
      if (header) header.style.display = 'flex';
      const footer = document.getElementById('leaderboardFooter');
      if (footer && page !== 'leaderboard') footer.style.display = 'none';

      return true;
    };

    const runRendererHidden = (page) => {
      const fnName = rendererFor[page];
      const container = document.getElementById(`page-${page}`);
      const fn = window[fnName];
      if (!container || typeof fn !== 'function') return Promise.resolve();
      if (rendered[page]) {
        ready[page] = true;
        return Promise.resolve();
      }
      if (pending[page]) return pending[page];

      rendered[page] = true;
      container.style.display = 'none';
      container.style.visibility = 'hidden';

      let result;
      try { result = fn(container); }
      catch (e) {
        rendered[page] = false;
        return Promise.reject(e);
      }

      pending[page] = Promise.resolve(result)
        .then(() => { ready[page] = true; return true; })
        .catch(err => {
          rendered[page] = false;
          ready[page] = false;
          console.error(`[MYFA turbo ${page}]`, err);
          return false;
        })
        .finally(() => { delete pending[page]; });
      return pending[page];
    };

    const turboNav = function(page) {
      page = String(page || 'home');
      const target = document.getElementById(`page-${page}`);
      if (!target) return baseNav(page);

      // Already rendered: true instant tab switch, no renderer/network work.
      if (rendered[page] && ready[page] !== false) {
        showPageInstant(page);
        return;
      }

      // Prefer our pre-rendered background page. If it is still pending, keep
      // the target switch lightweight and let the render finish off-screen.
      if (pending[page]) {
        showPageInstant(page);
        pending[page].then(() => {
          if (window.__myfaTurboActivePage === page) showPageInstant(page);
        });
        window.__myfaTurboActivePage = page;
        return;
      }

      showPageInstant(page);
      window.__myfaTurboActivePage = page;
      requestAnimationFrame(() => {
        runRendererHidden(page).then(() => {
          if (window.__myfaTurboActivePage === page) showPageInstant(page);
        });
      });
    };
    turboNav.__myfaTurboNav = true;
    turboNav.__myfaOriginal = baseNav;
    window.nav = turboNav;

    const preloadAll = async () => {
      // Tasks first because it is the heaviest/most commonly used internal tab.
      if (window.currentUser || (typeof currentUser !== 'undefined' && currentUser)) {
        await runRendererHidden('tasks');
      }
      // Pre-render the other internal tabs during idle time, one-by-one, so
      // background preparation does not block the initial home experience.
      const rest = ['games','leaderboard','withdraw','referrals','ads','settings'];
      for (const page of rest) {
        if ('requestIdleCallback' in window) {
          await new Promise(resolve => requestIdleCallback(resolve, { timeout: 1500 }));
        } else {
          await new Promise(resolve => setTimeout(resolve, 60));
        }
        await runRendererHidden(page);
      }
    };

    const startPreload = () => {
      // Wait for the inline app bootstrap to finish loading currentUser.
      let attempts = 0;
      const timer = setInterval(() => {
        attempts++;
        const userReady = !!(window.currentUser || (typeof currentUser !== 'undefined' && currentUser));
        if (userReady) {
          clearInterval(timer);
          setTimeout(() => preloadAll().catch(() => {}), 120);
        } else if (attempts > 60) {
          clearInterval(timer);
        }
      }, 250);
    };
    startPreload();
  }

  // Start avatar fixing after the navigation override is installed.
  const init = () => startAvatarFix();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
