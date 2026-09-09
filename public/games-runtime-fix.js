(() => {
  'use strict';
  // Scratch and Pro Spin reference globalData directly from the main inline game code.
  // Restore it as a real shared global and hydrate it from the public config endpoint.
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
})();
