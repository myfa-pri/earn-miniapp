(()=>{
const root=document.getElementById('ongoing-app'); if(!root)return;
const slides=[...root.querySelectorAll('.slide')]; let page=1,sx=0,sy=0,auto;
const qs=new URLSearchParams(location.search); const preview=qs.has('ongoing')||qs.has('test_user');
function typeAll(slide){slide.querySelectorAll('[data-type]').forEach((el,i)=>{el.classList.remove('typing');el.textContent=''; const lines=el.dataset.type.split('|'); let text='',idx=0; const tick=()=>{if(idx<lines.length){text+= (idx?'\n':'')+lines[idx]; el.textContent=text; idx++; setTimeout(tick,190+idx*70)} else el.classList.add('typing')}; setTimeout(tick,220+i*180)});}
function animate(slide){slide.classList.remove('enter');void slide.offsetWidth;slide.classList.add('enter');typeAll(slide);}
function show(n,dir=1){n=Math.max(1,Math.min(3,n)); if(n===page){animate(slides[page-1]); return;} const old=slides[page-1],next=slides[n-1]; old.classList.remove('active','back','enter'); next.classList.toggle('back',dir<0); next.classList.add('active','enter'); old.setAttribute('aria-hidden','true');next.setAttribute('aria-hidden','false');page=n;arm();}
function finish(){clearTimeout(auto); if(preview){try{sessionStorage.setItem('myfa_ongoing_preview_done','1')}catch(e){} location.href='/?ongoing=preview-complete';} else location.href='/';}
function arm(){clearTimeout(auto);auto=setTimeout(()=>page<3?show(page+1,1):0,12000)}
root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.preventDefault();if(b.dataset.skip||b.dataset.finish)return finish();if(b.dataset.next){page<3?show(page+1,1):finish();}});
root.addEventListener('touchstart',e=>{if(e.touches.length===1){sx=e.touches[0].clientX;sy=e.touches[0].clientY}},{passive:true});
root.addEventListener('touchend',e=>{if(!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){dx<0?(page<3?show(page+1,1):finish()):show(page-1,-1)}} ,{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')page<3?show(page+1,1):finish();if(e.key==='ArrowLeft')show(page-1,-1);if(e.key==='Escape')finish()});
root.classList.add('ready');animate(slides[0]);arm();
})();
