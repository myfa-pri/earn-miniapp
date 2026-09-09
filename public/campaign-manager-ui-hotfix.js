(() => {
  'use strict';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const tgUser = () => window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  const uid = () => String(tgUser()?.id || new URLSearchParams(location.search).get('userId') || '');
  const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const cleanDateTime = value => {
    let s = String(value ?? '');
    s = s.replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    const m = s.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    return m ? m[1] : '';
  };

  // Sanitize malformed datetime values before the browser parses inserted HTML.
  const desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (desc && desc.set) {
    Object.defineProperty(Element.prototype, 'innerHTML', {
      configurable: true,
      get: desc.get,
      set(value) {
        if (typeof value === 'string' && /datetime-local/i.test(value)) {
          value = value.replace(/<input\b[^>]*type=["']datetime-local["'][^>]*>/gi, tag => {
            return tag.replace(/\svalue=(['"])([\s\S]*?)\1/i, (m,q,v) => ` value=${q}${cleanDateTime(v)}${q}`);
          });
        }
        return desc.set.call(this, value);
      }
    });
  }

  const closeModal = () => {
    const modal = $('#aspModal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('cm-modal-open');
  };

  const api = async (path, options={}) => {
    const res = await fetch(path, { ...options, headers: {'Content-Type':'application/json', ...(options.headers||{})} });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const setActive = view => $$('.asp-nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const fmt = n => Number(n||0).toLocaleString();

  const utility = async view => {
    const c = $('#aspContent');
    const id = uid();
    if (!id) return;
    setActive(view);
    c.innerHTML = `<section class="asp-title"><span>REAL DATA</span><h1>${view === 'analytics' ? 'Performance, without guesswork.' : 'Your advertising wallet.'}</h1><p class="asp-copy">Loading current campaign data from the MYFA BIRR backend…</p></section><div class="cm-note"><i class="fa-solid fa-circle-notch fa-spin"></i> Syncing Firebase campaign state</div>`;
    try {
      const d = await api(`/api/campaign-manager/dashboard/${encodeURIComponent(id)}`);
      const camps = d.campaigns || [];
      const s = d.summary || {};
      if (view === 'analytics') {
        const ctr = s.impressions ? ((s.clicks/s.impressions)*100).toFixed(2) : '0.00';
        const convRate = s.impressions ? ((s.conversions/s.impressions)*100).toFixed(2) : '0.00';
        c.innerHTML = `<section class="asp-title"><span>PERFORMANCE CENTER</span><h1>Campaign performance.</h1><p class="asp-copy">Only values recorded by the MYFA BIRR campaign backend are shown here.</p></section>
          <div class="cm-utility-grid">
            <div class="cm-utility-card"><span><i class="fa-solid fa-eye"></i> IMPRESSIONS</span><strong>${fmt(s.impressions)}</strong></div>
            <div class="cm-utility-card"><span><i class="fa-solid fa-arrow-pointer"></i> CLICKS</span><strong>${fmt(s.clicks)}</strong></div>
            <div class="cm-utility-card"><span><i class="fa-solid fa-percent"></i> CTR</span><strong>${ctr}%</strong></div>
            <div class="cm-utility-card"><span><i class="fa-solid fa-bullseye"></i> CONVERSION RATE</span><strong>${convRate}%</strong></div>
          </div>
          <section class="asp-section"><div class="asp-section-head"><div><small>Delivery mix</small><h2>Your campaigns</h2></div></div>
            ${camps.length ? camps.map(x => `<div class="asp-card" style="margin-bottom:10px;padding:16px"><div class="asp-row"><b>${escapeHtml(x.name)}</b><span class="asp-tag">${escapeHtml(x.status)}</span></div><div class="asp-metrics" style="margin-top:10px"><span><i class="fa-solid fa-eye"></i>${fmt(x.impressions)}</span><span><i class="fa-solid fa-arrow-pointer"></i>${fmt(x.clicks)}</span><span><i class="fa-solid fa-bullseye"></i>${fmt(x.conversions)}</span><span><i class="fa-solid fa-gem"></i>${fmt(x.spend)}</span></div></div>`).join('') : '<div class="asp-empty"><b>No campaign data</b><span>Create a campaign to start collecting delivery metrics.</span></div>'}
          </section>`;
      } else {
        const reserved = Number(s.reserved||0);
        const available = Number(d.user?.points||0);
        const spend = Number(s.spend||0);
        const escrow = Number(d.user?.stuckBalance||0);
        c.innerHTML = `<section class="asp-title"><span>ADVERTISER WALLET</span><h1>Know where every Gem is.</h1><p class="asp-copy">Available, reserved, spent, and escrow values are read directly from the backend.</p></section>
          <div class="cm-utility-grid">
            <div class="cm-utility-card"><span><i class="fa-solid fa-gem"></i> AVAILABLE</span><strong>${fmt(available)}</strong></div>
            <div class="cm-utility-card"><span><i class="fa-solid fa-lock"></i> RESERVED</span><strong>${fmt(reserved)}</strong></div>
            <div class="cm-utility-card"><span><i class="fa-solid fa-chart-line"></i> SPENT</span><strong>${fmt(spend)}</strong></div>
            <div class="cm-utility-card"><span><i class="fa-solid fa-vault"></i> ESCROW</span><strong>${fmt(escrow)}</strong></div>
          </div>
          <section class="asp-section"><div class="asp-section-head"><div><small>Balance integrity</small><h2>Live campaign reserves</h2></div><button class="asp-secondary" data-view="dashboard"><i class="fa-solid fa-arrow-left"></i> Back to overview</button></div>
            <div class="cm-note"><i class="fa-solid fa-shield-halved"></i> Campaign reservations are separate from the spend total and are not shown as available Gems.</div>
          </section>`;
      }
      bindUtility(view);
    } catch (e) {
      c.innerHTML = `<div class="asp-empty"><i class="fa-solid fa-triangle-exclamation"></i><b>Unable to load ${escapeHtml(view)}</b><span>${escapeHtml(e.message)}</span><button class="asp-primary" data-view="dashboard">Return to Overview</button></div>`;
      bindUtility(view);
    }
  };
  const bindUtility = view => $$('#aspContent [data-view]').forEach(b => b.onclick = () => {
    const v = b.dataset.view;
    if (v === 'analytics' || v === 'wallet') utility(v);
    else { setActive(v); location.reload(); }
  });

  // Extra actions and robust close handling are delegated so rerenders cannot break them.
  document.addEventListener('click', e => {
    const close = e.target.closest('[data-close],.asp-modal-close');
    if (close) { e.preventDefault(); e.stopPropagation(); closeModal(); return; }
    const modal = $('#aspModal');
    if (modal && modal.classList.contains('open') && e.target === modal) { closeModal(); return; }
    const nav = e.target.closest('.asp-nav [data-view]');
    if (nav && (nav.dataset.view === 'analytics' || nav.dataset.view === 'wallet')) {
      e.preventDefault(); e.stopImmediatePropagation(); utility(nav.dataset.view); return;
    }
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  const sanitizeDates = root => {
    (root || document).querySelectorAll('input[type="datetime-local"]').forEach(i => {
      const v = cleanDateTime(i.getAttribute('value') || i.value);
      if (i.value !== v) i.value = v;
      if (i.getAttribute('value') !== v) i.setAttribute('value', v);
    });
  };
  const observer = new MutationObserver(records => {
    for (const r of records) {
      if ([...r.addedNodes].some(n => n.nodeType === 1)) { sanitizeDates($('#aspContent')); sanitizeDates($('#aspModal')); }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    sanitizeDates(document);
    observer.observe($('#aspContent') || document.body, { childList:true, subtree:true });
    observer.observe($('#aspModal') || document.body, { childList:true, subtree:true });
  });
})();
