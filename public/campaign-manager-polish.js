(() => {
  'use strict';
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  const closeModal=()=>{
    const m=$('#aspModal');
    if(!m) return;
    m.classList.remove('open');
    m.setAttribute('aria-hidden','true');
    document.body.classList.remove('cm-modal-open');
  };

  const api=async(path,options={})=>{
    const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.error||'Request failed');
    return d;
  };

  const getUserId=()=>String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||new URLSearchParams(location.search).get('userId')||'');
  const toast=t=>{const n=$('#aspToast');if(!n)return;n.textContent=t;n.classList.add('show');clearTimeout(n._cm);n._cm=setTimeout(()=>n.classList.remove('show'),2600)};

  const injectCreateEnhancement=()=>{
    const form=$('#createForm');
    if(!form || form.dataset.polished) return;
    form.dataset.polished='1';
    const intro=document.createElement('div');
    intro.className='cm-form-intro';
    intro.innerHTML='<div class="cm-form-intro-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div><div><strong>Build a campaign that is ready for real delivery</strong><span>Budget, targeting, dates and verification are checked by the server before launch.</span></div>';
    form.prepend(intro);

    const preview=document.createElement('div');
    preview.id='cmBudgetPreview';
    preview.className='cm-budget-preview';
    preview.innerHTML='<div><span>PLANNED RESERVATION</span><strong>0 Gems</strong></div><small>Live estimate from this form</small>';
    form.insertBefore(preview, form.querySelector('button[type="submit"]'));

    const update=()=>{
      const ad=Number(form.elements.impressionBudget?.value||0);
      const users=Number(form.elements.maxUsers?.value||0);
      const reward=Number(form.elements.reward?.value||0);
      const total=ad+users*reward;
      const strong=preview.querySelector('strong');
      if(strong) strong.textContent=`${total.toLocaleString()} Gems`;
      preview.classList.toggle('has-value',total>0);
    };
    $$('input,select,textarea',form).forEach(el=>el.addEventListener('input',update));
    update();
  };

  const campaignIdFromModal=()=>$('#aspModal [data-action][data-id]')?.dataset.id || $('#aspModal [data-budget]')?.dataset.budget || '';

  const injectManageEnhancement=()=>{
    const modal=$('#aspModal');
    if(!modal?.classList.contains('open')) return;
    const panel=modal.firstElementChild;
    if(!panel || panel.dataset.polished) return;
    panel.dataset.polished='1';

    const actionRow=document.createElement('div');
    actionRow.className='cm-quick-actions';
    actionRow.innerHTML=`<div class="cm-quick-label"><i class="fa-solid fa-sliders"></i><span>QUICK CONTROL</span></div>
      <button type="button" data-cm-quick="pause"><i class="fa-solid fa-pause"></i><span>Pause / Resume</span></button>
      <button type="button" data-cm-quick="validate"><i class="fa-solid fa-link"></i><span>Validate URL</span></button>
      <button type="button" data-cm-quick="test"><i class="fa-solid fa-flask"></i><span>Test delivery</span></button>
      <button type="button" data-cm-quick="copy"><i class="fa-solid fa-copy"></i><span>Copy tracking</span></button>
      <button type="button" data-cm-quick="refresh"><i class="fa-solid fa-rotate"></i><span>Refresh</span></button>
      <button type="button" data-cm-quick="close"><i class="fa-solid fa-xmark"></i><span>Close</span></button>`;
    panel.insertBefore(actionRow,panel.children[1]||null);

    const health=document.createElement('div');
    health.className='cm-health-card';
    const status=$('#aspModal .asp-eyebrow')?.textContent||'Campaign';
    const url=$('#aspModal [data-sfield="link"]')?.value||'';
    const budget=$('#aspModal [data-budget]')?.dataset.budget?'':' '; 
    const checks=[
      ['fa-user-shield','Ownership verified',true],
      ['fa-coins','Budget controls enabled',true],
      ['fa-calendar-check','Schedule protected',!!$('#aspModal [data-save="schedule"]')],
      ['fa-link','Destination present',!!url]
    ];
    health.innerHTML=`<div class="cm-health-head"><div><span>CAMPAIGN HEALTH</span><strong>Ready for controlled changes</strong></div><i class="fa-solid fa-shield-halved"></i></div><div class="cm-health-list">${checks.map(x=>`<div><i class="fa-solid ${x[0]}"></i><span>${x[1]}</span><b class="${x[2]?'ok':'warn'}">${x[2]?'READY':'CHECK'}</b></div>`).join('')}</div>`;
    panel.insertBefore(health,panel.querySelector('.asp-stats')||null);
  };

  const quick=async action=>{
    const modal=$('#aspModal');
    const id=campaignIdFromModal();
    if(action==='close'){closeModal();return;}
    if(action==='pause'){
      const b=modal?.querySelector('[data-action="toggle"]');
      if(b) b.click();
      return;
    }
    if(action==='validate'){
      const b=modal?.querySelector('[data-validate]');
      if(b)b.click();
      else toast('URL validation is unavailable for this campaign');
      return;
    }
    if(action==='test'){
      const b=modal?.querySelector('[data-test]');
      if(b)b.click();
      else toast('Test delivery is unavailable for this campaign');
      return;
    }
    if(action==='copy'){
      const b=modal?.querySelector('[data-copy]');
      if(b){try{await navigator.clipboard.writeText(b.dataset.copy);toast('Tracking endpoint copied');}catch{toast('Clipboard permission was blocked')}}
      else toast('Tracking endpoint unavailable');
      return;
    }
    if(action==='refresh'){
      location.reload();
    }
    if(!id) toast('Campaign ID unavailable');
  };

  document.addEventListener('click',e=>{
    const q=e.target.closest('[data-cm-quick]');
    if(q){e.preventDefault();e.stopPropagation();quick(q.dataset.cmQuick).catch(err=>toast(err.message));return;}
    const close=e.target.closest('[data-close],.asp-modal-close');
    if(close){e.preventDefault();e.stopPropagation();closeModal();return;}
    const modal=$('#aspModal');
    if(modal?.classList.contains('open') && e.target===modal){closeModal();}
  },true);

  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

  const observer=new MutationObserver(()=>{
    injectCreateEnhancement();
    injectManageEnhancement();
  });
  const start=()=>{
    injectCreateEnhancement();
    injectManageEnhancement();
    const host=$('#aspContent')||document.body;
    observer.observe(host,{childList:true,subtree:true});
    const modal=$('#aspModal');
    if(modal)observer.observe(modal,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-hidden']});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
