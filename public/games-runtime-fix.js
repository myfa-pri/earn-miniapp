(() => {
  'use strict';

  // Scratch and Pro Spin reference globalData directly from the main inline game code.
  // Hydrate the shared config without blocking the main miniapp.
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

  const setAvatar = (el, url) => {
    if (!el || !url) return;
    if (el.tagName === 'IMG') el.src = url;
    else el.style.backgroundImage = `url(\"${url.replace(/\"/g, '%22')}\")`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';
    el.dataset.myfaOwnAvatar = url;
  };

  const setOwnAvatar = () => {
    const id = currentUserId();
    if (!id) return;
    const direct = telegramPhoto();
    const proxy = avatarProxy();
    const preferred = direct || proxy;
    if (!preferred) return;

    document.querySelectorAll('.avatar-inner, #pageHeaderAvatar').forEach(el => setAvatar(el, preferred));

    document.querySelectorAll('img.fop-avatar, img.lb-avatar').forEach(img => {
      setAvatar(img, preferred);
      if (proxy) {
        img.onerror = () => {
          if (img.src !== proxy) {
            img.onerror = null;
            setAvatar(img, proxy);
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
        setAvatar(img, preferred);
        if (proxy) {
          img.onerror = () => {
            if (img.src !== proxy) {
              img.onerror = null;
              setAvatar(img, proxy);
            }
          };
        }
      });
    }
  };

  // -------------------------------------------------------------------------
  // TURBO INTERNAL MINIAPP NAVIGATION
  // IMPORTANT: this is installed on DOMContentLoaded so it runs AFTER the
  // deferred /myfa-runtime-fixes.js. That prevents the old loading-shell
  // wrapper from being installed over this navigation system again.
  // -------------------------------------------------------------------------
  const installTurboNavigation = () => {
    const rendererNames = [
      'renderHome', 'renderSettings', 'renderAds', 'renderWithdraw',
      'renderTasks', 'renderReferrals', 'renderLeaderboard', 'renderGames'
    ];

    // Remove any earlier renderer wrappers and keep the real renderers.
    rendererNames.forEach(name => {
      const fn = window[name];
      if (fn && fn.__myfaOriginal) window[name] = fn.__myfaOriginal;
    });

    const cleanRenderers = {};
    rendererNames.forEach(name => {
      if (typeof window[name] === 'function') cleanRenderers[name] = window[name];
    });

    const existingNav = window.nav;
    const baseNav = existingNav && existingNav.__myfaOriginal ? existingNav.__myfaOriginal : existingNav;
    if (typeof baseNav !== 'function') return;
    if (baseNav.__myfaTurboInstalled) return;

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
    const pending = window.__myfaTurboPending = window.__myfaTurboPending || {};
    window.__myfaTurboActivePage = window.__myfaTurboActivePage || 'home';

    // Kill the extra 150ms opacity/transform wait for internal tabs.
    if (!document.getElementById('myfaTurboNavigationCss')) {
      const style = document.createElement('style');
      style.id = 'myfaTurboNavigationCss';
      style.textContent = `
        .page-container { transition: none !important; animation: none !important; }
        .page-container { contain: layout style paint; }
      `;
      document.head.appendChild(style);
    }

    const showPageInstant = (page) => {
      const target = document.getElementById(`page-${page}`);
      if (!target) return false;

      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
      if (navItem) navItem.classList.add('active');

      document.querySelectorAll('.page-container').forEach(el => {
        const active = el === target;
        el.style.display = active ? 'block' : 'none';
        el.style.opacity = active ? '1' : '0';
        el.style.visibility = active ? 'visible' : 'hidden';
        el.style.pointerEvents = active ? 'auto' : 'none';
        el.style.transform = 'none';
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

    const taskShell = (container) => {
      if (!container || container.children.length) return;
      container.innerHTML = `
        <h2 style="margin-bottom:20px"><i class="fa-solid fa-list-check" style="color:var(--brand-blue)"></i> Earn Gems</h2>
        <div style="display:flex;gap:10px;margin-bottom:15px">
          <button class="btn quantum-btn" style="flex:1;padding:15px;border-radius:15px" onclick="watchMonetagAd()"><i class="fa-solid fa-play"></i> Watch Ad<br><small style="font-size:.7rem;opacity:.8">Monetag</small></button>
          <button class="btn quantum-btn" style="flex:1;padding:15px;border-radius:15px" onclick="triggerAdsterra()"><i class="fa-solid fa-star"></i> Premium Ad<br><small style="font-size:.7rem;opacity:.8">Adsterra</small></button>
        </div>
        <div class="card cyber-card" style="margin-bottom:20px;padding:20px;text-align:center;background:linear-gradient(135deg,rgba(255,215,0,.1),rgba(255,140,0,.1));border:1px solid rgba(255,215,0,.4);cursor:pointer" onclick="openMyfaAd()">
          <i class="fa-solid fa-bullhorn" style="font-size:2.5rem;color:#FFD700;margin-bottom:10px"></i>
          <h3 style="color:white;font-size:1.4rem">Myfa Ads</h3>
          <p style="color:#94A3B8;font-size:.9rem;margin:0">Sponsored ads</p>
        </div>`;
    };

    const simpleShell = (title, icon) => (container) => {
      if (!container || container.children.length) return;
      container.innerHTML = `<div style="padding:18px 4px"><h2 style="margin:0;display:flex;align-items:center;gap:10px"><i class="fa-solid ${icon}" style="color:var(--color-cyan)"></i>${title}</h2></div>`;
    };

    const shellFor = {
      home: simpleShell('Home', 'fa-house'),
      games: simpleShell('Games', 'fa-gamepad'),
      leaderboard: simpleShell('Leaderboard', 'fa-trophy'),
      withdraw: simpleShell('Wallet', 'fa-wallet'),
      referrals: simpleShell('Invite & Earn', 'fa-user-group'),
      ads: simpleShell('Ads', 'fa-rectangle-ad'),
      settings: simpleShell('Settings', 'fa-gear'),
      tasks: taskShell
    };

    const renderPage = (page) => {
      if (rendered[page]) return Promise.resolve(true);
      if (pending[page]) return pending[page];
      const fn = cleanRenderers[rendererFor[page]];
      const container = document.getElementById(`page-${page}`);
      if (!fn || !container) return Promise.resolve(false);

      pending[page] = new Promise(resolve => {
        try { shellFor[page]?.(container); } catch (e) {}
        container.style.visibility = 'hidden';
        container.style.display = 'none';
        requestAnimationFrame(async () => {
          try {
            await Promise.resolve(fn(container));
            rendered[page] = true;
            resolve(true);
          } catch (e) {
            console.error(`[MYFA turbo ${page}]`, e);
            resolve(false);
          } finally {
            delete pending[page];
          }
        });
      });
      return pending[page];
    };

    const turboNav = function(page) {
      page = String(page || 'home');
      window.__myfaTurboActivePage = page;

      // Already built = pure DOM switch, no network and no renderer.
      if (rendered[page]) {
        showPageInstant(page);
        setOwnAvatar();
        return;
      }

      // The page is being warmed in the background. Show the destination now;
      // it will be painted with its real content the moment the renderer ends.
      if (pending[page]) {
        showPageInstant(page);
        pending[page].then(() => {
          if (window.__myfaTurboActivePage === page) showPageInstant(page);
        });
        return;
      }

      showPageInstant(page);
      renderPage(page).then(() => {
        if (window.__myfaTurboActivePage === page) showPageInstant(page);
        setOwnAvatar();
      });
    };

    turboNav.__myfaTurboInstalled = true;
    turboNav.__myfaOriginal = baseNav;
    window.nav = turboNav;

    // Prefetch live JSON so Tasks/Leaderboard do not pay the network round-trip
    // again when their real renderer runs.
    const originalFetch = window.fetch.bind(window);
    const jsonCache = new Map();
    const normalizeUrl = value => {
      try {
        return new URL(String(value?.url || value), location.href).pathname + new URL(String(value?.url || value), location.href).search;
      } catch (e) { return String(value || ''); }
    };
    const cacheJson = (url) => {
      if (jsonCache.has(url)) return jsonCache.get(url);
      const p = originalFetch(url, { credentials: 'same-origin', cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);
      jsonCache.set(url, p);
      return p;
    };

    // Tasks are the main laggy internal page: start warming their data now.
    cacheJson('/api/tasks');

    window.fetch = function(input, init) {
      const method = String(init?.method || input?.method || 'GET').toUpperCase();
      const key = normalizeUrl(input);
      if (method === 'GET' && jsonCache.has(key)) {
        return jsonCache.get(key).then(data => {
          if (data == null) return originalFetch(input, init);
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        });
      }
      return originalFetch(input, init);
    };

    const warm = async () => {
      // Wait until the bootstrap has a real user, then warm Tasks first.
      let tries = 0;
      while (!(window.currentUser || (typeof currentUser !== 'undefined' && currentUser)) && tries++ < 80) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!(window.currentUser || (typeof currentUser !== 'undefined' && currentUser))) return;

      const id = String(window.currentUser?.id || (typeof userId !== 'undefined' ? userId : '') || currentUserId());
      if (id) cacheJson(`/api/leaderboard/${encodeURIComponent(id)}`);

      // Tasks is first priority.
      renderPage('tasks').catch(() => {});

      const rest = ['games', 'leaderboard', 'withdraw', 'referrals', 'ads', 'settings'];
      for (const page of rest) {
        await new Promise(resolve => {
          if ('requestIdleCallback' in window) requestIdleCallback(resolve, { timeout: 1200 });
          else setTimeout(resolve, 60);
        });
        renderPage(page).catch(() => {});
      }
    };

    setTimeout(() => warm().catch(() => {}), 80);
    setOwnAvatar();
  };

  // DOMContentLoaded fires after deferred myfa-runtime-fixes.js, so our clean
  // renderers/nav are the final versions used by the app.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installTurboNavigation, { once: true });
  } else {
    setTimeout(installTurboNavigation, 0);
  }

  // Keep avatars correct after any internal page re-render.
  const startAvatarObserver = () => {
    setOwnAvatar();
    const observer = new MutationObserver(() => setOwnAvatar());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', () => setOwnAvatar(), { once: true });
    setInterval(setOwnAvatar, 15000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startAvatarObserver, { once: true });
  else startAvatarObserver();
})();
