/* MYFA Ads Center - production UI enhancements and reliability helpers */
(function () {
  'use strict';

  const state = {
    booted: false,
    lastSync: 0,
    draftKey: 'myfa_ads_campaign_draft_v2',
    visibilityAt: Date.now(),
    refreshTimer: null,
    countdownTimer: null
  };

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function notify(message, type) {
    if (typeof toast === 'function') {
      toast(message, type || 'info');
    }
  }

  function currentUserId() {
    return typeof userId !== 'undefined' ? userId : null;
  }

  function providerName(name) {
    const names = {
      monetag: 'Monetag',
      adsgram: 'Adsgram',
      adsterra: 'Premium Ads',
      myfa: 'MYFA Sponsored'
    };
    return names[name] || name;
  }

  function formatRelative(timestamp) {
    const value = Number(timestamp || 0);
    if (!value) return 'Unknown time';
    const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function saveDraft() {
    const draft = {
      headline: qs('#campHeadline')?.value || '',
      desc: qs('#campDesc')?.value || '',
      url: qs('#campUrl')?.value || '',
      image: qs('#campImage')?.value || '',
      budget: qs('#campBudget')?.value || '',
      daily: qs('#campDaily')?.value || '',
      device: qs('#campDevice')?.value || 'all',
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(state.draftKey, JSON.stringify(draft));
      notify('Campaign draft saved on this device.', 'success');
    } catch {
      notify('Unable to save a local draft.', 'error');
    }
  }

  function restoreDraft() {
    try {
      const raw = localStorage.getItem(state.draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== 'object') return;
      if (qs('#campHeadline')) qs('#campHeadline').value = draft.headline || '';
      if (qs('#campDesc')) qs('#campDesc').value = draft.desc || '';
      if (qs('#campUrl')) qs('#campUrl').value = draft.url || '';
      if (qs('#campImage')) qs('#campImage').value = draft.image || '';
      if (qs('#campBudget')) qs('#campBudget').value = draft.budget || '';
      if (qs('#campDaily')) qs('#campDaily').value = draft.daily || '';
      if (qs('#campDevice')) qs('#campDevice').value = draft.device || 'all';
    } catch {
      localStorage.removeItem(state.draftKey);
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(state.draftKey);
    } catch {}
  }

  function validateCampaignForm() {
    const headline = qs('#campHeadline')?.value.trim() || '';
    const description = qs('#campDesc')?.value.trim() || '';
    const url = qs('#campUrl')?.value.trim() || '';
    const image = qs('#campImage')?.value.trim() || '';
    const total = Number(qs('#campBudget')?.value || 0);
    const daily = Number(qs('#campDaily')?.value || 0);

    if (headline.length < 3) {
      notify('Campaign headline is too short.', 'error');
      return false;
    }
    if (headline.length > 80) {
      notify('Campaign headline is too long.', 'error');
      return false;
    }
    if (description.length > 240) {
      notify('Campaign description is too long.', 'error');
      return false;
    }
    if (!safeUrl(url)) {
      notify('Use a valid HTTPS destination URL.', 'error');
      return false;
    }
    if (image && !safeUrl(image)) {
      notify('Creative image must use HTTPS.', 'error');
      return false;
    }
    if (total < 100) {
      notify('Minimum campaign budget is 100 Gems.', 'error');
      return false;
    }
    if (daily < 50) {
      notify('Minimum daily budget is 50 Gems.', 'error');
      return false;
    }
    if (daily > total) {
      notify('Daily budget cannot exceed total budget.', 'error');
      return false;
    }
    return true;
  }

  function decorateCampaignForm() {
    const form = qs('#campHeadline');
    if (!form || form.dataset.enhanced) return;
    form.dataset.enhanced = '1';

    const wrapper = form.parentElement;
    if (!wrapper) return;

    const hint = document.createElement('div');
    hint.className = 'muted small';
    hint.style.marginTop = '5px';
    hint.textContent = 'HTTPS links only • no automatic balance creation';
    wrapper.appendChild(hint);

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'secondary';
    save.style.width = '100%';
    save.style.marginTop = '8px';
    save.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Draft';
    save.addEventListener('click', saveDraft);
    wrapper.parentElement.appendChild(save);
  }

  function addLiveClock() {
    const hero = qs('.hero');
    if (!hero || qs('#adsLiveClock')) return;
    const clock = document.createElement('div');
    clock.id = 'adsLiveClock';
    clock.className = 'muted small';
    clock.style.marginTop = '10px';
    clock.textContent = 'Last sync: just now';
    hero.appendChild(clock);

    const tick = () => {
      const age = state.lastSync ? formatRelative(state.lastSync) : 'never';
      clock.textContent = `Last sync: ${age}`;
    };
    setInterval(tick, 10000);
  }

  function addRefreshShortcut() {
    if (qs('#adsQuickRefresh')) return;
    const button = document.createElement('button');
    button.id = 'adsQuickRefresh';
    button.className = 'secondary';
    button.style.width = '100%';
    button.style.marginTop = '10px';
    button.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> Sync balances and inventory';
    button.addEventListener('click', async () => {
      if (typeof refreshAll !== 'function') return;
      button.disabled = true;
      try {
        await refreshAll();
      } finally {
        button.disabled = false;
      }
    });
    const earnSection = qs('#tab-earn');
    const firstCard = earnSection?.querySelector('.card');
    if (firstCard) firstCard.appendChild(button);
  }

  function addNetworkHealth() {
    if (qs('#networkHealth')) return;
    const card = document.createElement('div');
    card.id = 'networkHealth';
    card.className = 'card';
    card.style.marginTop = '10px';
    card.innerHTML = `
      <div class="section-head">
        <h3 class="title" style="margin:0">Network Health</h3>
        <span class="pill">LIVE CHECK</span>
      </div>
      <div id="networkHealthList" class="feature-list"></div>
    `;
    const earnSection = qs('#tab-earn');
    earnSection?.appendChild(card);
    renderNetworkHealth();
  }

  function renderNetworkHealth() {
    const list = qs('#networkHealthList');
    if (!list) return;
    const names = ['monetag', 'adsgram', 'adsterra', 'myfa'];
    list.innerHTML = names.map((name) => {
      const limit = Number(stats?.limits?.[name] || 0);
      const watched = Number(stats?.counts?.[name] || 0);
      const available = limit > watched;
      return `
        <div class="feature">
          <i class="fa-solid ${available ? 'fa-circle-check' : 'fa-circle-pause'}" style="color:${available ? '#6ee7b7' : '#fcd34d'}"></i>
          <div style="flex:1">
            <b>${providerName(name)}</b>
            <span>${available ? `${limit - watched} views remaining today` : 'Daily limit reached'}</span>
          </div>
          <span class="pill">${watched}/${limit}</span>
        </div>
      `;
    }).join('');
  }

  function addCampaignBudgetPreview() {
    if (qs('#campaignBudgetPreview')) return;
    const budget = qs('#campBudget');
    const daily = qs('#campDaily');
    if (!budget || !daily) return;
    const box = document.createElement('div');
    box.id = 'campaignBudgetPreview';
    box.className = 'muted small';
    box.style.marginTop = '8px';
    budget.parentElement.appendChild(box);

    const updatePreview = () => {
      const total = Number(budget.value || 0);
      const perDay = Number(daily.value || 0);
      const days = perDay > 0 ? Math.ceil(total / perDay) : 0;
      box.textContent = days ? `Estimated flight: ${days} day${days === 1 ? '' : 's'} at the selected daily budget.` : 'Enter a budget to preview the flight.';
    };
    budget.addEventListener('input', updatePreview);
    daily.addEventListener('input', updatePreview);
    updatePreview();
  }

  function addCampaignValidationHook() {
    const original = window.createCampaign;
    if (typeof original !== 'function' || original.__wrappedByMyfaAds) return;
    const wrapped = async function () {
      if (!validateCampaignForm()) return;
      await original();
      clearDraft();
    };
    wrapped.__wrappedByMyfaAds = true;
    window.createCampaign = wrapped;
  }

  function addVisibilitySafety() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        state.visibilityAt = Date.now();
        return;
      }
      const away = Date.now() - state.visibilityAt;
      if (away > 120000 && typeof loadStats === 'function') {
        loadStats();
      }
    });
  }

  function addWatchModalSafety() {
    const modal = qs('#watchModal');
    if (!modal) return;
    modal.addEventListener('click', (event) => {
      if (event.target !== modal) return;
      if (typeof closeWatch === 'function') closeWatch();
    });
  }

  function addKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && typeof closeWatch === 'function') closeWatch();
      if (event.key.toLowerCase() === 'r' && event.ctrlKey) {
        event.preventDefault();
        if (typeof refreshAll === 'function') refreshAll();
      }
    });
  }

  function addProviderRetryHints() {
    ['card-monetag', 'card-adsgram', 'card-adsterra', 'card-myfa'].forEach((id) => {
      const card = qs('#' + id);
      if (!card) return;
      card.title = 'Rewards are subject to network availability and MYFA limits.';
    });
  }

  function startPeriodicSync() {
    clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => {
      if (document.hidden) return;
      if (typeof loadStats === 'function') loadStats();
    }, 60000);
  }

  function markSync() {
    state.lastSync = Date.now();
  }

  function hookStatsSync() {
    if (typeof window.loadStats !== 'function') return;
    const original = window.loadStats;
    if (original.__wrappedByMyfaAds) return;
    const wrapped = async function () {
      const result = await original.apply(this, arguments);
      state.lastSync = Date.now();
      renderNetworkHealth();
      return result;
    };
    wrapped.__wrappedByMyfaAds = true;
    window.loadStats = wrapped;
  }

  function boot() {
    if (state.booted) return;
    state.booted = true;
    restoreDraft();
    decorateCampaignForm();
    addLiveClock();
    addRefreshShortcut();
    addNetworkHealth();
    addCampaignBudgetPreview();
    addCampaignValidationHook();
    addVisibilitySafety();
    addWatchModalSafety();
    addKeyboardShortcuts();
    addProviderRetryHints();
    startPeriodicSync();
    markSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 50), { once: true });
  } else {
    setTimeout(boot, 50);
  }

  window.myfaAdsEnhancements = {
    state,
    saveDraft,
    restoreDraft,
    clearDraft,
    validateCampaignForm,
    renderNetworkHealth,
    formatRelative,
    providerName,
    safeUrl,
    boot
  };
})();
