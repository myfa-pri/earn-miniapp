(()=>{
'use strict';
const root=document.getElementById('ongoing-app'); if(!root)return;
const slides=[...root.querySelectorAll('.slide')]; let page=1,sx=0,sy=0;
const qs=new URLSearchParams(location.search); const browserPreview=qs.has('ongoing')||qs.has('test_user');
function activate(n,dir=1){n=Math.max(1,Math.min(3,n)); if(n===page){replay(slides[n-1]);return;} const old=slides[page-1], next=slides[n-1]; old.classList.remove('active','enter-forward','enter-back'); old.setAttribute('aria-hidden','true'); next.classList.remove('enter-forward','enter-back'); void next.offsetWidth; next.classList.add(dir>=0?'enter-forward':'enter-back','active'); next.setAttribute('aria-hidden','false'); page=n;}
function replay(slide){slide.classList.remove('enter-forward','enter-back'); void slide.offsetWidth; slide.classList.add('enter-forward');}
function finish(){ if(browserPreview){try{sessionStorage.setItem('myfa_ongoing_preview_done','1')}catch(e){} window.location.href='/?ongoing=preview-complete';} else window.location.href='/'; }
root.addEventListener('click',e=>{const b=e.target.closest('[data-next],[data-skip],[data-finish]');if(!b)return;e.preventDefault();e.stopPropagation();if(b.hasAttribute('data-skip')||b.hasAttribute('data-finish')){finish();return;} if(page<3)activate(page+1,1);else finish();});
root.addEventListener('touchstart',e=>{if(e.touches.length===1){sx=e.touches[0].clientX;sy=e.touches[0].clientY}},{passive:true});
root.addEventListener('touchend',e=>{if(!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)){if(dx<0){if(page<3)activate(page+1,1);else finish();}else if(page>1)activate(page-1,-1);}}, {passive:true});
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){if(page<3)activate(page+1,1);else finish();}else if(e.key==='ArrowLeft'&&page>1)activate(page-1,-1);else if(e.key==='Escape')finish();});
// In browser preview the onboarding is standalone; never render Telegram-only fallback UI.
if(browserPreview){document.documentElement.classList.add('ongoing-browser-preview');document.body.classList.add('ongoing-browser-preview');}
replay(slides[0]);
})();
