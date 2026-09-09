/*
 * MYFA Ads Center - real account bridge
 * This module intentionally contains no fake balances or demo rewards.
 * It provides defensive helpers used by the real setting.html page.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'myfa_ads_center_state_v4';
  const DRAFT_KEY = 'myfa_ads_campaign_draft_v3';

  const state = {
    bootAt: Date.now(),
    lastSync: 0,
    syncCount: 0,
    errors: 0,
    lastError: '',
    providerLoads: {},
    visibility: document.visibilityState,
    online: navigator.onLine !== false
  };

  function getState() {
    return { ...state };
  }

  function setOnline(value) {
    state.online = !!value;
  }

  function markSync() {
    state.lastSync = Date.now();
    state.syncCount += 1;
    state.lastError = '';
    persistState();
  }

  function markError(error) {
    state.errors += 1;
    state.lastError = error instanceof Error ? error.message : String(error || 'Unknown error');
    persistState();
  }

  function persistState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        lastSync: state.lastSync,
        syncCount: state.syncCount,
        errors: state.errors,
        lastError: state.lastError,
        savedAt: Date.now()
      }));
    } catch (_) {
      // Storage is optional; the application must still work without it.
    }
  }

  function restoreState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;
      state.lastSync = Number(saved.lastSync) || 0;
      state.syncCount = Number(saved.syncCount) || 0;
      state.errors = Number(saved.errors) || 0;
      state.lastError = String(saved.lastError || '');
    } catch (_) {
      // Ignore corrupt local state.
    }
  }

  function validTelegramId(value) {
    return /^-?\d{3,20}$/.test(String(value || '').trim());
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function safeMoney(value) {
    return safeNumber(value).toFixed(4);
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return url.protocol === 'https:' ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function campaignFormSnapshot() {
    const byId = id => document.getElementById(id);
    return {
      headline: byId('campHeadline')?.value.trim() || '',
      description: byId('campDesc')?.value.trim() || '',
      destination: byId('campUrl')?.value.trim() || '',
      creative: byId('campImage')?.value.trim() || '',
      totalBudget: byId('campBudget')?.value || '',
      dailyBudget: byId('campDaily')?.value || '',
      device: byId('campDevice')?.value || 'all'
    };
  }

  function validateCampaignSnapshot(snapshot) {
    const result = {
      valid: true,
      errors: []
    };

    if (snapshot.headline.length < 3) {
      result.valid = false;
      result.errors.push('Headline must contain at least 3 characters.');
    }

    if (snapshot.headline.length > 80) {
      result.valid = false;
      result.errors.push('Headline cannot exceed 80 characters.');
    }

    if (snapshot.description.length > 240) {
      result.valid = false;
      result.errors.push('Description cannot exceed 240 characters.');
    }

    if (!safeUrl(snapshot.destination)) {
      result.valid = false;
      result.errors.push('Destination must be a valid HTTPS URL.');
    }

    if (snapshot.creative && !safeUrl(snapshot.creative)) {
      result.valid = false;
      result.errors.push('Creative URL must use HTTPS.');
    }

    const total = safeNumber(snapshot.totalBudget);
    const daily = safeNumber(snapshot.dailyBudget);

    if (total < 100) {
      result.valid = false;
      result.errors.push('Total campaign budget must be at least 100 Gems.');
    }

    if (daily < 50) {
      result.valid = false;
      result.errors.push('Daily campaign budget must be at least 50 Gems.');
    }

    if (daily > total) {
      result.valid = false;
      result.errors.push('Daily budget cannot exceed total budget.');
    }

    return result;
  }

  function saveDraft() {
    const snapshot = campaignFormSnapshot();
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        ...snapshot,
        savedAt: Date.now()
      }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object') return null;
      return value;
    } catch (_) {
      return null;
    }
  }

  function clearDraft() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (_) {
      // Ignore storage failures.
    }
  }

  function applyDraft(draft) {
    if (!draft) return false;
    const set = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.value = value || '';
    };
    set('campHeadline', draft.headline);
    set('campDesc', draft.description);
    set('campUrl', draft.destination);
    set('campImage', draft.creative);
    set('campBudget', draft.totalBudget);
    set('campDaily', draft.dailyBudget);
    set('campDevice', draft.device || 'all');
    return true;
  }

  function formatAge(timestamp) {
    const value = safeNumber(timestamp);
    if (!value) return 'never';
    const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function providerConfigured(config, provider) {
    const cfg = config || {};
    if (provider === 'monetag') return Boolean(cfg.monetagZoneId);
    if (provider === 'adsgram') return Boolean(cfg.adsgramBlockId);
    if (provider === 'adsterra') return Boolean(cfg.adsterraLink);
    return provider === 'myfa';
  }

  function providerLabel(provider) {
    const labels = {
      monetag: 'Monetag',
      adsgram: 'Adsgram',
      adsterra: 'Premium Ads',
      myfa: 'MYFA Sponsored'
    };
    return labels[provider] || provider;
  }

  function providerStatus(config, provider) {
    return {
      provider,
      label: providerLabel(provider),
      configured: providerConfigured(config, provider)
    };
  }

  function allProviderStatuses(config) {
    return ['monetag', 'adsgram', 'adsterra', 'myfa']
      .map(provider => providerStatus(config, provider));
  }

  function recordProviderLoad(provider, ok) {
    state.providerLoads[provider] = {
      ok: Boolean(ok),
      at: Date.now()
    };
    persistState();
  }

  function providerLoadState(provider) {
    return state.providerLoads[provider] || null;
  }

  function isProviderRecentlyLoaded(provider, maxAgeMs = 300000) {
    const entry = providerLoadState(provider);
    if (!entry) return false;
    return Date.now() - safeNumber(entry.at) < maxAgeMs && entry.ok === true;
  }

  function setElementText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  }

  function setElementDisabled(id, disabled) {
    const element = document.getElementById(id);
    if (!element) return;
    element.disabled = Boolean(disabled);
  }

  function setElementClass(id, className, enabled) {
    const element = document.getElementById(id);
    if (!element) return;
    element.classList.toggle(className, Boolean(enabled));
  }

  function setLoadingState(loading) {
    setElementDisabled('refreshBtn', loading);
    setElementDisabled('accountRefresh', loading);
    setElementClass('refreshBtn', 'loading', loading);
  }

  function updateSyncLabel() {
    const label = document.getElementById('syncText');
    if (!label) return;
    if (!state.lastSync) {
      label.textContent = 'Waiting for live Firebase balance…';
      return;
    }
    label.textContent = `Last real account sync: ${formatAge(state.lastSync)}`;
  }

  function startSyncClock() {
    updateSyncLabel();
    window.setInterval(updateSyncLabel, 10000);
  }

  function attachConnectivityListeners() {
    window.addEventListener('online', () => {
      setOnline(true);
      if (typeof window.refreshAll === 'function') {
        window.refreshAll().catch(() => {});
      }
    });

    window.addEventListener('offline', () => {
      setOnline(false);
      if (typeof window.toast === 'function') {
        window.toast('Network connection lost. No balance was changed.', 'error');
      }
    });
  }

  function attachVisibilityRefresh() {
    document.addEventListener('visibilitychange', () => {
      state.visibility = document.visibilityState;
      if (document.visibilityState === 'visible' && state.lastSync && Date.now() - state.lastSync > 120000) {
        if (typeof window.refreshAll === 'function') {
          window.refreshAll().catch(() => {});
        }
      }
    });
  }

  function installSafeErrorHandler() {
    window.addEventListener('error', event => {
      if (event?.error) markError(event.error);
    });

    window.addEventListener('unhandledrejection', event => {
      if (event?.reason) markError(event.reason);
    });
  }

  function exposeBridge() {
    window.MYFAAdsCenter = {
      getState,
      safeNumber,
      safeMoney,
      safeUrl,
      validTelegramId,
      campaignFormSnapshot,
      validateCampaignSnapshot,
      saveDraft,
      loadDraft,
      clearDraft,
      applyDraft,
      providerConfigured,
      providerStatus,
      allProviderStatuses,
      recordProviderLoad,
      providerLoadState,
      isProviderRecentlyLoaded,
      markSync,
      markError,
      setLoadingState,
      updateSyncLabel
    };
  }

  function init() {
    restoreState();
    exposeBridge();
    attachConnectivityListeners();
    attachVisibilityRefresh();
    installSafeErrorHandler();
    startSyncClock();
  }

  init();
})();

/* Runtime diagnostics deliberately remain local to the device. */
(function diagnostics() {
  const bridge = window.MYFAAdsCenter;
  if (!bridge) return;

  bridge.networkSummary = function networkSummary() {
    return {
      online: navigator.onLine !== false,
      visibility: document.visibilityState,
      userIdPresent: Boolean(window.userId),
      providerCount: Object.keys(bridge.getState().providerLoads || {}).length,
      generatedAt: Date.now()
    };
  };

  bridge.clearDiagnostics = function clearDiagnostics() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      // Optional storage only.
    }
  };

  bridge.hasLocalDraft = function hasLocalDraft() {
    return Boolean(bridge.loadDraft());
  };

  bridge.draftAge = function draftAge() {
    const draft = bridge.loadDraft();
    if (!draft || !draft.savedAt) return null;
    return Math.max(0, Date.now() - Number(draft.savedAt));
  };

  bridge.balanceIsReal = function balanceIsReal(balance) {
    if (!balance || typeof balance !== 'object') return false;
    return Number.isFinite(Number(balance.gems)) && Number.isFinite(Number(balance.cash));
  };

  bridge.shouldShowBalance = function shouldShowBalance(balance) {
    return bridge.balanceIsReal(balance);
  };

  bridge.rewardIsPositive = function rewardIsPositive(reward) {
    if (!reward || typeof reward !== 'object') return false;
    return Number(reward.gems || 0) > 0 || Number(reward.cash || 0) > 0;
  };

  bridge.isSuccessfulProviderResult = function isSuccessfulProviderResult(result) {
    if (!result || typeof result !== 'object') return false;
    if (result.error === true) return false;
    return result.done === true;
  };

  bridge.describeProvider = function describeProvider(config, provider) {
    const info = bridge.providerStatus(config, provider);
    if (info.configured) {
      return `${info.label}: configured`;
    }
    return `${info.label}: waiting for admin configuration`;
  };
})();
