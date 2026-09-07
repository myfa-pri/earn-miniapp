(function () {
  'use strict';
  const app = document.getElementById('ongoing-app');
  if (!app) return;
  const screens = Array.from(document.querySelectorAll('.screen'));
  const params = new URLSearchParams(window.location.search);
  const preview = params.has('ongoing');
  const explicitTestUser = params.get('test_user');
  const errorPanel = document.getElementById('error');
  if (preview && errorPanel) { errorPanel.hidden = true; errorPanel.style.display = 'none'; }
  const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

  let tgUser = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
  if (explicitTestUser && /^\d+$/.test(explicitTestUser)) {
    tgUser = tgUser || { id: explicitTestUser, first_name: 'Web Test User' };
  }
  if (preview) app.classList.add('preview');
  try { if (tg && tg.ready) tg.ready(); if (tg && tg.expand) tg.expand(); } catch (_) {}

  let page = 1;
  let busy = false;
  let gestureStart = null;

  function updateDots(n) {
    document.querySelectorAll('.dots').forEach(function (row) {
      row.querySelectorAll('.dot').forEach(function (dot, i) {
        dot.classList.toggle('active', i === n - 1);
      });
    });
  }

  function animatePage(screen) {
    screen.classList.remove('replay');
    void screen.offsetWidth;
    screen.classList.add('replay');
  }

  function show(n, direction) {
    const target = Math.max(1, Math.min(3, n));
    if (target === page) return;
    page = target;
    screens.forEach(function (screen) {
      const isTarget = Number(screen.dataset.page) === target;
      screen.classList.toggle('active', isTarget);
      screen.classList.toggle('enter-from-left', isTarget && direction < 0);
      screen.setAttribute('aria-hidden', isTarget ? 'false' : 'true');
    });
    const active = screens.find(function (s) { return Number(s.dataset.page) === target; });
    if (active) animatePage(active);
    updateDots(target);
    try { if (tg && tg.HapticFeedback && tg.HapticFeedback.selectionChanged) tg.HapticFeedback.selectionChanged(); } catch (_) {}
  }

  function sessionId() {
    try {
      let id = localStorage.getItem('myfa_ongoing_preview_session');
      if (!id) {
        id = (crypto.randomUUID ? crypto.randomUUID() : 'ongoing-' + Date.now() + '-' + Math.random().toString(36).slice(2));
        localStorage.setItem('myfa_ongoing_preview_session', id);
      }
      return id;
    } catch (_) { return 'ongoing-' + Date.now(); }
  }

  async function completeAndRoute() {
    if (busy) return;
    busy = true;

    // Pure browser preview: never call Telegram/backend and never show an auth error.
    if (preview && !explicitTestUser) {
      try { sessionStorage.setItem('myfa_ongoing_preview_done', '1'); } catch (_) {}
      window.location.replace('/?ongoing=preview-complete');
      return;
    }

    if (!tgUser || !tgUser.id) {
      // Direct /ongoing.html without Telegram is still usable as a visual demo.
      window.location.replace('/?ongoing=preview-complete');
      return;
    }

    try {
      const response = await fetch('/api/first-open-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Earn-Test-User-ID': String(tgUser.id) },
        body: JSON.stringify({ userId: String(tgUser.id) })
      });
      const data = await response.json().catch(function () { return {}; });
      if (!response.ok || !(data.success || data.error === 'Already completed.')) {
        throw new Error(data.error || 'Could not complete onboarding');
      }
      try { if (tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred) tg.HapticFeedback.notificationOccurred('success'); } catch (_) {}
      window.location.replace('/');
    } catch (error) {
      // Browser test_user must remain testable even if the API is unavailable.
      if (preview || explicitTestUser) {
        window.location.replace('/?ongoing=preview-complete&test_user=' + encodeURIComponent(String(tgUser.id)));
        return;
      }
      busy = false;
      var status = document.getElementById('status-msg');
      if (status) { status.textContent = error.message || 'Please try again'; status.classList.add('show'); }
    }
  }

  function next() { show(page + 1, 1); }
  function previous() { show(page - 1, -1); }

  // Event delegation makes buttons reliable even after CSS animation/reflow.
  app.addEventListener('click', function (event) {
    const target = event.target.closest ? event.target.closest('button, [data-next], [data-next2], [data-finish], [data-skip], .dot') : null;
    if (!target || !app.contains(target)) return;
    event.preventDefault();
    event.stopPropagation();
    if (target.matches('[data-skip]')) { completeAndRoute(); return; }
    if (target.matches('[data-finish]')) { completeAndRoute(); return; }
    if (target.matches('[data-next], [data-next2]')) { next(); return; }
    if (target.classList.contains('dot')) {
      const index = Array.from(target.parentElement.querySelectorAll('.dot')).indexOf(target) + 1;
      if (index) show(index, index > page ? 1 : -1);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowRight') next();
    else if (event.key === 'ArrowLeft') previous();
    else if (event.key === 'Escape') completeAndRoute();
  });

  app.addEventListener('touchstart', function (event) {
    if (event.touches.length === 1) gestureStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  app.addEventListener('touchend', function (event) {
    if (!gestureStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - gestureStart.x;
    const dy = event.changedTouches[0].clientY - gestureStart.y;
    gestureStart = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) dx < 0 ? next() : previous();
  }, { passive: true });

  // Initial state: always show page 1 for ?ongoing. Production entry remains Telegram-aware.
  updateDots(1);
  const first = screens.find(function (s) { return Number(s.dataset.page) === 1; });
  if (first) animatePage(first);
})();
