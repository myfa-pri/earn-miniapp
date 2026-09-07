(()=>{const root=document.getElementById("ongoing-app");if(!root)return;
const slides=[...root.querySelectorAll(".slide")];let page=1,locked=false,sx=0,sy=0,autoTimer=null;
const params=new URLSearchParams(location.search);const preview=params.has("ongoing")||params.has("test_user");

function restartMotion(slide){slide.classList.remove("motion-start");void slide.offsetWidth;slide.classList.add("motion-start");}
function show(n,dir){n=Math.max(1,Math.min(3,n));if(n===page)return;
 const old=slides[page-1],next=slides[n-1];old.classList.remove("active","back","motion-start");
 next.classList.toggle("back",dir<0);next.classList.add("active","motion-start");
 old.setAttribute("aria-hidden","true");next.setAttribute("aria-hidden","false");page=n;
 clearTimeout(autoTimer);
}
function finish(){if(locked)return;locked=true;clearTimeout(autoTimer);
 if(preview){try{sessionStorage.setItem("myfa_ongoing_preview_done","1")}catch(e){}location.replace("/?ongoing=preview-complete");return}
 location.replace("/");
}
function armAuto(){clearTimeout(autoTimer);autoTimer=setTimeout(()=>{if(page<3)show(page+1,1)},9000)}
root.classList.add("ready");slides[0].classList.add("motion-start");armAuto();

root.addEventListener("click",e=>{const b=e.target.closest("button");if(!b||!root.contains(b))return;e.preventDefault();e.stopPropagation();
 if(b.hasAttribute("data-skip")||b.hasAttribute("data-finish")){finish();return}
 if(b.hasAttribute("data-next")){if(page<3)show(page+1,1);else finish();armAuto();return}
 if(b.dataset.pageTarget)show(Number(b.dataset.pageTarget),Number(b.dataset.pageTarget)>page?1:-1);
 armAuto();
});
root.addEventListener("touchstart",e=>{if(e.touches.length===1){sx=e.touches[0].clientX;sy=e.touches[0].clientY}},{passive:true});
root.addEventListener("touchend",e=>{if(!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;
 if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){if(dx<0){if(page<3)show(page+1,1);else finish()}else show(page-1,-1);armAuto()}},{passive:true});
document.addEventListener("keydown",e=>{if(e.key==="ArrowRight"){if(page<3)show(page+1,1);else finish();armAuto()}if(e.key==="ArrowLeft"){show(page-1,-1);armAuto()}if(e.key==="Escape")finish()});
})();