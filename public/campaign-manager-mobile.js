(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function removeConversionTrackingFeature() {
    const modal = $('#aspModal');
    if (!modal?.classList.contains('open')) return;
    const found = $$('*', modal).filter(el => {
      const direct = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ');
      const text = (direct || el.textContent || '').replace(/\s+/g, ' ').trim();
      return /^25\.?\s*Conversion tracking$/i.test(text) || /^25\.?\s*Conversion tracking\b/i.test(text) && text.length < 180;
    });
    for (const el of found) {
      let block = el;
      for (let i = 0; i < 5 && block.parentElement && block.parentElement.id !== 'aspModal'; i++) {
        const p = block.parentElement;
        const hasControl = !!p.querySelector('button,input,select,textarea');
        const txt = p.textContent.replace(/\s+/g, ' ').trim();
        if (hasControl || txt.length < 500) block = p;
        else break;
      }
      if (block && block !== modal && block.textContent.replace(/\s+/g, ' ').trim().length < 700) {
        block.remove();
        break;
      }
    }
    // Keep the UI copy truthful after removing feature 25.
    $$('#aspModal *').forEach(el => {
      if (el.children.length === 0 && /30 real management features are grouped below/i.test(el.textContent)) {
        el.textContent = el.textContent.replace(/30 real management features are grouped below/i, '29 real management features are grouped below');
      }
    });
  }

  function wrapCreateSubmit() {
    const form = $('#createForm');
    if (!form || form.dataset.mobileReady) return;
    const submit = form.querySelector('button[type="submit"]');
    if (!submit) return;
    form.dataset.mobileReady = '1';
    const footer = document.createElement('div');
    footer.className = 'cm-create-footer';
    const title = document.createElement('div');
    title.className = 'cm-create-footer-title';
    title.innerHTML = '<i class="fa-solid fa-shield-halved"></i><span>READY TO LAUNCH</span>';
    footer.appendChild(title);
    submit.parentNode.insertBefore(footer, submit);
    footer.appendChild(submit);
  }

  function moveManageActions() {
    const modal = $('#aspModal');
    if (!modal?.classList.contains('open')) return;
    const panel = modal.firstElementChild;
    const quick = panel?.querySelector('.cm-quick-actions');
    if (!panel || !quick || panel.dataset.mobileManageReady) return;
    panel.dataset.mobileManageReady = '1';
    const footer = document.createElement('div');
    footer.className = 'cm-manage-footer';
    const title = document.createElement('div');
    title.className = 'cm-footer-title';
    title.innerHTML = '<i class="fa-solid fa-sliders"></i><span>CAMPAIGN ACTIONS</span>';
    footer.appendChild(title);
    footer.appendChild(quick);
    panel.appendChild(footer);
  }

  function apply() {
    wrapCreateSubmit();
    moveManageActions();
    removeConversionTrackingFeature();
    document.body.classList.add('cm-mobile-ui-active');
  }

  const observer = new MutationObserver(apply);
  function start() {
    apply();
    observer.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class','aria-hidden']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
