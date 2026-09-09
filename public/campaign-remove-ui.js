(() => {
  'use strict';

  function upgradeRemoveButton() {
    const modal = document.getElementById('aspModal');
    if (!modal) return;
    const buttons = modal.querySelectorAll('button');
    buttons.forEach(btn => {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text.includes('refund remaining') || text === 'remove' || text.includes('remove campaign')) {
        btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Remove & refund remaining';
        btn.title = 'Remove this campaign and refund only its remaining undelivered budget';
        btn.setAttribute('data-remove-ui', '1');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('aspModal');
    if (!modal) return;

    const observer = new MutationObserver(upgradeRemoveButton);
    observer.observe(modal, { childList: true, subtree: true, characterData: true });
    upgradeRemoveButton();

    document.addEventListener('click', (event) => {
      const btn = event.target.closest('#aspModal button[data-remove-ui]');
      if (!btn) return;
      const ok = window.confirm('Remove this campaign now? Only the remaining undelivered budget will be returned to your Gems balance. Gems already spent on delivered ads/tasks will stay spent.');
      if (!ok) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  });
})();
