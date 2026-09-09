import crypto from 'crypto';

const DB_URL = process.env.FIREBASE_DATABASE_URL || 'https://besh-81e22-default-rtdb.firebaseio.com';
const SESSION_KEY = process.env.ADMIN_SESSION_KEY || 'myfa-admin-session-v1-2026';
const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '';

async function db(path, method = 'GET', data) {
  const response = await fetch(`${DB_URL}/${path}.json`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data)
  });
  if (!response.ok) throw new Error(`database ${response.status}`);
  return response.json();
}
const get = path => db(path, 'GET');
const set = (path, value) => db(path, 'PUT', value);
const update = (path, value) => db(path, 'PATCH', value);
const remove = path => db(path, 'DELETE');

function sign(value) {
  return crypto.createHmac('sha256', SESSION_KEY).update(value).digest('base64url');
}
function verifyAdminSession(token) {
  try {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature) return false;
    const a = Buffer.from(signature), b = Buffer.from(sign(payload));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data?.sub === (process.env.ADMIN_USERNAME || 'admin') && Number(data.exp) > Date.now();
  } catch { return false; }
}
function addLog(user, text) {
  const logs = Array.isArray(user?.logs) ? [...user.logs] : [];
  logs.push(`[${new Date().toISOString()}] ${text}`);
  return logs.slice(-30);
}
function cleanCode(value) { return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''); }

async function adminData(res) {
  const data = await get('') || {};
  return res.json({
    config: data.config || {}, users: data.users || {}, tasks: data.bonusTasks || {},
    promos: data.promos || {}, withdrawals: data.withdrawals || {}, verifications: data.verifications || {},
    adminLogs: data.adminLogs || [], stats: data.stats || {}
  });
}

async function updateConfig(body, res) {
  const cfg = { ...(body.fullConfig || {}) };
  if (cfg.paymentApiUrl !== undefined) cfg.paymentApiEndpoint = String(cfg.paymentApiUrl || '');
  if (cfg.autoWithdrawDelay !== undefined) cfg.autoWithdrawDelayMinutes = Number(cfg.autoWithdrawDelay) || 0;
  if (cfg.withdrawChannelId !== undefined) cfg.withdrawalChannelId = String(cfg.withdrawChannelId || '');
  if (cfg.withdrawChannelUsername !== undefined) cfg.withdrawalChannelUsername = String(cfg.withdrawChannelUsername || '');
  if (cfg.notificationChannelId !== undefined) cfg.withdrawalChannelId = String(cfg.notificationChannelId || '');
  if (cfg.notificationChannelUsername !== undefined) cfg.withdrawalChannelUsername = String(cfg.notificationChannelUsername || '');
  if (cfg.telegramNotifEnabled !== undefined) cfg.enableWithdrawalNotification = !!cfg.telegramNotifEnabled;
  if (cfg.receiptGenEnabled !== undefined) cfg.receiptGenerationEnabled = !!cfg.receiptGenEnabled;
  if (cfg.spinRewardText !== undefined) cfg.spinRiggedReward = String(cfg.spinRewardText ?? '');
  if (cfg.monetagZoneId !== undefined) cfg.monetagZoneId = String(cfg.monetagZoneId || '').trim();
  const existing = await get('config') || {};
  const merged = { ...existing, ...cfg };
  await set('config', merged);
  await update('stats', { lastConfigUpdateAt: Date.now() });
  return res.json({ success: true, config: merged });
}

async function tasks(body, res) {
  const action = body.action, task = body.task || {};
  if (action === 'create') {
    const id = `task_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const record = {
      id, name: String(task.name || '').trim(), rewardType: task.rewardType || 'gems',
      reward: Number(task.reward || 0), url: String(task.url || '').trim(),
      channelId: String(task.channelId || task.url || '').trim(), icon: String(task.icon || 'fa-telegram'),
      type: task.type || 'auto', maxUsers: Math.max(0, Number(task.maxUsers || 0)), claims: 0,
      enabled: true, createdAt: Date.now()
    };
    if (!record.name || record.reward <= 0 || !record.url) return res.status(400).json({success:false,error:'Task name, reward and URL/channel are required'});
    await set(`bonusTasks/${id}`, record);
    return res.json({success:true, taskId:id, task:record});
  }
  if (action === 'delete') {
    const id = String(task.id || '');
    if (!id) return res.status(400).json({success:false,error:'Task ID required'});
    await remove(`bonusTasks/${id}`);
    return res.json({success:true,deleted:id});
  }
  if (action === 'toggle') {
    const id = String(task.id || '');
    const current = await get(`bonusTasks/${id}`);
    if (!current) return res.status(404).json({success:false,error:'Task not found'});
    const enabled = task.enabled !== undefined ? !!task.enabled : !Boolean(current.enabled);
    await update(`bonusTasks/${id}`, {enabled});
    return res.json({success:true,enabled});
  }
  return res.status(400).json({success:false,error:'Unsupported task action'});
}

async function promos(body, res) {
  const action = body.action;
  if (action === 'create') {
    const input = body.promo || {}, code = cleanCode(input.code);
    const reward = Math.floor(Number(input.reward || 0)), maxUses = Math.floor(Number(input.maxUses ?? input.limit ?? 0));
    if (!code || code.length < 2 || code.length > 64) return res.status(400).json({success:false,error:'Enter a valid promo code'});
    if (reward <= 0) return res.status(400).json({success:false,error:'Reward must be greater than zero'});
    if (maxUses <= 0) return res.status(400).json({success:false,error:'Usage limit must be greater than zero'});
    const promos = await get('promos') || {};
    if (Object.keys(promos).some(key => cleanCode(key) === code)) return res.status(409).json({success:false,error:'Promo code already exists'});
    const promo = {code,reward,maxUses,limit:maxUses,uses:0,createdAt:Date.now()};
    await set(`promos/${code}`, promo);
    await update('stats',{lastPromoCreatedAt:Date.now()});
    return res.json({success:true,promo});
  }
  if (action === 'delete') {
    const code = cleanCode(body.code);
    if (!code) return res.status(400).json({success:false,error:'Promo code required'});
    const promos = await get('promos') || {};
    const key = Object.keys(promos).find(k => cleanCode(k) === code);
    if (!key) return res.status(404).json({success:false,error:'Promo not found'});
    await remove(`promos/${key}`);
    return res.json({success:true,deleted:key});
  }
  return res.status(400).json({success:false,error:'Unsupported promo action'});
}

async function userAction(body, res) {
  const userId = String(body.userId || '');
  if (!userId) return res.status(400).json({success:false,error:'User ID required'});
  const u = await get(`users/${userId}`);
  if (!u) return res.status(404).json({success:false,error:'User not found'});
  const value = Number(body.value || 0);
  if (body.action === 'add-balance') {
    const next = Number(u.points || 0) + value;
    await update(`users/${userId}`,{points:next,logs:addLog(u,`Admin added ${value} Gems`)});
    return res.json({success:true,points:next});
  }
  if (body.action === 'deduct-balance') {
    const next = Math.max(0,Number(u.points||0)-Math.abs(value));
    await update(`users/${userId}`,{points:next,logs:addLog(u,`Admin deducted ${Math.abs(value)} Gems`)});
    return res.json({success:true,points:next});
  }
  if (body.action === 'reset-ads') {
    await update(`users/${userId}`,{monetagWatchedToday:0,adsgramWatchedToday:0,adsterraWatchedToday:0,myfaAdsWatchedToday:0,logs:addLog(u,'Admin reset daily ad limits')});
    return res.json({success:true});
  }
  if (body.action === 'toggle-ban') {
    const banned = !Boolean(u.isBanned);
    await update(`users/${userId}`,{isBanned:banned,logs:addLog(u,`Admin ${banned?'banned':'unbanned'} user`)});
    return res.json({success:true,isBanned:banned});
  }
  if (body.action === 'toggle-vip') {
    const vip = !Boolean(u.isVip);
    await update(`users/${userId}`,{isVip:vip,logs:addLog(u,`Admin ${vip?'enabled':'disabled'} VIP`)});
    return res.json({success:true,isVip:vip});
  }
  return res.status(400).json({success:false,error:'Unsupported user action'});
}

async function withdrawals(body, res) {
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) return res.status(400).json({success:false,error:'Select at least one withdrawal'});
  const action = body.action, results=[];
  for (const id of ids) {
    const w = await get(`withdrawals/${id}`);
    if (!w || w.status !== 'pending') continue;
    if (action === 'approve') {
      await update(`withdrawals/${id}`,{status:'approved',approvedAt:Date.now()});
      results.push({id,status:'approved'});
    } else if (action === 'reject') {
      const u=await get(`users/${w.userId}`);
      if(u) await update(`users/${w.userId}`,{realBalance:Number(u.realBalance||0)+Number(w.amount||0),logs:addLog(u,`Withdrawal ${id} rejected; funds returned`)});
      await update(`withdrawals/${id}`,{status:'rejected',rejectionReason:body.reason||'Rejected by admin',rejectedAt:Date.now()});
      results.push({id,status:'rejected'});
    }
  }
  return res.json({success:true,results});
}

async function channelPost(body,res){
  const action=body.action; let posts=await get('channelPosts')||[];
  if(!Array.isArray(posts)) posts=Object.values(posts);
  if(action==='create'){
    const p=body.post||{}, record={id:Date.now().toString(),text:String(p.text||''),reactions:p.reactions||{},date:Date.now()};
    if(!record.text.trim()) return res.status(400).json({success:false,error:'Post text is required'});
    posts.push(record);
  }else{
    const id=String(body.id||''), i=posts.findIndex(p=>String(p.id)===id);
    if(i<0) return res.status(404).json({success:false,error:'Post not found'});
    if(action==='update_reactions') posts[i]={...posts[i],reactions:body.post?.reactions||{}};
    else if(action==='delete') posts.splice(i,1);
    else return res.status(400).json({success:false,error:'Unsupported channel action'});
  }
  await set('channelPosts',posts); return res.json({success:true});
}

async function verificationAction(body,res){
  const id=String(body.id||''), action=String(body.action||'');
  const v=await get(`verifications/${id}`);
  if(!v) return res.status(404).json({success:false,error:'Verification not found'});
  if(action!=='approve'&&action!=='reject') return res.status(400).json({success:false,error:'Unsupported verification action'});
  if(action==='reject'){
    await update(`verifications/${id}`,{status:'rejected',rejectedAt:Date.now()});
    return res.json({success:true});
  }
  const userId=String(v.userId||''), taskId=String(v.taskId||'');
  const u=await get(`users/${userId}`), t=await get(`bonusTasks/${taskId}`);
  if(!u||!t) return res.status(404).json({success:false,error:'Verification task or user not found'});
  const reward=Number(t.reward||0);
  if((u.claimedBonuses||[]).includes(taskId)){
    await update(`verifications/${id}`,{status:'approved',approvedAt:Date.now(),reward:0});
    return res.json({success:true,reward:0});
  }
  await update(`users/${userId}`,{points:Number(u.points||0)+reward,claimedBonuses:[...(u.claimedBonuses||[]),taskId],logs:addLog(u,`Admin approved task ${t.name||taskId} (+${reward} Gems)`) });
  await update(`bonusTasks/${taskId}`,{claims:Number(t.claims||0)+1});
  await update(`verifications/${id}`,{status:'approved',approvedAt:Date.now(),reward});
  return res.json({success:true,reward});
}

async function testChannel(body,res){
  const channelId=String(body.channelId||'').trim();
  if(!channelId) return res.status(400).json({success:false,error:'Channel ID is required'});
  if(!BOT_TOKEN) return res.status(500).json({success:false,error:'Telegram bot token is not configured on the server'});
  const r=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(channelId)}&user_id=${encodeURIComponent(BOT_TOKEN.split(':')[0])}`);
  const d=await r.json().catch(()=>({}));
  if(!d.ok) return res.status(400).json({success:false,error:d.description||'Telegram channel check failed'});
  return res.json({success:true,status:d.result?.status||'unknown'});
}

async function invoice(body,res){
  const userId=String(body.userId||''), amount=Math.max(1,Math.floor(Number(body.amount||0)));
  if(!userId||!amount) return res.status(400).json({success:false,error:'User and Stars amount are required'});
  if(!BOT_TOKEN) return res.status(500).json({success:false,error:'Telegram bot token is not configured on the server'});
  const title=String(body.title||'MYFA BIRR Payment').slice(0,32), description=String(body.description||'MYFA BIRR Stars invoice').slice(0,255);
  const payload=`myfa:${userId}:${Date.now()}`;
  const r=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,description,payload,currency:'XTR',prices:[{label:title,amount}]} )});
  const d=await r.json().catch(()=>({}));
  if(!d.ok) return res.status(400).json({success:false,error:d.description||'Could not create invoice'});
  const m=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:userId,text:`⭐ Payment request\n\n${title}\nAmount: ${amount} Telegram Stars\n\nTap the button below to pay.`,reply_markup:{inline_keyboard:[[ {text:`Pay ${amount} ⭐`,url:d.result} ]]}})});
  const md=await m.json().catch(()=>({}));
  if(!md.ok) return res.status(400).json({success:false,error:md.description||'Invoice created but could not be sent'});
  return res.json({success:true,invoice:d.result});
}

async function backup(res){ return res.json(await get('')||{}); }

async function wipe(res){
  await set('users',{}); await set('withdrawals',{});
  return res.json({success:true});
}

async function cssInject(body,res){
  const css=String(body.css||'');
  await set('globalCSS',{css,timestamp:Date.now()});
  return res.json({success:true});
}

async function broadcast(body,res){
  const text=String(body.text||body.message||'').trim();
  if(!text) return res.status(400).json({success:false,error:'Broadcast text is required'});
  await set('toastBroadcast',{id:Date.now(),text});
  return res.json({success:true});
}

async function deleteCampaign(body,res){
  const id=String(body.campaignId||'');
  if(!id) return res.status(400).json({success:false,error:'Campaign ID required'});
  const c=await get(`campaigns/${id}`);
  if(!c) return res.status(404).json({success:false,error:'Campaign not found'});
  const ownerId=String(c.ownerId||c.userId||'');
  const u=await get(`users/${ownerId}`);
  let refund=0;
  if(c.schemaVersion===2) refund=Math.max(0,Number(c.adBudgetRemaining||0)+Number(c.taskBudgetRemaining||0));
  else refund=Math.max(0,(Number(c.maxUsers||0)-Number(c.claims||0))*Number(c.reward||0));
  if(u&&refund>0){
    await update(`users/${ownerId}`,{points:Number(u.points||0)+refund,stuckBalance:Math.max(0,Number(u.stuckBalance||0)-refund),campaignReserved:Math.max(0,Number(u.campaignReserved||0)-refund),logs:addLog(u,`Deleted campaign ${id}; refunded ${refund} Gems`)});
  }
  await remove(`campaigns/${id}`);
  return res.json({success:true,refunded:refund});
}

export default async function handler(req,res){ 
  res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return res.status(405).json({success:false,error:'Method not allowed'});
  if(!verifyAdminSession(req.headers['x-myfa-admin-session'])) return res.status(401).json({success:false,error:'Admin session expired. Please log in again.'});
  const target=String(req.query.target||'').replace(/^\/+|\/+$/g,''); const body=req.body||{};
  try{
    if(target==='data') return adminData(res);
    if(target==='config-update') return updateConfig(body,res);
    if(target==='tasks') return tasks(body,res);
    if(target==='promos') return promos(body,res);
    if(target==='user-action') return userAction(body,res);
    if(target==='withdrawals') return withdrawals(body,res);
    if(target==='channel/post') return channelPost(body,res);
    if(target==='verifications/action') return verificationAction(body,res);
    if(target==='test-channel') return testChannel(body,res);
    if(target==='invoice') return invoice(body,res);
    if(target==='backup') return backup(res);
    if(target==='wipe') return wipe(res);
    if(target==='css-inject') return cssInject(body,res);
    if(target==='broadcast') return broadcast(body,res);
    if(target==='campaign/delete') return deleteCampaign(body,res);
    if(target==='logs') return res.json((await get('adminLogs'))||[]);
    return res.status(404).json({success:false,error:`Unknown admin target: ${target}`});
  }catch(e){
    console.error('[admin-gateway]',e);
    return res.status(500).json({success:false,error:e.message||'Admin operation failed'});
  }
}
