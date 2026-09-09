import fs from 'fs';
import path from 'path';

function buildRuntime() {
  return `
<script>
(() => {
  'use strict';
  const SESSION_KEY = 'MYFA_ADMIN_SESSION';
  const originalFetch = window.fetch.bind(window);

  const getSession = () => {
    try { return sessionStorage.getItem(SESSION_KEY) || ''; } catch (_) { return ''; }
  };

  const isAdminApi = pathname => /^\\/api\\/admin(?:\\/|$)/.test(pathname);

  const normalizeConfig = cfg => {
    const out = { ...(cfg || {}) };
    if (out.paymentApiUrl !== undefined) out.paymentApiEndpoint = String(out.paymentApiUrl || '');
    if (out.autoWithdrawDelay !== undefined) out.autoWithdrawDelayMinutes = Number(out.autoWithdrawDelay) || 0;
    if (out.withdrawChannelId !== undefined) out.withdrawalChannelId = String(out.withdrawChannelId || '');
    if (out.withdrawChannelUsername !== undefined) out.withdrawalChannelUsername = String(out.withdrawChannelUsername || '');
    if (out.telegramNotifEnabled !== undefined) out.enableWithdrawalNotification = !!out.telegramNotifEnabled;
    if (out.notificationChannelId !== undefined) out.withdrawalChannelId = String(out.notificationChannelId || '');
    if (out.notificationChannelUsername !== undefined) out.withdrawalChannelUsername = String(out.notificationChannelUsername || '');
    if (out.spinRewardText !== undefined) out.spinRiggedReward = String(out.spinRewardText ?? '');
    return out;
  };

  const routeTarget = pathname => {
    const map = {
      '/api/admin/data':'data',
      '/api/admin/config-update':'config-update',
      '/api/admin/tasks':'tasks',
      '/api/admin/promos':'promos',
      '/api/admin/user-action':'user-action',
      '/api/admin/withdrawals':'withdrawals',
      '/api/admin/channel/post':'channel/post',
      '/api/admin/logs':'logs',
      '/api/admin/broadcast':'broadcast'
    };
    return map[pathname] || null;
  };

  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : input?.url || '';
    let parsed;
    try { parsed = new URL(url, location.origin); } catch (_) { return originalFetch(input, init); }
    const pathname = parsed.pathname;
    if (!isAdminApi(pathname)) return originalFetch(input, init);

    const session = getSession();
    const target = routeTarget(pathname);
    if (target && session) {
      const nextInit = { ...init, headers: new Headers(init.headers || {}) };
      nextInit.headers.set('X-MYFA-ADMIN-SESSION', session);
      if (target === 'config-update' && typeof nextInit.body === 'string') {
        try {
          const body = JSON.parse(nextInit.body);
          body.fullConfig = normalizeConfig(body.fullConfig);
          nextInit.body = JSON.stringify(body);
        } catch (_) {}
      }
      return originalFetch('/api/admin-gateway?target=' + encodeURIComponent(target), nextInit);
    }

    return originalFetch(input, init);
  };

  const loginAndLoad = async () => {
    const username = String(document.getElementById('lUser')?.value || '').trim();
    const password = String(document.getElementById('lPass')?.value || '');
    try {
      const response = await originalFetch('/api/admin-auth', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ action:'login', username, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.token) {
        alert(data.error || 'Invalid credentials');
        return;
      }
      try { sessionStorage.setItem(SESSION_KEY, data.token); } catch (_) {}
      const gate = document.getElementById('loginGate');
      if (gate) gate.style.display = 'none';
      if (typeof window.fetchAdminData === 'function') await window.fetchAdminData();
      if (typeof window.fetchAdminLogs === 'function') await window.fetchAdminLogs();
      if (typeof window.loadChannelPosts === 'function') await window.loadChannelPosts();
    } catch (e) {
      alert('Admin login failed. Please try again.');
    }
  };

  window.checkLogin = loginAndLoad;

  const autoLogin = async () => {
    const session = getSession();
    if (!session) return;
    const response = await originalFetch('/api/admin-auth', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ action:'verify', token:session })
    }).catch(() => null);
    const data = await response?.json?.().catch?.(() => ({}));
    if (!response?.ok || !data?.success) {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
      return;
    }
    const gate = document.getElementById('loginGate');
    if (gate) gate.style.display = 'none';
    try { if (typeof window.fetchAdminData === 'function') await window.fetchAdminData(); } catch (_) {}
    try { if (typeof window.fetchAdminLogs === 'function') await window.fetchAdminLogs(); } catch (_) {}
    try { if (typeof window.loadChannelPosts === 'function') await window.loadChannelPosts(); } catch (_) {}
  };

  document.addEventListener('DOMContentLoaded', autoLogin, { once:true });
  window.__MYFA_ADMIN_READY__ = true;
})();
</script>
`;
}

export default function handler(req, res) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'myfa.html');
    const html = fs.readFileSync(filePath, 'utf8');
    const runtime = buildRuntime();
    const injected = html.includes('</body>')
      ? html.replace('</body>', `${runtime}</body>`)
      : `${html}${runtime}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(injected);
  } catch (error) {
    console.error('[admin-shell]', error);
    return res.status(500).send('Admin panel unavailable');
  }
}
