/*CMD
  command: script.js
  help: MYFA BIRR WebApp JavaScript
  need_reply:
  auto_retry_time:
  folder: MYFA WEBAPP
  answer:
  keyboard:
  aliases:
  group:
CMD*/
(function(){
'use strict';
const tg=window.Telegram?.WebApp; if(tg){tg.ready();tg.expand();try{tg.setHeaderColor('#0a0a1f');tg.setBackgroundColor('#090b18');}catch(e){}}
const API=(window.MYFA_CONFIG&&window.MYFA_CONFIG.apiUrl)||'';
let app={user:null,config:{},tasks:[],campaigns:[],leaderboard:[],page:'home'};
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2200)}
function money(v){return Number(v||0).toFixed(2)}
async function api(action,extra={}){
  if(!API) throw new Error('BB webhook URL missing');
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({action,refParam:window.MYFA_CONFIG?.ref||''},extra))});
  if(!r.ok) throw new Error('Backend HTTP '+r.status);
  const d=await r.json(); if(!d.ok) throw new Error(d.error||'Request failed'); return d;
}
function setHeader(){
 const u=app.user||{};$('#name').textContent=u.accountName||u.username||'User';$('#status').textContent=u.isVip?'VIP Member':'Member';$('#points').textContent=Math.floor(Number(u.points||0)).toLocaleString();$('#cash').textContent=money(u.realBalance);
 const fallback='https://ui-avatars.com/api/?name='+encodeURIComponent(u.accountName||u.username||'User')+'&background=00A8FF&color=fff';$('#avatar').src=u.avatarUrl||tg?.initDataUnsafe?.user?.photo_url||fallback;
}
function nav(page){app.page=page;document.querySelectorAll('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav===page));render();window.scrollTo(0,0)}
function card(html){return `<section class="card glass">${html}</section>`}
function render(){
 if(!app.user)return;let c=$('#content');
 if(app.page==='home')c.innerHTML=home();
 else if(app.page==='tasks')c.innerHTML=tasksPage();
 else if(app.page==='games')c.innerHTML=gamesPage();
 else if(app.page==='withdraw')c.innerHTML=withdrawPage();
 else c.innerHTML=morePage();
 setHeader();
}
function home(){
 const u=app.user;const todayClaim=u.dailyClaimDate===new Date().toISOString().slice(0,10);return `
 <div class="hero"><h1>MYFA BIRR 💎</h1><p>Earn gems, complete tasks, play games and withdraw rewards.</p><button class="btn gold" onclick="daily()" ${todayClaim?'disabled':''}>${todayClaim?'✅ Daily Claimed':'🎁 Claim Daily Reward'}</button></div>
 <div class="grid">${card(`<div class="stat">${Math.floor(u.points||0).toLocaleString()}</div><div class="muted">Gems</div>`)}${card(`<div class="stat">$${money(u.realBalance)}</div><div class="muted">Cash Balance</div>`)}${card(`<div class="stat">${(u.referredUsers||[]).length}</div><div class="muted">Referrals</div>`)}${card(`<div class="stat">${u.adsWatchedToday||0}</div><div class="muted">Ads Today</div>`)}</div>
 ${card(`<div class="section-title"><h2>Quick Earn</h2><span class="pill">LIVE</span></div><div class="grid"><button class="btn" onclick="nav('tasks')">✅ Tasks</button><button class="btn" onclick="nav('games')">🎮 Games</button><button class="btn" onclick="nav('withdraw')">💸 Withdraw</button><button class="btn" onclick="nav('more')">👥 Invite</button></div>`)}
 ${card(`<div class="section-title"><h2>Top Earners</h2><span class="muted">Top 10</span></div>${(app.leaderboard||[]).slice(0,10).map((x,i)=>`<div class="list-item"><span>#${i+1} ${esc(x.name)}</span><b>${Math.floor(x.points||0).toLocaleString()} 💎</b></div>`).join('')||'<div class="muted">No leaderboard data yet.</div>'}`)}
 `}
function tasksPage(){return `<div class="section-title"><h2>Tasks</h2><span class="pill">${app.tasks.length}</span></div>${app.tasks.map(t=>{const done=(app.user.claimedTasks||[]).includes(String(t.id));return card(`<div class="section-title"><h3>${esc(t.title)}</h3><span class="pill">+${Number(t.reward||0)} 💎</span></div><p class="muted">${esc(t.description||'Complete this task to earn gems.')}</p>${t.url?`<button class="btn dark" onclick="window.open('${esc(t.url)}','_blank')">Open Task</button>`:''}<button class="btn green" onclick="claimTask('${esc(t.id)}')" ${done?'disabled':''}>${done?'✅ Claimed':'Claim Reward'}</button>`) }).join('')||card('<p class="muted">No active tasks.</p>')}`}
function gamesPage(){return `<div class="section-title"><h2>Games</h2><span class="pill">5 GAMES</span></div>${card(`<h3>✈️ Aviator</h3><p class="muted">Risk gems and choose a cashout multiplier.</p><input id="aviStake" class="field" type="number" min="1" value="10" placeholder="Stake"><input id="aviTarget" class="field" type="number" step="0.01" min="1.01" value="1.50" placeholder="Target multiplier"><button class="btn" onclick="playAviator()">Fly & Cash Out</button>`)}${card(`<h3>💎 Drop</h3><p class="muted">Tap the board for 10 seconds. Your score is server-capped.</p><div id="dropBoard" class="game-board"><div id="dropScore" class="big-number">0</div></div><button class="btn green" onclick="startDrop()">Start Drop</button>`)}${card(`<h3>🐂 Multi Ox</h3><p class="muted">Pick one ox. The server draws the result.</p><div class="grid grid3">${['A','B','C','D','E'].map(x=>`<button class="btn" onclick="multiOx('${x}')">Ox ${x}</button>`).join('')}</div>`)}${card(`<h3>✏️ Sketch Guess</h3><p class="muted">The server chooses a word. Pick your answer.</p><div class="grid">${['cat','car','house','tree','phone'].map(x=>`<button class="btn dark" onclick="sketch('${x}')">${x}</button>`).join('')}</div>`)}${card(`<h3>🎯 Daily Combo</h3><p class="muted">Choose 3 symbols. Exact match wins.</p><div id="comboPick" class="grid grid3"></div><button class="btn gold" onclick="dailyCombo()">Try Combo</button>`)} `}
function withdrawPage(){return `<div class="section-title"><h2>Withdraw</h2><span class="pill">$${money(app.user.realBalance)}</span></div>${card(`<p class="muted">Minimum withdrawal: $${money(app.config.minWithdraw||1)}</p><input id="wdAmount" class="field" type="number" step="0.01" min="0" placeholder="Amount"><select id="wdMethod" class="field"><option>Telebirr</option><option>CBE Birr</option><option>Bank</option><option>Crypto</option></select><input id="wdAccount" class="field" placeholder="Account / wallet"><button class="btn green" onclick="withdrawCreate()">Submit Withdrawal</button>`)}${card(`<div class="section-title"><h3>My Requests</h3><button class="btn dark" style="width:auto" onclick="loadWithdrawals()">Refresh</button></div><div id="withdrawList"><div class="muted">Loading...</div></div>`)} `}
function morePage(){return `<div class="section-title"><h2>More</h2><span class="pill">MYFA</span></div>${card(`<h3>👥 Invite & Earn</h3><p class="muted">Share your referral link and earn cash when friends join.</p><input id="refLink" class="field" readonly value="${esc('https://t.me/'+(tg?.initDataUnsafe?.user?'MYFA_BIRR_BOT':'MYFA_BIRR_BOT')+'?start=ref'+(app.user.telegramId||tg?.initDataUnsafe?.user?.id||''))}"><button class="btn" onclick="copyRef()">Copy Referral Link</button>`)}${card(`<h3>📺 Watch Ads</h3><p class="muted">Ad rewards are limited daily and tracked by the BB backend.</p>${app.campaigns.slice(0,10).map(a=>`<div class="list-item"><span>${esc(a.title)}<br><small class="muted">+${a.reward} 💎</small></span><button class="btn green" style="width:auto" onclick="openAd('${esc(a.id)}','${esc(a.url)}')">Watch</button></div>`).join('')||'<div class="muted">No ad campaigns right now.</div>'}`)}${card(`<h3>📊 Leaderboard</h3>${app.leaderboard.map((x,i)=>`<div class="list-item"><span>#${i+1} ${esc(x.name)}</span><b>${Math.floor(x.points||0).toLocaleString()} 💎</b></div>`).join('')}`)}${card(`<h3>⚙️ Settings</h3><select id="lang" class="field"><option value="EN">English</option><option value="AM">አማርኛ</option></select><select id="theme" class="field"><option value="dark">Dark</option><option value="light">Light</option></select><button class="btn" onclick="saveSettings()">Save Settings</button>`)}${card(`<h3>❓ How MYFA Works</h3><p class="muted">Earn from tasks, ads and games. Gems can be converted through the configured withdrawal flow. Never share your account or payment details with untrusted people.</p>`)}${card(`<h3>📣 Create Ad</h3><input id="adTitle" class="field" placeholder="Ad title"><input id="adUrl" class="field" placeholder="Destination URL"><input id="adReward" class="field" type="number" placeholder="Reward gems"><input id="adBudget" class="field" type="number" placeholder="Budget"><button class="btn" onclick="createAd()">Create Campaign</button>`)}${card(`<h3>🛠 Admin</h3><input id="adminUid" class="field" placeholder="User Telegram ID"><button class="btn red" onclick="banUser(true)">Ban User</button><button class="btn dark" onclick="banUser(false)">Unban User</button><input id="adminWd" class="field" placeholder="Withdrawal ID"><select id="adminStatus" class="field"><option>approved</option><option>rejected</option><option>paid</option></select><button class="btn gold" onclick="reviewWithdrawal()">Review Withdrawal</button>`)} `}
async function boot(){try{const d=await api('bootstrap');app.user=d.user;app.config=d.config||{};app.tasks=d.tasks||[];app.campaigns=d.campaigns||[];app.leaderboard=d.leaderboard||[];render();}catch(e){console.error(e);$('#content').innerHTML=card(`<h2>MYFA BIRR</h2><p class="bad">${esc(e.message)}</p><button class="btn" onclick="location.reload()">Reload</button>`)}finally{if(tg)tg.enableClosingConfirmation?.()}}
async function refresh(){const d=await api('bootstrap');app.user=d.user;app.config=d.config||{};app.tasks=d.tasks||[];app.campaigns=d.campaigns||[];app.leaderboard=d.leaderboard||[];render()}
async function daily(){try{const d=await api('daily-claim');app.user=d.user;toast('Daily reward +'+d.reward+' 💎');render()}catch(e){toast(e.message)}}
async function claimTask(id){try{const d=await api('claim-task',{taskId:id});app.user=d.user;toast('Task reward +'+d.reward+' 💎');render()}catch(e){toast(e.message)}}
async function playAviator(){try{const stake=Number($('#aviStake').value),target=Number($('#aviTarget').value);const d=await api('game',{game:'aviator',stake,target});app.user=d.user;toast(d.result.win?'🎉 Won '+d.result.payout+' 💎':'💥 Crash at '+d.result.crash+'x');render()}catch(e){toast(e.message)}}
let dropTimer=null,dropScoreVal=0;function startDrop(){clearInterval(dropTimer);dropScoreVal=0;const b=$('#dropBoard'),s=$('#dropScore');s.textContent='0';let end=Date.now()+10000;dropTimer=setInterval(()=>{if(Date.now()>=end){clearInterval(dropTimer);api('game',{game:'drop',score:dropScoreVal}).then(d=>{app.user=d.user;toast('Drop reward +'+d.result.reward+' 💎');render()}).catch(e=>toast(e.message));return}const x=20+Math.random()*60,y=20+Math.random()*60;const el=document.createElement('div');el.className='falling';el.textContent=Math.random()<.15?'💣':'💎';el.style.left=x+'%';el.style.top=y+'%';el.onclick=()=>{if(el.textContent==='💣')dropScoreVal=Math.max(0,dropScoreVal-20);else dropScoreVal+=10;$('#dropScore').textContent=dropScoreVal;el.remove()};b.appendChild(el);setTimeout(()=>el.remove(),600)},350)}
async function multiOx(pick){try{const d=await api('game',{game:'multi-ox',pick});app.user=d.user;toast(d.result.win?'🐂 Winner! +'+d.result.reward+' 💎':'Result: Ox '+d.result.draw);render()}catch(e){toast(e.message)}}
async function sketch(answer){try{const d=await api('game',{game:'sketch',answer});app.user=d.user;toast(d.result.win?'✏️ Correct +'+d.result.reward+' 💎':'Correct answer: '+d.result.answer);render()}catch(e){toast(e.message)}}
function initCombo(){const x=['💎','⭐','🔥','🍀','🎁'];const c=$('#comboPick');if(!c)return;c.innerHTML=x.map(s=>`<button class="btn dark" onclick="pickCombo(this,'${s}')">${s}</button>`).join('')}
let combo=[];window.pickCombo=(el,s)=>{if(el.classList.contains('active')){el.classList.remove('active');combo=combo.filter(x=>x!==s)}else if(combo.length<3){el.classList.add('active');combo.push(s)}}
async function dailyCombo(){try{const d=await api('game',{game:'daily-combo',combo});app.user=d.user;toast(d.result.win?'🎯 Combo win +'+d.result.reward+' 💎':'Combo: '+d.result.combo.join(' '));combo=[];render();setTimeout(initCombo,0)}catch(e){toast(e.message)}}
async function withdrawCreate(){try{const amount=Number($('#wdAmount').value),method=$('#wdMethod').value,account=$('#wdAccount').value;const d=await api('withdraw-create',{amount,method,account});app.user=d.user;toast('Withdrawal submitted');render();loadWithdrawals()}catch(e){toast(e.message)}}
async function loadWithdrawals(){try{const d=await api('withdrawals');const el=$('#withdrawList');if(!el)return;el.innerHTML=d.withdrawals.map(w=>`<div class="list-item"><span>${esc(w.method)}<br><small class="muted">${esc(w.id)}</small></span><b>$${money(w.amount)} · ${esc(w.status)}</b></div>`).join('')||'<div class="muted">No requests.</div>'}catch(e){toast(e.message)}}
async function openAd(id,url){try{window.open(url||'#','_blank');await api('ad-open',{adId:id});setTimeout(async()=>{try{const d=await api('claim-ad',{adId:id});app.user=d.user;toast('Ad reward +'+d.reward+' 💎');render()}catch(e){toast(e.message)}},8000)}catch(e){toast(e.message)}}
async function createAd(){try{const d=await api('create-ad',{title:$('#adTitle').value,url:$('#adUrl').value,reward:Number($('#adReward').value),budget:Number($('#adBudget').value)});app.user=d.user;toast('Campaign created');await refresh()}catch(e){toast(e.message)}}
async function saveSettings(){try{const d=await api('save-settings',{lang:$('#lang').value,theme:$('#theme').value,sound:true});app.user=d.user;document.body.classList.toggle('light',$('#theme').value==='light');toast('Settings saved');}catch(e){toast(e.message)}}
function copyRef(){const x=$('#refLink');x.select();navigator.clipboard?.writeText(x.value);toast('Referral link copied')}
async function banUser(banned){try{await api('admin-ban',{telegramId:$('#adminUid').value,banned});toast(banned?'User banned':'User unbanned')}catch(e){toast(e.message)}}
async function reviewWithdrawal(){try{await api('admin-withdraw',{id:$('#adminWd').value,status:$('#adminStatus').value});toast('Withdrawal updated')}catch(e){toast(e.message)}}
window.closeModal=()=>$('#modal').classList.add('hidden');
document.addEventListener('click',e=>{const b=e.target.closest('[data-nav]');if(b)nav(b.dataset.nav)});
window.addEventListener('load',()=>{boot().then(()=>{if(app.page==='games')initCombo()})});
const _render=render;window.render=()=>{_render();if(app.page==='games')setTimeout(initCombo,0);if(app.page==='withdraw')setTimeout(loadWithdrawals,0)};
})();
