(() => {
'use strict';
const tg = () => window.Telegram?.WebApp?.initDataUnsafe?.user || null;
const uid = () => String(tg()?.id || new URLSearchParams(location.search).get('userId') || '');
const api = async (path, options={}) => { const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}}); const d=await r.json().catch(()=>({})); return {r,d}; };
const setAvatar = (el,url) => { if(!el || !url) return; if(el.tagName === 'IMG') el.src=url; else el.style.backgroundImage=`url("${url.replace(/"/g,'%22')}")`; el.style.backgroundSize='cover'; el.style.backgroundPosition='center'; el.style.backgroundRepeat='no-repeat'; };
const applyAvatars = () => {
    const u=tg(); if(!u?.photo_url) return;
    document.querySelectorAll('.avatar-inner,.fop-avatar,#pageHeaderAvatar').forEach(el=>setAvatar(el,u.photo_url));
    document.querySelectorAll('img.lb-avatar').forEach(img=>{ if(img.src.includes('/api/avatar/')) setAvatar(img,u.photo_url); });
};
const sync = async () => {
    const u=tg(), id=uid(); if(!u?.id || !id) return;
    applyAvatars();
    try{ const {d}=await api('/api/profile/sync',{method:'POST',body:JSON.stringify({userId:id,photoUrl:u.photo_url||'',firstName:u.first_name||'',lastName:u.last_name||'',username:u.username||''})}); if(d.user && typeof currentUser!=='undefined' && currentUser){ currentUser.avatarUrl=d.user.avatarUrl||currentUser.avatarUrl; currentUser.accountName=d.user.accountName||currentUser.accountName; currentUser.username=d.user.username||currentUser.username; } }catch(e){}
};
const streakContainer = () => document.querySelector('.streak-card')?.parentElement?.parentElement || document.querySelector('.timeline')?.parentElement || null;
const paintStreak = async () => {
    const id=uid(); if(!id) return; const {r,d}=await api(`/api/daily-streak/status/${encodeURIComponent(id)}`); if(!r.ok||!d.success) return;
    if(typeof currentUser!=='undefined' && currentUser){ currentUser.streakCount=d.streak; currentUser.streak=d.streak; }
    document.querySelectorAll('.streak-card').forEach(el=>{ const n=Number((el.querySelector('div')?.textContent||'').replace(/\D/g,'')); if(!n)return; const active=n<=d.streak; const next=n===d.nextDay&&!d.claimedToday; el.classList.toggle('claimed',active); el.classList.toggle('current',next); const icon=el.querySelector('div:nth-child(2)'); if(icon)icon.innerHTML=active?'<i class="fa-solid fa-circle-check" style="color:#078930"></i>':(next?'<i class="fa-solid fa-gift fa-beat" style="color:#F5A623"></i>':'<i class="fa-solid fa-lock" style="color:#64748B"></i>'); });
    let host=streakContainer(); if(!host)return; let btn=document.getElementById('realDailyStreakClaim'); if(!btn){btn=document.createElement('button');btn.id='realDailyStreakClaim';btn.className='btn quantum-btn';btn.style='width:100%;margin-top:12px;';host.appendChild(btn);btn.addEventListener('click',async()=>{btn.disabled=true;const {r,d}=await api('/api/daily-streak/claim',{method:'POST',body:JSON.stringify({userId:id})});if(d.success){btn.textContent=`Day ${d.streak} claimed • +${d.reward} Gems`; if(typeof currentUser!=='undefined'&&currentUser){currentUser.points=d.newPoints;currentUser.streakCount=d.streak;currentUser.streak=d.streak;} const bal=document.getElementById('pageHeaderBalance');if(bal)bal.textContent=Number(d.newPoints).toLocaleString();applyAvatars();}else{btn.textContent=d.alreadyClaimed?'Already claimed today':(d.error||'Claim failed');}setTimeout(()=>paintStreak(),350);});}
    btn.disabled=d.claimedToday; btn.textContent=d.claimedToday?`Day ${d.streak} claimed today`:`Claim Day ${d.nextDay} • +${d.reward} Gems`;
};
const startObserver = () => { const mo=new MutationObserver(()=>applyAvatars()); mo.observe(document.body,{childList:true,subtree:true}); };
document.addEventListener('DOMContentLoaded',()=>{ setTimeout(sync,100); setTimeout(paintStreak,350); startObserver(); });
window.addEventListener('load',()=>{setTimeout(applyAvatars,50);setTimeout(paintStreak,300);});
setInterval(()=>{applyAvatars();},60000);
setInterval(()=>{paintStreak();},60000);
})();
