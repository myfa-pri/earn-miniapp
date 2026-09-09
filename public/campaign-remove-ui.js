(() => {
  'use strict';

  let activeCampaignId = '';
  let removing = false;

  const getUserId = () => String(
    window.Telegram?.WebApp?.initDataUnsafe?.user?.id ||
    new URLSearchParams(location.search).get('userId') || ''
  );

  const getModal = () => document.getElementById('aspModal');

  function rememberManage(event) {
    const target = event.target.closest('[data-open-manage]');
    if (target) activeCampaignId = String(target.dataset.openManage || '');
  }

  function injectDeleteButton() {
    const modal = getModal();
    if (!modal || !modal.classList.contains('open') || !activeCampaignId) return;
    if (modal.querySelector('[data-real-delete-campaign]')) return;

    const card = modal.querySelector('.cm-modal-card') || modal.firstElementChild;
    if (!card) return;

    const wrap = document.createElement('div');
    wrap.setAttribute('data-real-delete-wrap', '1');
    wrap.style.cssText = 'margin-top:18px;padding-top:16px;border-top:1px solid rgba(239,68,68,.25);';
    wrap.innerHTML = `
      <button type="button" data-real-delete-campaign
        style="width:100%;min-height:50px;padding:12px 16px;border:1px solid rgba(239,68,68,.75);border-radius:12px;background:rgba(239,68,68,.14);color:#ff6b6b;font-weight:800;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:9px;">
        <i class="fa-solid fa-trash-can"></i> Delete campaign & refund remaining
      </button>
      <div style="margin-top:8px;text-align:center;color:#94a3b8;font-size:12px;line-height:1.45;">Only unused / undelivered Gems are refunded. Already delivered rewards stay spent.</div>`;
    card.appendChild(wrap);
  }

  async function deleteCampaign(event) {
    const button = event.target.closest('[data-real-delete-campaign]');
    if (!button || removing || !activeCampaignId) return;
    event.preventDefault();
    event.stopPropagation();

    if (!window.confirm('Delete this campaign now? Only the remaining undelivered budget will be refunded to your Gems balance.')) return;

    const userId = getUserId();
    if (!userId) {
      window.alert('Telegram user session not found. Reopen Campaign Manager from Telegram.');
      return;
    }

    removing = true;
    button.disabled = true;
    button.style.opacity = '.6';
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Removing campaign…';

    try {
      const response = await fetch(`/api/campaign-manager/campaigns/${encodeURIComponent(activeCampaignId)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-User-ID': userId },
        body: JSON.stringify({ userId, action: 'remove' }),
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Campaign removal failed');

      const refunded = Number(data.refunded || 0).toLocaleString();
      const modal = getModal();
      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
      window.alert(`Campaign deleted. ${refunded} Gems returned to your balance.`);
      location.reload();
    } catch (e) {
      button.disabled = false;
      button.style.opacity = '1';
      button.innerHTML = '<i class="fa-solid fa-trash-can"></i> Delete campaign & refund remaining';
      window.alert(e.message || 'Campaign removal failed');
    } finally {
      removing = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const modal = getModal();
    if (!modal) return;

    document.addEventListener('click', rememberManage, true);
    document.addEventListener('click', deleteCampaign, true);

    const observer = new MutationObserver(injectDeleteButton);
    observer.observe(modal, { childList: true, subtree: true, attributes: true });
    injectDeleteButton();
  });
})();
