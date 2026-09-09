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
      '/api/admin/verifications/action':'verifications/action',
      '/api/admin/test-channel':'test-channel',
      '/api/admin/invoice':'invoice',
      '/api/admin/backup':'backup',
      '/api/admin/wipe':'wipe',
      '/api/admin/css-inject':'css-inject',
      '/api/admin/broadcast':'broadcast',
      '/api/admin/logs':'logs'
    };
    return map[pathname] || null;
  };

  const gateway = async (target, body = {}) => {
    const session = getSession();
    if (!session) throw new Error('Admin session missing. Please log in again.');
    const headers = new Headers({ 'Content-Type':'application/json', 'X-MYFA-ADMIN-SESSION':session });
    const response = await originalFetch('/api/admin-gateway?target=' + encodeURIComponent(target), {
      method:'POST', headers, body:JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Admin request failed');
    return data;
  };

  const refreshAfterWrite = target => {
    if (['data','logs','backup'].includes(target)) return;
    setTimeout(async () => {
      try { if (typeof window.fetchAdminData === 'function') await window.fetchAdminData(); } catch (_) {}
      if (target === 'channel/post') {
        try { if (typeof window.loadChannelPosts === 'function') await window.loadChannelPosts(); } catch (_) {}
      }
    }, 0);
  };

  window.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : input?.url || '';
    let parsed;
    try { parsed = new URL(url, location.origin); } catch (_) { return originalFetch(input, init); }
    const pathname = parsed.pathname;
    if (!isAdminApi(pathname)) return originalFetch(input, init);

    const session = getSession();
    const target = routeTarget(pathname);
    if (!target) return originalFetch(input, init);
    if (!session) {
      return new Response(JSON.stringify({success:false,error:'Admin session missing. Please log in again.'}), {
        status:401, headers:{'Content-Type':'application/json'}
      });
    }

    const nextInit = { ...init, headers: new Headers(init.headers || {}) };
    nextInit.headers.set('X-MYFA-ADMIN-SESSION', session);
    if (target === 'config-update' && typeof nextInit.body === 'string') {
      try {
        const body = JSON.parse(nextInit.body);
        body.fullConfig = normalizeConfig(body.fullConfig);
        nextInit.body = JSON.stringify(body);
      } catch (_) {}
    }
    if (target === 'backup') nextInit.body = nextInit.body || '{}';

    const response = await originalFetch('/api/admin-gateway?target=' + encodeURIComponent(target), nextInit);
    if (!response.ok) {
      try {
        const err = await response.clone().json();
        if (err?.error) console.error('[admin]', err.error);
      } catch (_) {}
      return response;
    }
    refreshAfterWrite(target);
    return response;
  };

  window.fetchAdminData = async () => {
    const data = await gateway('data');
    window.globalData = data;
    try { if (typeof window.populateConfig === 'function') window.populateConfig(data.config || {}); } catch (_) {}
    try { if (typeof window.populateTasks === 'function') window.populateTasks(data.tasks || {}); } catch (_) {}
    try { if (typeof window.populateWithdrawals === 'function') window.populateWithdrawals(data.withdrawals || {}); } catch (_) {}
    try { if (typeof window.populateVerifications === 'function') window.populateVerifications(data.verifications || {}); } catch (_) {}
    const logBox = document.getElementById('admin_audit_logs') || document.getElementById('adminLogs');
    if (logBox) logBox.textContent = (data.adminLogs || []).join('\\n');
    return data;
  };

  window.fetchAdminLogs = async () => {
    const logs = await gateway('logs');
    const list = Array.isArray(logs) ? logs : (logs.adminLogs || []);
    const logBox = document.getElementById('admin_audit_logs') || document.getElementById('adminLogs');
    if (logBox) logBox.textContent = list.join('\\n');
    return list;
  };

  window.loadChannelPosts = async () => {
    try {
      const data = await gateway('data');
      const posts = Array.isArray(data.channelPosts) ? data.channelPosts : Object.values(data.channelPosts || {});
      window.channels = posts;
      if (typeof window.renderPosts === 'function') window.renderPosts(posts);
      return posts;
    } catch (_) { return []; }
  };

  const loginAndLoad = async () => {
    const username = String(document.getElementById('lUser')?.value || document.getElementById('loginUser')?.value || '').trim();
    const password = String(document.getElementById('lPass')?.value || document.getElementById('loginPass')?.value || '');
    try {
      const response = await originalFetch('/api/admin-auth', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action:'login',username,password})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.token) { alert(data.error || 'Invalid credentials'); return; }
      try { sessionStorage.setItem(SESSION_KEY, data.token); } catch (_) {}
      const gate = document.getElementById('loginGate'); if (gate) gate.style.display='none';
      const screen = document.getElementById('loginScreen'); if (screen) screen.classList.add('hidden');
      const app = document.getElementById('adminApp'); if (app) app.classList.remove('hidden');
      await refreshAll();
    } catch (e) { alert(e.message || 'Admin login failed. Please try again.'); }
  };

  async function refreshAll() {
    try { await window.fetchAdminData(); } catch (e) { console.error('Admin data refresh',e); }
    try { await window.fetchAdminLogs(); } catch (e) { console.error('Admin log refresh',e); }
    try { await window.loadChannelPosts(); } catch (e) { console.error('Channel refresh',e); }
  }

  window.checkLogin = loginAndLoad;

  const autoLogin = async () => {
    const session=getSession(); if(!session) return;
    const response=await originalFetch('/api/admin-auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'verify',token:session})}).catch(()=>null);
    const data=await response?.json?.().catch?.(()=>({}));
    if(!response?.ok || !data?.success){ try{sessionStorage.removeItem(SESSION_KEY);}catch(_){}; return; }
    const gate=document.getElementById('loginGate'); if(gate) gate.style.display='none';
    const screen=document.getElementById('loginScreen'); if(screen) screen.classList.add('hidden');
    const app=document.getElementById('adminApp'); if(app) app.classList.remove('hidden');
    await refreshAll();
  };

  document.addEventListener('DOMContentLoaded', autoLogin, {once:true});
  window.__MYFA_ADMIN_READY__=true;
})();
</script>
`;
}

export default function handler(req,res){
  try{
    const filePath=path.join(process.cwd(),'public','myfa.html');
    const html=fs.readFileSync(filePath,'utf8');
    const runtime=buildRuntime();
    const injected=html.includes('</body>')?html.replace('</body>',`${runtime}</body>`):`${html}${runtime}`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store, max-age=0, must-revalidate');
    return res.status(200).send(injected);
  }catch(error){
    console.error('[admin-shell]',error);
    return res.status(500).send('Admin panel unavailable');
  }
}
