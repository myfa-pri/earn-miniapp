(function(){
  'use strict';
  const app=document.getElementById('ongoing-app');
  const screens=[...document.querySelectorAll('.screen')];
  const params=new URLSearchParams(location.search);
  const preview=params.has('ongoing');
  const explicitTestUser=params.get('test_user');
  const tg=window.Telegram?.WebApp;
  const browserPreview=preview || window.__MYFA_BROWSER_PREVIEW__===true;
  let tgUser=tg?.initDataUnsafe?.user||null;
  if (explicitTestUser && /^\d+$/.test(explicitTestUser) && !tgUser) tgUser={id:explicitTestUser,first_name:'Web Test User'};
  if (preview) app.classList.add('preview');
  try{tg?.ready?.();tg?.expand?.()}catch(_e){}

  // Critical assets: preload without using whole-page PNGs as production UI.
  const critical=[
    '/assets/ongoing/scenery/p1_city_no_monument.png',
    '/assets/ongoing/scenery/p3_city_no_monument.png',
    '/assets/ongoing/ribbons/p1_ribbon_left.png','/assets/ongoing/ribbons/p1_ribbon_right.png',
    '/assets/ongoing/ribbons/p3_ribbon_left.png'
  ];
  critical.forEach(src=>{const i=new Image();i.decoding='async';i.src=src});

  let page=1,animEpoch=0,gestureStart=null,busy=false;
  const status=(msg)=>{let el=document.getElementById('status-msg');if(!el){el=document.createElement('div');el.id='status-msg';el.setAttribute('role','status');el.style.cssText='position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:120;background:rgba(0,6,18,.86);border:1px solid rgba(255,255,255,.12);padding:7px 11px;border-radius:999px;font-size:10px;font-weight:700;color:#fff;opacity:0;transition:opacity .2s;pointer-events:none;backdrop-filter:blur(8px)';document.body.appendChild(el)}el.textContent=msg;el.style.opacity='1';clearTimeout(status.t);status.t=setTimeout(()=>el.style.opacity='0',1700)};

  function resetEntrance(){
    animEpoch++;
    screens.forEach((screen)=>{
      screen.querySelectorAll('[data-entrance]').forEach((el)=>{
        el.style.setProperty('--entrance-epoch',animEpoch);
      });
    });
  }
  function show(n,dir=1){
    const target=Math.max(1,Math.min(3,n)); if(target===page)return;
    const old=page; page=target;
    screens.forEach(s=>{s.classList.remove('active','enter-from-left'); if(Number(s.dataset.page)===target){if(dir<0)s.classList.add('enter-from-left');requestAnimationFrame(()=>s.classList.add('active'));}});
    const active=screens.find(s=>Number(s.dataset.page)===target); if(active){active.setAttribute('aria-hidden','false');} 
    screens.forEach(s=>{if(s!==active)s.setAttribute('aria-hidden','true')});
    updateDots(target); resetEntrance();
    try{tg?.HapticFeedback?.selectionChanged?.()}catch(_e){}
    status(old<target?'Next':'Back');
  }
  function updateDots(n){document.querySelectorAll('.dots').forEach(row=>{row.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('active',i===n-1))})}
  updateDots(1);

  function getSessionId(){
    let sid=localStorage.getItem('appSessionId');
    if(!sid){try{sid=crypto.randomUUID()}catch(_e){sid='session-'+Date.now()+'-'+Math.random().toString(36).slice(2)}localStorage.setItem('appSessionId',sid)}
    return sid;
  }
  async function getUser(){
    if(!tgUser?.id)return null;
    const id=encodeURIComponent(String(tgUser.id));
    const sid=getSessionId();
    let r=await fetch('/api/user/'+id+'?sessionId='+encodeURIComponent(sid),{cache:'no-store'});
    if(!r.ok){
      const name=tgUser.first_name+(tgUser.last_name?' '+tgUser.last_name:'');
      const ref=tg?.initDataUnsafe?.start_param||null;
      await fetch('/api/ensure-user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:String(tgUser.id),username:name,refParam:ref})}).catch(()=>{});
      r=await fetch('/api/user/'+id+'?sessionId='+encodeURIComponent(sid),{cache:'no-store'});
    }
    if(!r.ok)throw new Error(r.status===401?'Session revoked':'Unable to load account');
    return r.json();
  }
  async function completeAndRoute(){
    if(busy)return;busy=true;
    if(browserPreview && !explicitTestUser && !tg?.initDataUnsafe?.user){status('Browser preview • no account changed');busy=false;return;}
    if(!tgUser?.id){if(browserPreview){status('Browser preview • no account changed');busy=false;return;}status('Open MYFA in Telegram');busy=false;return;}
    try{
      const r=await fetch('/api/first-open-complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:String(tgUser.id)})});
      const d=await r.json().catch(()=>({}));
      if(!(d.success || d.error==='Already completed.'))throw new Error(d.error||'Could not complete onboarding');
      try{tg?.HapticFeedback?.notificationOccurred?.('success')}catch(_e){}
      // Preserve browser test mode when returning to the real Mini App shell.
      // Normal Telegram users still return to the normal root URL.
      if (explicitTestUser && /^\d+$/.test(explicitTestUser)) {
        location.replace('/?test_user=' + encodeURIComponent(explicitTestUser));
      } else {
        location.replace('/');
      }
    }catch(e){status(e.message||'Please try again');busy=false}
  }
  function skip(){completeAndRoute()}

  document.querySelectorAll('[data-next]').forEach(b=>b.addEventListener('click',()=>show(page+1,1)));
  document.querySelectorAll('[data-skip]').forEach(b=>b.addEventListener('click',skip));
  document.querySelectorAll('[data-finish]').forEach(b=>b.addEventListener('click',completeAndRoute));
  document.querySelectorAll('[data-next2]').forEach(b=>b.addEventListener('click',()=>show(page+1,1)));
  document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'&&page<3)show(page+1,1);else if(e.key==='ArrowLeft'&&page>1)show(page-1,-1);else if(e.key==='Escape')skip()});
  document.addEventListener('touchstart',e=>{if(e.touches.length===1)gestureStart={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});
  document.addEventListener('touchend',e=>{if(!gestureStart)return;const dx=e.changedTouches[0].clientX-gestureStart.x,dy=e.changedTouches[0].clientY-gestureStart.y;gestureStart=null;if(Math.abs(dx)>52&&Math.abs(dx)>Math.abs(dy)){if(dx<0&&page<3)show(page+1,1);else if(dx>0&&page>1)show(page-1,-1)}} ,{passive:true});

  // Browser preview is deliberately auth-free. Production/real-account path reads existing first-open state.
  (async function init(){
    if(browserPreview && !explicitTestUser && !tgUser){return;}
    if(!tgUser?.id){
      if(!browserPreview){
        document.querySelector('.screen.active')?.classList.remove('active');
        const e=document.getElementById('error');if(e)e.hidden=false;
      }
      return;
    }
    try{
      const u=await getUser();
      if(u?.isBanned){throw new Error('ACCOUNT BANNED');}
      if(u?.firstOpenCompleted && !preview){location.replace('/');return;}
    }catch(e){
      if(!browserPreview){const el=document.getElementById('error');if(el){el.hidden=false;el.querySelector('[data-error]')?.replaceChildren(document.createTextNode(e.message||'Unable to load account'));}}
    }
  })();

})();
