import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  try {
    const file = path.join(process.cwd(), 'public', 'drop.html');
    let html = fs.readFileSync(file, 'utf8');

    html = html.replace(
      '<button class="back-btn" onclick="window.location.href=\'/index.html?userId=\' + encodeURIComponent(userId || \'\')">Back to MYFA BIRR Hub</button>',
      '<button class="back-btn" id="dropHeaderBackBtn" onclick="window.location.href=\'/index.html?userId=\' + encodeURIComponent(userId || \'\')">Back to MYFA BIRR Hub</button>'
    );

    html = html.replace(
      '<p id="noChancesMsg" style="color:var(--color-magenta); display:none;">No chances left today! Complete tasks to earn more.</p>',
      '<p id="noChancesMsg" style="color:var(--color-magenta); display:none;">No chances left today! Complete tasks to earn more.</p>' +
      '<button id="noChancesBackBtn" class="quantum-btn drop-overlay-back" type="button" onclick="window.location.href=\'/index.html?userId=\' + encodeURIComponent(userId || \'\')">Back to MYFA BIRR Hub</button>'
    );

    const fixCss = `
<style id="drop-navigation-fix">
.header{position:relative !important;z-index:1000 !important;}
.back-btn{position:relative;z-index:1001 !important;}
.drop-overlay-back{display:none;background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.25);box-shadow:none;text-transform:none;font-size:1rem;margin-top:14px;}
#noChancesMsg[style*="display: block"] + .drop-overlay-back{display:block;}
</style>`;

    html = html.replace('</head>', fixCss + '\n</head>');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (e) {
    console.error('[drop.js]', e);
    return res.status(500).send('Unable to load Drop Game');
  }
}
