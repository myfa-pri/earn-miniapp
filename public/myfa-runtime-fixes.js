(() => {
'use strict';

const tg = () => window.Telegram?.WebApp?.initDataUnsafe?.user || null;
const uid = () => String(tg()?.id || new URLSearchParams(location.search).get('userId') || '');
const api = async (path, options={}) => {
    const r = await fetch(path, {
        ...options,
        headers: {'Content-Type':'application/json',...(options.headers||{})},
        cache: 'no-store'
    });
    const d = await r.json().catch(()=>({}));
    return {r,d};
};

const setAvatar = (el,url) => {
    if(!el || !url) return;
    if(el.tagName === 'IMG') el.src=url;
    else el.style.backgroundImage=`url("${url.replace(/"/g,'%22')}")`;
    el.style.backgroundSize='cover';
    el.style.backgroundPosition='center';
    el.style.backgroundRepeat='no-repeat';
};

const applyAvatars = () => {
    const u=tg(); if(!u?.photo_url) return;
    document.querySelectorAll('.avatar-inner,.fop-avatar,#pageHeaderAvatar').forEach(el=>setAvatar(el,u.photo_url));
    document.querySelectorAll('img.lb-avatar').forEach(img=>{
        if(img.src.includes('/api/avatar/')) setAvatar(img,u.photo_url);
    });
};

const sync = async () => {
    const u=tg(), id=uid();
    if(!u?.id || !id) return;
    applyAvatars();
    try{
        const {d}=await api('/api/profile/sync',{method:'POST',body:JSON.stringify({
            userId:id,
            photoUrl:u.photo_url||'',
            firstName:u.first_name||'',
            lastName:u.last_name||'',
            username:u.username||''
        })});
        if(d.user && typeof currentUser!=='undefined' && currentUser){
            currentUser.avatarUrl=d.user.avatarUrl||currentUser.avatarUrl;
            currentUser.accountName=d.user.accountName||currentUser.accountName;
            currentUser.username=d.user.username||currentUser.username;
        }
    }catch(e){}
};

const streakContainer = () => document.querySelector('.streak-card')?.parentElement?.parentElement || document.querySelector('.timeline')?.parentElement || null;

const paintStreak = async () => {
    const id=uid(); if(!id) return;
    const {r,d}=await api(`/api/daily-streak/status/${encodeURIComponent(id)}`);
    if(!r.ok||!d.success) return;
    if(typeof currentUser!=='undefined' && currentUser){
        currentUser.streakCount=d.streak;
        currentUser.streak=d.streak;
    }
    document.querySelectorAll('.streak-card').forEach(el=>{
        const n=Number((el.querySelector('div')?.textContent||'').replace(/\D/g,''));
        if(!n)return;
        const active=n<=d.streak;
        const next=n===d.nextDay&&!d.claimedToday;
        el.classList.toggle('claimed',active);
        el.classList.toggle('current',next);
        const icon=el.querySelector('div:nth-child(2)');
        if(icon)icon.innerHTML=active?'<i class="fa-solid fa-circle-check" style="color:#078930"></i>':(next?'<i class="fa-solid fa-gift fa-beat" style="color:#F5A623"></i>':'<i class="fa-solid fa-lock" style="color:#64748B"></i>');
    });
    let host=streakContainer(); if(!host)return;
    let btn=document.getElementById('realDailyStreakClaim');
    if(!btn){
        btn=document.createElement('button');
        btn.id='realDailyStreakClaim';
        btn.className='btn quantum-btn';
        btn.style='width:100%;margin-top:12px;';
        host.appendChild(btn);
        btn.addEventListener('click',async()=>{
            btn.disabled=true;
            const {r,d}=await api('/api/daily-streak/claim',{method:'POST',body:JSON.stringify({userId:id})});
            if(d.success){
                btn.textContent=`Day ${d.streak} claimed • +${d.reward} Gems`;
                if(typeof currentUser!=='undefined'&&currentUser){
                    currentUser.points=d.newPoints;
                    currentUser.streakCount=d.streak;
                    currentUser.streak=d.streak;
                }
                const bal=document.getElementById('pageHeaderBalance');
                if(bal)bal.textContent=Number(d.newPoints).toLocaleString();
                applyAvatars();
            }else{
                btn.textContent=d.alreadyClaimed?'Already claimed today':(d.error||'Claim failed');
            }
            setTimeout(()=>paintStreak(),350);
        });
    }
    btn.disabled=d.claimedToday;
    btn.textContent=d.claimedToday?`Day ${d.streak} claimed today`:`Claim Day ${d.nextDay} • +${d.reward} Gems`;
};

const startObserver = () => {
    const mo=new MutationObserver(()=>applyAvatars());
    mo.observe(document.body,{childList:true,subtree:true});
};

// ---------------------------------------------------------------------------
// Internal miniapp navigation performance.
// Navigation already swaps page containers synchronously, but the first render
// of each lazy page can do network work or heavy DOM work before the browser
// gets a chance to paint. Give the target page a stable shell first, then defer
// the real renderer until the next task so the tap paints immediately.
// ---------------------------------------------------------------------------
const fastShell = (title, icon='fa-bolt', body='Loading live data…') => c => {
    if(!c) return;
    c.innerHTML=`<div style="padding:18px 4px;min-height:220px"><h2 style="margin:0 0 14px;display:flex;align-items:center;gap:10px"><i class="fa-solid ${icon}" style="color:var(--color-cyan)"></i>${title}</h2><div class="cm-note" style="margin-top:10px"><i class="fa-solid fa-bolt"></i> ${body}</div></div>`;
};

const fastTasksShell = c => {
    if(!c) return;
    c.innerHTML = `
      <h2 style="margin-bottom:20px"><i class="fa-solid fa-list-check" style="color:var(--brand-blue)"></i> Earn Gems</h2>
      <div style="display:flex;gap:10px;margin-bottom:15px">
        <button class="btn quantum-btn" style="flex:1;padding:15px;border-radius:15px" onclick="watchMonetagAd()"><i class="fa-solid fa-play"></i> Watch Ad<br><small style="font-size:.7rem;opacity:.8">Monetag</small></button>
        <button class="btn quantum-btn" style="flex:1;padding:15px;border-radius:15px" onclick="triggerAdsterra()"><i class="fa-solid fa-star"></i> Premium Ad<br><small style="font-size:.7rem;opacity:.8">Adsterra</small></button>
      </div>
      <div class="card cyber-card" style="margin-bottom:20px;padding:20px;text-align:center;background:linear-gradient(135deg,rgba(255,215,0,.1),rgba(255,140,0,.1));border:1px solid rgba(255,215,0,.4);cursor:pointer" onclick="openMyfaAd()">
        <i class="fa-solid fa-bullhorn" style="font-size:2.5rem;color:#FFD700;margin-bottom:10px"></i>
        <h3 style="color:white;font-size:1.4rem">Myfa Ads</h3>
        <p style="color:#94A3B8;font-size:.9rem;margin:0">Sponsored ads ready</p>
      </div>
      <div id="taskList"><div class="cm-note" style="margin-top:12px"><i class="fa-solid fa-bolt"></i> Tasks are loading in the background…</div></div>`;
};

const wrapFastRenderer = (name, shell) => {
    const original = window[name];
    if(typeof original !== 'function' || original.__myfaFastWrapped) return;
    const wrapped = function(container, ...args) {
        try { shell(container); } catch(e) {}
        // Let the browser paint the destination shell before the renderer does
        // network work or a large DOM replacement.
        setTimeout(() => {
            try { original.call(this, container, ...args); } catch(e) { console.error(`[MYFA ${name}]`, e); }
        }, 0);
    };
    wrapped.__myfaFastWrapped = true;
    wrapped.__myfaOriginal = original;
    window[name] = wrapped;
};

wrapFastRenderer('renderHome', fastShell('Home','fa-house','Your MYFA dashboard is loading…'));
wrapFastRenderer('renderSettings', fastShell('Settings','fa-gear','Settings are loading…'));
wrapFastRenderer('renderAds', fastShell('Ads','fa-rectangle-ad','Ads are loading…'));
wrapFastRenderer('renderWithdraw', fastShell('Withdraw','fa-money-bill-transfer','Withdrawal options are loading…'));
wrapFastRenderer('renderTasks', fastTasksShell);
wrapFastRenderer('renderReferrals', fastShell('Invite & Earn','fa-user-group','Referral data is loading…'));
wrapFastRenderer('renderLeaderboard', fastShell('Leaderboard','fa-trophy','Rankings are loading…'));
wrapFastRenderer('renderGames', fastShell('Games','fa-gamepad','Games are loading…'));

// ---------------------------------------------------------------------------
// Preload Myfa inventory immediately after the Telegram user is available.
// The tap then opens a ready ad instead of waiting for the first inventory call.
// ---------------------------------------------------------------------------
const inventoryState = {promise:null,data:null,at:0};
const preloadMyfaInventory = (force=false) => {
    const id=uid();
    if(!id) return Promise.resolve({success:false,available:false});
    if(!force && inventoryState.promise && Date.now()-inventoryState.at<30000) return inventoryState.promise;
    inventoryState.at=Date.now();
    inventoryState.promise=api(`/api/ads?action=inventory&userId=${encodeURIComponent(id)}`)
      .then(({d})=>{ inventoryState.data=d; return d; })
      .catch(()=>({success:false,available:false}));
    return inventoryState.promise;
};
window.preloadMyfaInventory = preloadMyfaInventory;

// ---------------------------------------------------------------------------
// Fast, real Myfa Sponsored Ad gate.
// Uses the signed /api/ads session engine so every verified completion updates
// the creator campaign budget and the viewer's Gems/history.
// ---------------------------------------------------------------------------
let myfaOverlay = null;
let myfaSession = null;
let myfaTimer = null;
let myfaCompleted = false;

const adText = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

const ensureMyfaOverlay = () => {
    if(myfaOverlay) return myfaOverlay;
    myfaOverlay=document.createElement('div');
    myfaOverlay.id='myfaFastAdOverlay';
    myfaOverlay.innerHTML=`
      <div class="myfa-fast-ad-card">
        <button type="button" class="myfa-fast-ad-close" aria-label="Close ad">×</button>
        <div class="myfa-fast-ad-badge"><i class="fa-solid fa-bullhorn"></i> MYFA SPONSORED</div>
        <div class="myfa-fast-ad-media"><img id="myfaFastAdImage" alt="Sponsored ad"></div>
        <h2 id="myfaFastAdTitle">MYFA Sponsored Ad</h2>
        <p id="myfaFastAdDesc">Sponsored placement</p>
        <div class="myfa-fast-ad-meta"><span id="myfaFastAdTimer">10s</span><span id="myfaFastAdReward">+ Gems</span></div>
        <button type="button" id="myfaFastAdVisit" class="btn btn-secondary myfa-fast-ad-action">Visit Sponsored Link</button>
        <button type="button" id="myfaFastAdClaim" class="btn quantum-btn myfa-fast-ad-action" disabled>Claim Reward</button>
      </div>`;
    document.body.appendChild(myfaOverlay);
    const close=()=>{
        clearInterval(myfaTimer); myfaTimer=null; myfaSession=null; myfaCompleted=false;
        myfaOverlay.classList.remove('open');
    };
    myfaOverlay.querySelector('.myfa-fast-ad-close').addEventListener('click',close);
    myfaOverlay.querySelector('#myfaFastAdVisit').addEventListener('click',()=>{
        const url=myfaOverlay.querySelector('#myfaFastAdVisit').dataset.url||'';
        if(url && url!=='#') window.open(url,'_blank','noopener,noreferrer');
    });
    myfaOverlay.querySelector('#myfaFastAdClaim').addEventListener('click',claimFastMyfaAd);
    const style=document.createElement('style');
    style.textContent=`
      #myfaFastAdOverlay{position:fixed;inset:0;z-index:100000;background:rgba(3,7,18,.94);backdrop-filter:blur(14px);display:flex;align-items:center;justify-content:center;padding:18px;opacity:0;pointer-events:none;transition:opacity .12s ease}
      #myfaFastAdOverlay.open{opacity:1;pointer-events:auto}
      .myfa-fast-ad-card{width:min(430px,100%);max-height:92vh;overflow:auto;background:#0f172a;border:1px solid rgba(255,255,255,.12);border-radius:24px;padding:18px;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.5);position:relative}
      .myfa-fast-ad-close{position:absolute;top:10px;right:12px;width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#fff;font-size:25px;cursor:pointer;z-index:2}
      .myfa-fast-ad-badge{display:inline-flex;gap:7px;align-items:center;padding:7px 11px;border-radius:99px;background:rgba(255,215,0,.12);color:#FFD700;font-weight:800;font-size:12px;margin:4px 0 12px}
      .myfa-fast-ad-media{width:100%;aspect-ratio:16/9;border-radius:18px;overflow:hidden;background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;margin-bottom:15px}
      .myfa-fast-ad-media img{width:100%;height:100%;object-fit:cover;display:none}
      .myfa-fast-ad-media.no-image:after{content:'MYFA SPONSORED AD';color:#94A3B8;font-weight:800;letter-spacing:.06em}
      #myfaFastAdTitle{font-size:1.35rem;margin:0 28px 7px;color:#fff}
      #myfaFastAdDesc{color:#94A3B8;line-height:1.5;margin:0 8px 12px;min-height:42px}
      .myfa-fast-ad-meta{display:flex;justify-content:center;gap:24px;margin:8px 0 14px;color:#fff;font-weight:800}
      .myfa-fast-ad-meta span:first-child{color:#FFD700}
      .myfa-fast-ad-action{width:100%;margin-top:10px}
    `;
    document.head.appendChild(style);
    return myfaOverlay;
};

const paintFastMyfaAd = ad => {
    const o=ensureMyfaOverlay();
    const img=o.querySelector('#myfaFastAdImage'), media=o.querySelector('.myfa-fast-ad-media');
    o.querySelector('#myfaFastAdTitle').textContent=ad?.title||'MYFA Sponsored Ad';
    o.querySelector('#myfaFastAdDesc').textContent=ad?.description||'Watch this sponsored ad to earn Gems.';
    o.querySelector('#myfaFastAdReward').textContent='+ Gems';
    const visit=o.querySelector('#myfaFastAdVisit');
    visit.dataset.url=ad?.link||'#';
    visit.disabled=!ad?.link;
    if(ad?.imageUrl){img.src=ad.imageUrl;img.style.display='block';media.classList.remove('no-image');}
    else{img.removeAttribute('src');img.style.display='none';media.classList.add('no-image');}
};

const finishFastMyfaUi = (reward) => {
    try{
        if(typeof currentUser!=='undefined' && currentUser && reward){
            currentUser.points=Number(reward.newBalance?.gems ?? (currentUser.points||0));
            currentUser.realBalance=Number(reward.newBalance?.cash ?? (currentUser.realBalance||0));
            if(typeof updateUI==='function') updateUI();
        }
    }catch(e){}
};

async function claimFastMyfaAd(){
    const claim=ensureMyfaOverlay().querySelector('#myfaFastAdClaim');
    if(!myfaSession?.token || myfaCompleted || claim.disabled) return;
    claim.disabled=true;
    claim.innerHTML='<i class="fa-solid fa-circle-notch fa-spin"></i> Verifying';
    try{
        const {r,d}=await api('/api/ads?action=complete',{method:'POST',body:JSON.stringify({
            token:myfaSession.token,
            providerResult:{done:true}
        })});
        if(!r.ok || !d.success) throw new Error(d.error||'Reward verification failed');
        myfaCompleted=true;
        finishFastMyfaUi(d);
        claim.innerHTML='<i class="fa-solid fa-check"></i> Completed';
        const timer=ensureMyfaOverlay().querySelector('#myfaFastAdTimer');
        timer.textContent='Done';
        try{ if(typeof showToast==='function') showToast(`Earned +${Number(d.reward?.gems||0).toLocaleString()} Gems from Myfa Ads!`,'success'); }catch(e){}
        clearInterval(myfaTimer);
        setTimeout(()=>{
            ensureMyfaOverlay().classList.remove('open');
            myfaSession=null;
            preloadMyfaInventory(true);
            if(typeof nav==='function') nav('tasks');
        },700);
    }catch(e){
        claim.disabled=false;
        claim.innerHTML='Claim Reward';
        try{ if(typeof showToast==='function') showToast(e.message||'Reward verification failed','error'); }catch(err){}
    }
}

async function openMyfaAd(){
    const id=uid();
    if(!id) return;
    const o=ensureMyfaOverlay();
    clearInterval(myfaTimer); myfaTimer=null; myfaSession=null; myfaCompleted=false;

    // Open the gate immediately with already-prefetched creative when available.
    const cached=inventoryState.data?.available ? inventoryState.data.ad : null;
    paintFastMyfaAd(cached || {title:'MYFA Sponsored Ad',description:'Sponsored ad ready — starting verified watch session…'});
    const timer=o.querySelector('#myfaFastAdTimer');
    const reward=o.querySelector('#myfaFastAdReward');
    const claim=o.querySelector('#myfaFastAdClaim');
    claim.disabled=true; claim.textContent='Claim Reward';
    timer.textContent='Ready';
    reward.textContent='+ Gems';
    o.classList.add('open');

    try{
        const {r,d}=await api('/api/ads?action=start',{method:'POST',body:JSON.stringify({userId:id,network:'myfa'})});
        if(!r.ok || !d.success) throw new Error(d.error||'No sponsored ad is available right now');
        if(!d.campaign) throw new Error('No sponsored ad is available right now');
        myfaSession={token:d.token,minSeconds:Math.max(5,Number(d.minSeconds)||10),startedAt:Date.now(),campaignId:d.campaign.id};
        paintFastMyfaAd(d.campaign);
        reward.textContent=`+${Number(d.rewardPreview?.gems||0).toLocaleString()} Gems`;
        let remaining=Math.ceil(myfaSession.minSeconds);
        timer.textContent=`${remaining}s`;
        myfaTimer=setInterval(()=>{
            remaining=Math.max(0,remaining-1);
            timer.textContent=remaining>0?`${remaining}s`:'Ready';
            if(remaining<=0){
                clearInterval(myfaTimer); myfaTimer=null;
                if(!myfaCompleted){claim.disabled=false;claim.innerHTML='<i class="fa-solid fa-gift"></i> Claim Reward';}
            }
        },1000);
    }catch(e){
        o.classList.remove('open');
        clearInterval(myfaTimer); myfaTimer=null; myfaSession=null;
        try{ if(typeof showToast==='function') showToast(e.message||'No sponsored ads available right now','info'); }catch(err){}
    }
}
window.openMyfaAd=openMyfaAd;
window.claimMyfaAd=claimFastMyfaAd;

const onReady = () => {
    setTimeout(sync,100);
    setTimeout(paintStreak,350);
    setTimeout(()=>preloadMyfaInventory(false),250);
    // Retry once after the Telegram user/session is fully initialized.
    let tries=0;
    const warm=setInterval(()=>{
        tries++;
        if(uid()){
            preloadMyfaInventory(false);
            clearInterval(warm);
        }else if(tries>30){clearInterval(warm);}
    },250);
    startObserver();
};

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',onReady,{once:true});
else onReady();
window.addEventListener('load',()=>{setTimeout(applyAvatars,50);setTimeout(paintStreak,300);});
setInterval(()=>{applyAvatars();},60000);
setInterval(()=>{paintStreak();},60000);
})();