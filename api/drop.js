import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    const file = path.join(process.cwd(), 'public', 'drop.html');
    let html = fs.readFileSync(file, 'utf8');

    const marker = '<p id="noChancesMsg" style="color:var(--color-magenta); display:none;">No chances left today! Complete tasks to earn more.</p>';
    const backButton = '<button id="dropOverlayBackBtn" type="button" class="drop-overlay-back-btn" onclick="window.location.href=\'/index.html?userId=\' + encodeURIComponent(userId || \'\')"><i class="fa-solid fa-arrow-left"></i> Back to MYFA BIRR Hub</button>';

    // Put a real Back button directly inside the start overlay. It is not
    // controlled by a separate observer, so it cannot disappear behind the
    // no-chances message or lose to an inline display rule.
    if (html.includes(marker) && !html.includes('id="dropOverlayBackBtn"')) {
      html = html.replace(marker, marker + '\n        ' + backButton);
    }

    const fixCss = `
<style id="drop-navigation-fix">
.header{
  position:relative !important;
  z-index:1000 !important;
}
.back-btn{
  position:relative;
  z-index:1001 !important;
}
#dropOverlayBackBtn{
  display:flex !important;
  align-items:center;
  justify-content:center;
  gap:8px;
  width:min(360px,calc(100vw - 40px));
  min-height:48px;
  padding:13px 20px;
  margin-top:24px;
  border-radius:14px;
  border:1px solid rgba(255,255,255,.28);
  background:linear-gradient(135deg,#00F2FE,#4FACFE);
  color:#07111f;
  box-shadow:0 10px 30px rgba(0,0,0,.45),0 0 22px rgba(0,242,254,.28);
  font-weight:900;
  font-size:1rem;
  cursor:pointer;
  text-transform:none;
  letter-spacing:0;
  position:relative;
  z-index:100002;
}
#dropOverlayBackBtn:active{
  transform:scale(.98);
}
</style>`;

    html = html.replace('</head>', fixCss + '\n</head>');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (e) {
    console.error('[drop.js]', e);
    return res.status(500).send('Unable to load Drop Game');
  }
}
