(() => {
  'use strict';

  let pendingButton = null;

  const ensureDialog = () => {
    let overlay = document.getElementById('cmRemoveConfirmOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'cmRemoveConfirmOverlay';
    overlay.innerHTML = `
      <div class="cm-remove-confirm-card" role="dialog" aria-modal="true" aria-labelledby="cmRemoveConfirmTitle">
        <div class="cm-remove-confirm-icon"><i class="fa-solid fa-trash-can"></i></div>
        <h2 id="cmRemoveConfirmTitle">Remove campaign?</h2>
        <p id="cmRemoveConfirmText">This campaign will stop receiving new delivery. Only the remaining undelivered budget will be returned to your Gems balance.</p>
        <div class="cm-remove-confirm-note"><i class="fa-solid fa-circle-info"></i><span>Gems already spent on delivered ads or completed tasks will stay spent.</span></div>
        <div class="cm-remove-confirm-actions">
          <button type="button" id="cmRemoveCancel" class="cm-remove-btn cm-remove-cancel">Cancel</button>
          <button type="button" id="cmRemoveConfirm" class="cm-remove-btn cm-remove-danger"><i class="fa-solid fa-trash-can"></i> Remove campaign</button>
        </div>
      </div>`;

    const style = document.createElement('style');
    style.textContent = `
      #cmRemoveConfirmOverlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,7,18,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);opacity:0;pointer-events:none;transition:opacity .12s ease}
      #cmRemoveConfirmOverlay.open{opacity:1;pointer-events:auto}
      .cm-remove-confirm-card{width:min(430px,100%);box-sizing:border-box;background:linear-gradient(180deg,#111827,#0b1220);border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:24px;box-shadow:0 28px 90px rgba(0,0,0,.6);text-align:center;color:#fff}
      .cm-remove-confirm-icon{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;margin:0 auto 14px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.28);color:#ff6b6b;font-size:26px}
      .cm-remove-confirm-card h2{margin:0 0 9px;font-size:22px;font-weight:800}
      .cm-remove-confirm-card p{margin:0;color:#aeb9ca;line-height:1.55;font-size:14px}
      .cm-remove-confirm-note{display:flex;gap:9px;align-items:flex-start;text-align:left;margin:16px 0;padding:12px 13px;border-radius:14px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.07);color:#cbd5e1;font-size:12px;line-height:1.45}
      .cm-remove-confirm-note i{color:#fbbf24;margin-top:2px}
      .cm-remove-confirm-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:10px;margin-top:18px}
      .cm-remove-btn{min-height:46px;border-radius:13px;border:1px solid rgba(255,255,255,.1);font-weight:800;cursor:pointer;font-size:14px}
      .cm-remove-cancel{background:rgba(255,255,255,.06);color:#e5e7eb}
      .cm-remove-danger{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border-color:rgba(255,255,255,.04);box-shadow:0 8px 24px rgba(220,38,38,.25)}
      .cm-remove-btn:active{transform:scale(.98)}
      @media(max-width:480px){.cm-remove-confirm-card{padding:20px;border-radius:20px}.cm-remove-confirm-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    overlay.querySelector('#cmRemoveCancel').addEventListener('click', closeDialog);
    overlay.querySelector('#cmRemoveConfirm').addEventListener('click', confirmDialog);
    overlay.addEventListener('click', event => {
      if(event.target === overlay) closeDialog();
    });
    return overlay;
  };

  const closeDialog = () => {
    const overlay = document.getElementById('cmRemoveConfirmOverlay');
    pendingButton = null;
    if(overlay) overlay.classList.remove('open');
  };

  const confirmDialog = () => {
    if(!pendingButton) return closeDialog();
    const btn = pendingButton;
    const overlay = document.getElementById('cmRemoveConfirmOverlay');
    pendingButton = null;
    if(overlay) overlay.classList.remove('open');
    btn.dataset.cmConfirmed = '1';
    btn.click();
    setTimeout(() => { delete btn.dataset.cmConfirmed; }, 0);
  };

  const openDialog = btn => {
    pendingButton = btn;
    const overlay = ensureDialog();
    overlay.classList.add('open');
    setTimeout(() => overlay.querySelector('#cmRemoveConfirm')?.focus(), 0);
  };

  const upgradeRemoveButton = () => {
    const modal = document.getElementById('aspModal');
    if(!modal) return;
    modal.querySelectorAll('button').forEach(btn => {
      const text = (btn.textContent || '').trim().toLowerCase();
      const isRemove = text.includes('refund remaining') || text === 'remove' || text.includes('remove campaign') || btn.dataset.caction === 'liquidate' || btn.dataset.caction === 'remove';
      if(!isRemove || btn.dataset.cmRemoveReady === '1') return;
      btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Remove & refund remaining';
      btn.title = 'Remove this campaign and refund only its remaining undelivered budget';
      btn.dataset.cmRemoveReady = '1';
      btn.dataset.removeUi = '1';
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('aspModal');
    if(!modal) return;
    const observer = new MutationObserver(upgradeRemoveButton);
    observer.observe(modal,{childList:true,subtree:true,characterData:true});
    upgradeRemoveButton();

    document.addEventListener('keydown', event => {
      if(event.key === 'Escape') closeDialog();
    });

    document.addEventListener('click', event => {
      const btn = event.target.closest('#aspModal button[data-remove-ui]');
      if(!btn) return;
      if(btn.dataset.cmConfirmed === '1') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openDialog(btn);
    }, true);
  });
})();
