import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    const file = path.join(process.cwd(), 'public', 'drop.html');
    let html = fs.readFileSync(file, 'utf8');

    const fixScript = `
<style id="drop-navigation-fix">
.header{position:relative !important;z-index:1000 !important;}
.back-btn{position:relative;z-index:1001 !important;}
#dropOverlayBackBtn{display:none;position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:100001;width:min(360px,calc(100vw - 40px));padding:14px 20px;border-radius:14px;background:linear-gradient(135deg,#00F2FE,#4FACFE);border:1px solid rgba(255,255,255,.35);box-shadow:0 12px 35px rgba(0,0,0,.45),0 0 25px rgba(0,242,254,.35);color:#07111f;font-weight:900;font-size:1rem;cursor:pointer;text-align:center;}
#dropOverlayBackBtn.show{display:block;}
</style>
<script>
(function(){
  function syncDropBack(){
    var btn=document.getElementById('dropOverlayBackBtn');
    var overlay=document.getElementById('startOverlay');
    var noMsg=document.getElementById('noChancesMsg');
    if(!btn||!overlay||!noMsg)return;
    var overlayVisible=getComputedStyle(overlay).display!=='none';
    var noChancesVisible=getComputedStyle(noMsg).display!=='none';
    btn.classList.toggle('show',overlayVisible&&noChancesVisible);
  }
  window.addEventListener('DOMContentLoaded',function(){
    var btn=document.createElement('button');
    btn.id='dropOverlayBackBtn';
    btn.type='button';
    btn.textContent='Back to MYFA BIRR Hub';
    btn.onclick=function(){
      var uid=(typeof userId!=='undefined'&&userId)?userId:'';
      window.location.href='/index.html?userId='+encodeURIComponent(uid);
    };
    document.body.appendChild(btn);
    var overlay=document.getElementById('startOverlay');
    var noMsg=document.getElementById('noChancesMsg');
    if(overlay&&noMsg){
      var mo=new MutationObserver(syncDropBack);
      mo.observe(overlay,{attributes:true,attributeFilter:['style','class']});
      mo.observe(noMsg,{attributes:true,attributeFilter:['style','class','hidden']});
    }
    syncDropBack();
    setInterval(syncDropBack,250);
  });
})();
</script>`;

    html = html.replace('</head>', fixScript + '\n</head>');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (e) {
    console.error('[drop.js]', e);
    return res.status(500).send('Unable to load Drop Game');
  }
}
