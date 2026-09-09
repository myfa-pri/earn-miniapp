(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const views = [
    { key:'dashboard', label:'Home', icon:'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z' },
    { key:'create', label:'Create', icon:'M12 5v14M5 12h14' },
    { key:'campaigns', label:'Manage', icon:'M4 5h16v4H4z M4 11h16v4H4z M4 17h10v2H4z' },
    { key:'analytics', label:'Statistics', icon:'M4 19V5M4 19h16M7 15l3-4 3 2 5-7' },
    { key:'wallet', label:'Wallet', icon:'M4 7h16v12H4z M16 11h4v5h-4a2.5 2.5 0 0 1 0-5Z' }
  ];

  function ensureBar() {
    if ($('#cmWorkbar')) return $('#cmWorkbar');
    const bar = document.createElement('nav');
    bar.id = 'cmWorkbar';
    bar.className = 'cm-workbar';
    bar.setAttribute('aria-label', 'Campaign Manager navigation');
    bar.innerHTML = views.map(v => `<button type="button" data-cm-view="${v.key}" aria-label="${v.label}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${v.icon}"/></svg><span>${v.label}</span></button>`).join('');
    $('.asp-topbar')?.after(bar);
    bar.addEventListener('click', e => {
      const btn = e.target.closest('[data-cm-view]');
      if (!btn) return;
      e.preventDefault();
      const target = $('.asp-nav [data-view="' + btn.dataset.cmView + '"]');
      if (target) target.click();
      sync();
      if (btn.dataset.cmView === 'create') {
        requestAnimationFrame(() => ensureCreateTabs());
      }
    });
    return bar;
  }

  function sync() {
    const bar = $('#cmWorkbar');
    if (!bar) return;
    const legacy = $('.asp-nav button.active')?.dataset.view || 'dashboard';
    $$('#cmWorkbar [data-cm-view]').forEach(b => b.classList.toggle('active', b.dataset.cmView === legacy));
    ensureCreateTabs();
  }

  function ensureCreateTabs() {
    const choice = $('#aspContent .asp-choice');
    if (!choice) return;
    choice.classList.add('cm-create-tabs');
    if (!$('#cmCreateLabel')) {
      const shell = document.createElement('div');
      shell.id = 'cmCreateLabel';
      shell.className = 'cm-create-label';
      shell.innerHTML = '<i class="fa-solid fa-layer-group"></i><span>CREATE TYPE</span>';
      choice.before(shell);
    }
  }

  function observe() {
    const root = $('#adStudioApp') || document.body;
    const obs = new MutationObserver(() => {
      ensureBar();
      sync();
    });
    obs.observe(root, { childList:true, subtree:true });
  }

  function start() {
    ensureBar();
    sync();
    observe();
    setTimeout(sync, 100);
    setTimeout(sync, 500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
