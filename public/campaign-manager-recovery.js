(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const num = v => Number(v || 0).toLocaleString();
const getId = () => String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || new URLSearchParams(location.search).get('userId') || '');
const state = { id:'', user:{points:0}, campaigns:[], view:'dashboard', filter:'all', query:'', createMode:'advertisement' };
async function api(path, options={}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const r = await fetch(path, { ...options, signal: controller.signal, headers:{'Content-Type':'application/json', ...(options.headers||{})} });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
    return d;
  } finally { clearTimeout(timer); }
}
function setLoading(text='') {
  const c = $('#aspContent');
  if (!c) return;
  c.innerHTML = `<div class="asp-loading-shell"><div class="asp-loading-mark"><span></span><span></span><span></span></div><div><strong>${esc(text || 'Loading MYFA Campaign Manager')}</strong><span>Connecting to the MYFA BIRR campaign backend…</span></div></div>`;
}
function shellNav() {
  const items = [
    ['dashboard','Home','fa-house'],['create','Create','fa-plus'],['campaigns','Manage','fa-layer-group'],['analytics','Statistics','fa-chart-line'],['wallet','Wallet','fa-wallet']
  ];
  return `<nav class="cm-recovery-nav">${items.map(([k,l,i]) => `<button type="button" data-rview="${k}" class="${state.view===k?'active':''}"><i class="fa-solid ${i}"></i><span>${l}</span></button>`).join('')}</nav>`;
}
function home() {
  const active = state.campaigns.filter(c=>c.status==='active').length;
  const impressions = state.campaigns.reduce((n,c)=>n+Number(c.impressions||0),0);
  const conversions = state.campaigns.reduce((n,c)=>n+Number(c.conversions||0),0);
  const reserved = state.campaigns.reduce((n,c)=>n+Number(c.budgetState?.remaining||0),0);
  return `${shellNav()}<section class="asp-hero"><div><span class="asp-eyebrow"><i class="fa-solid fa-bolt"></i> CAMPAIGN CONTROL</span><h1>Welcome back.</h1><p class="asp-copy">Your Campaign Manager is connected. Campaign state and Gem balances are loaded from the MYFA BIRR backend.</p></div><button class="asp-primary" data-rcreate="advertisement"><i class="fa-solid fa-plus"></i> Create campaign</button></section><div class="asp-stats"><div class="asp-stat"><strong>${active}</strong><span>Active</span></div><div class="asp-stat"><strong>${num(impressions)}</strong><span>Impressions</span></div><div class="asp-stat"><strong>${num(conversions)}</strong><span>Conversions</span></div><div class="asp-stat"><strong>${num(reserved)}</strong><span>Reserved Gems</span></div></div><section class="asp-section"><div class="asp-section-head"><div><small>Connected data</small><h2>Your campaigns</h2></div><button class="asp-secondary" data-rview="campaigns">Manage all</button></div>${state.campaigns.slice(0,4).map(card).join('') || '<div class="asp-empty"><b>No campaigns yet</b><span>Create the first campaign using the real Firebase-backed flow.</span><button class="asp-primary" data-rcreate="advertisement">Create campaign</button></div>'}</section>`;
}
function create() {
  const mode = state.createMode;
  const ad = mode !== 'task', task = mode !== 'advertisement';
  return `${shellNav()}<section class="asp-title"><span>CAMPAIGN BUILDER</span><h1>Create a real campaign.</h1><p class="asp-copy">Choose a campaign type, enter the details, and the server will validate and reserve Gems before launch.</p></section><section class="asp-builder-card"><div class="cm-recovery-types"><button class="${mode==='advertisement'?'active':''}" data-rmode="advertisement"><i class="fa-solid fa-rectangle-ad"></i><strong>Advertisement</strong><small>Paid reach</small></button><button class="${mode==='task'?'active':''}" data-rmode="task"><i class="fa-solid fa-list-check"></i><strong>Sponsored Task</strong><small>Reward action</small></button><button class="${mode==='hybrid'?'active':''}" data-rmode="hybrid"><i class="fa-solid fa-bullseye"></i><strong>Ad + Task</strong><small>Reach + action</small></button></div><form id="cmRecoveryForm"><div class="asp-form-grid"><label class="asp-field-pro">Campaign name<input name="name" required maxlength="80"></label><label class="asp-field-pro">Destination URL<input name="link" type="url" ${ad?'required':''} placeholder="https://example.com"></label></div>${ad?`<div class="asp-form-grid"><label class="asp-field-pro">Creative image URL<input name="imageUrl" type="url"></label><label class="asp-field-pro">Video URL<input name="videoUrl" type="url"></label><label class="asp-field-pro">Headline<input name="headline" maxlength="100"></label><label class="asp-field-pro">Call to action<input name="cta" maxlength="32" value="Visit Now"></label><label class="asp-field-pro">Impression budget<input name="impressionBudget" type="number" min="1" value="1000"></label><label class="asp-field-pro">Daily budget<input name="dailyBudget" type="number" min="0" value="0"></label></div>`:''}${task?`<div class="asp-form-grid"><label class="asp-field-pro">Target users<input name="maxUsers" type="number" min="1" value="100"></label><label class="asp-field-pro">Reward per user<input name="reward" type="number" min="1" value="50"></label><label class="asp-field-pro">Verification<select name="taskType"><option value="auto">Automatic Telegram</option><option value="manual">Manual proof</option></select></label><label class="asp-field-pro">Telegram channel ID<input name="channelId" placeholder="-100... or @channel"></label></div><label class="asp-field-pro">Task instructions<textarea name="taskDesc" rows="4"></textarea></label>`:''}<div class="asp-form-grid"><label class="asp-field-pro">Countries<input name="countries" placeholder="ET,US"></label><label class="asp-field-pro">Devices<select name="devices"><option value="all">All</option><option value="android">Android</option><option value="ios">iOS</option><option value="web">Web</option></select></label><label class="asp-field-pro">Frequency cap / day<input name="frequencyCap" type="number" min="0" value="0"></label></div><div class="cm-recovery-checks"><label><input type="checkbox" name="fraudProtection" checked> Fraud protection</label><label><input type="checkbox" name="abEnabled" checked> A/B rotation</label></div><div class="cm-bottom-action"><span><i class="fa-solid fa-shield-halved"></i> Server validation + Gem reservation</span><button class="asp-primary" type="submit"><i class="fa-solid fa-lock"></i> Reserve & Launch</button></div></form></section>`;
}
function card(c) {
  const remain = Number(c.budgetState?.remaining || c.budgetRemaining || 0);
  const total = Number(c.budgetState?.total || c.budgetTotal || remain);
  const used = Math.max(0,total-remain), pct = total ? Math.min(100,used/total*100) : 0;
  return `<article class="asp-card cm-recovery-card"><div class="asp-body"><div class="asp-row"><b>${esc(c.name || 'Untitled campaign')}</b><span class="asp-tag">${esc(String(c.mode||'advertisement').toUpperCase())}</span></div><p>${esc(c.desc || 'No description')}</p><div class="asp-metrics"><span><i class="fa-solid fa-eye"></i>${num(c.impressions)}</span><span><i class="fa-solid fa-arrow-pointer"></i>${num(c.clicks)}</span><span><i class="fa-solid fa-bullseye"></i>${num(c.conversions)}</span><span><i class="fa-solid fa-gem"></i>${num(remain)}</span></div><div class="asp-progress"><span style="width:${pct}%"></span></div><div class="asp-row"><small>${esc(c.status || 'active')}</small><button class="asp-secondary" data-rmanage="${esc(c.id)}">Manage <i class="fa-solid fa-chevron-right"></i></button></div></div></article>`;
}
function manageList() {
  let list = state.campaigns.slice();
  if (state.query) list = list.filter(c => `${c.name} ${c.desc||''}`.toLowerCase().includes(state.query.toLowerCase()));
  return `${shellNav()}<section class="asp-title"><span>CAMPAIGN INVENTORY</span><h1>Manage your campaigns.</h1></section><div class="cm-recovery-toolbar"><input id="cmRSearch" value="${esc(state.query)}" placeholder="Search campaigns"><button class="asp-secondary" data-rview="create"><i class="fa-solid fa-plus"></i> Create</button></div><section class="asp-list">${list.map(card).join('') || '<div class="asp-empty"><b>No matching campaigns</b><span>Create a campaign or change your search.</span></div>'}</section>`;
}
function stats() {
  const i=state.campaigns.reduce((n,c)=>n+Number(c.impressions||0),0), c=state.campaigns.reduce((n,x)=>n+Number(x.clicks||0),0), v=state.campaigns.reduce((n,x)=>n+Number(x.conversions||0),0), s=state.campaigns.reduce((n,x)=>n+Number(x.spend||0),0);
  const ctr=i?(c/i*100).toFixed(2):'0.00', cr=i?(v/i*100).toFixed(2):'0.00';
  return `${shellNav()}<section class="asp-title"><span>STATISTICS</span><h1>Campaign performance.</h1><p class="asp-copy">Metrics are calculated from campaign records returned by the backend.</p></section><div class="asp-stats"><div class="asp-stat"><strong>${num(i)}</strong><span>Impressions</span></div><div class="asp-stat"><strong>${num(c)}</strong><span>Clicks</span></div><div class="asp-stat"><strong>${ctr}%</strong><span>CTR</span></div><div class="asp-stat"><strong>${cr}%</strong><span>Conversion rate</span></div></div><section class="asp-section"><div class="asp-section-head"><div><small>Spend</small><h2>Recorded delivery</h2></div></div><div class="cm-note"><i class="fa-solid fa-gem"></i> ${num(s)} Gems recorded as campaign spend.</div></section>`;
}
function wallet() {
  const available=Number(state.user?.points||0), reserved=state.campaigns.reduce((n,c)=>n+Number(c.budgetState?.remaining||0),0), spend=state.campaigns.reduce((n,c)=>n+Number(c.spend||0),0);
  return `${shellNav()}<section class="asp-title"><span>WALLET</span><h1>Your campaign balance.</h1><p class="asp-copy">Values below are read from the current user and campaign backend state.</p></section><div class="asp-stats"><div class="asp-stat"><strong>${num(available)}</strong><span>Available Gems</span></div><div class="asp-stat"><strong>${num(reserved)}</strong><span>Reserved</span></div><div class="asp-stat"><strong>${num(spend)}</strong><span>Spent</span></div><div class="asp-stat"><strong>${num(available+reserved)}</strong><span>Available + reserved</span></div></div>`;
}
function manage(c) {
  const remain=Number(c.budgetState?.remaining||0);
  return `<div class="cm-recovery-modal"><button class="asp-modal-close" data-rclose><i class="fa-solid fa-xmark"></i></button><span class="asp-eyebrow">${esc(String(c.mode||'campaign').toUpperCase())} • ${esc(String(c.status||'active').toUpperCase())}</span><h2>${esc(c.name||'Campaign')}</h2><p class="asp-copy">Real campaign controls. Changes are sent to the server and persist to Firebase.</p><div class="cm-action-grid"><button data-raction="toggle" data-id="${esc(c.id)}"><i class="fa-solid fa-pause"></i> ${c.status==='paused'?'Resume':'Pause'}</button><button data-raction="validate" data-id="${esc(c.id)}"><i class="fa-solid fa-link"></i> Validate URL</button><button data-raction="duplicate" data-id="${esc(c.id)}"><i class="fa-solid fa-copy"></i> Duplicate</button><button data-raction="refund" data-id="${esc(c.id)}"><i class="fa-solid fa-rotate-left"></i> Refund ${num(remain)}</button></div><div class="cm-note"><i class="fa-solid fa-circle-info"></i> ${num(remain)} Gems currently reserved for this campaign.</div></div>`;
}
function render() {
  const c=$('#aspContent'); if(!c) return;
  if(state.view==='dashboard') c.innerHTML=home();
  if(state.view==='create') c.innerHTML=create();
  if(state.view==='campaigns') c.innerHTML=manageList();
  if(state.view==='analytics') c.innerHTML=stats();
  if(state.view==='wallet') c.innerHTML=wallet();
  bind();
}
async function hydrate() {
  if(!state.id){ render(); throw new Error('Telegram user session not found. Open this page inside the Telegram Mini App.'); }
  try {
    const d = await api(`/api/campaign-manager/dashboard/${encodeURIComponent(state.id)}`);
    state.user=d.user||{points:0}; state.campaigns=Array.isArray(d.campaigns)?d.campaigns:[]; 
    const bal=$('#aspBalance'); if(bal) bal.textContent=num(state.user.points);
    render();
  } catch (e) {
    const c=$('#aspContent');
    c.innerHTML=`${shellNav()}<section class="asp-empty cm-recovery-error"><i class="fa-solid fa-triangle-exclamation"></i><b>Campaign Manager could not connect</b><span>${esc(e.message)}</span><div><button class="asp-primary" data-rretry><i class="fa-solid fa-rotate"></i> Retry</button><button class="asp-secondary" data-rhome><i class="fa-solid fa-house"></i> Open Home</button></div></section>`;
    bind();
  }
}
function bind(){
  $$('#aspContent [data-rview]').forEach(b=>b.onclick=()=>{state.view=b.dataset.rview;render()});
  $$('#aspContent [data-rcreate]').forEach(b=>b.onclick=()=>{state.view='create';state.createMode=b.dataset.rcreate||'advertisement';render()});
  $$('#aspContent [data-rmode]').forEach(b=>b.onclick=()=>{state.createMode=b.dataset.rmode;render()});
  const search=$('#cmRSearch'); if(search) search.oninput=()=>{state.query=search.value;render()};
  $$('#aspContent [data-rmanage]').forEach(b=>b.onclick=()=>{const c=state.campaigns.find(x=>x.id===b.dataset.rmanage);if(c){const m=$('#aspModal');m.innerHTML=manage(c);m.classList.add('open');m.setAttribute('aria-hidden','false')}});
  $$('#aspContent [data-rretry]').forEach(b=>b.onclick=()=>{setLoading('Reconnecting…');hydrate()});
  $$('#aspContent [data-rhome]').forEach(b=>b.onclick=()=>{state.view='dashboard';render()});
  const form=$('#cmRecoveryForm'); if(form) form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button[type=submit]');if(b){b.disabled=true;b.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Launching…'}const d=Object.fromEntries(new FormData(form));try{const r=await api('/api/campaign-manager/campaigns',{method:'POST',body:JSON.stringify({userId:state.id,mode:state.createMode,name:d.name,link:d.link,imageUrl:d.imageUrl,videoUrl:d.videoUrl,headline:d.headline,cta:d.cta,description:d.description,impressionBudget:Number(d.impressionBudget||0),dailyBudget:Number(d.dailyBudget||0),maxUsers:Number(d.maxUsers||0),reward:Number(d.reward||0),taskType:d.taskType,channelId:d.channelId,taskDesc:d.taskDesc,countries:d.countries,devices:d.devices,frequencyCap:Number(d.frequencyCap||0),fraudProtection:d.fraudProtection==='on',abEnabled:d.abEnabled==='on'})});state.user=r.user||state.user;state.campaigns=r.campaigns||state.campaigns;state.view='campaigns';render();}catch(err){alert(err.message)}finally{if(b){b.disabled=false;b.innerHTML='<i class="fa-solid fa-lock"></i> Reserve & Launch'}}};
  $$('#aspContent [data-raction]').forEach(b=>b.onclick=async()=>{const id=b.dataset.id;try{if(b.dataset.raction==='validate'){const c=state.campaigns.find(x=>x.id===id);if(!c?.link)return alert('This campaign has no destination URL.');try{new URL(c.link);alert('Destination URL is valid.')}catch{alert('Destination URL is invalid.')}return}const r=await api(`/api/campaign-manager/campaigns/${encodeURIComponent(id)}/action`,{method:'POST',body:JSON.stringify({userId:state.id,action:b.dataset.raction})});if(r.campaigns)state.campaigns=r.campaigns;if(r.user)state.user=r.user;$('#aspModal').classList.remove('open');render();}catch(e){alert(e.message)}});
  const modal=$('#aspModal'); if(modal) $$('#aspModal [data-rclose]').forEach(b=>b.onclick=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true')});
}
function start(){
  if(!$('#aspContent')) return;
  state.id=getId();
  try { render(); } catch (e) { setLoading('Preparing Campaign Manager…'); }
  hydrate();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
