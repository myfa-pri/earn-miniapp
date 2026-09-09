import fs from 'fs';
import path from 'path';

const root = process.cwd();
const publicDir = path.join(root, 'public');

// Restore the richer legacy admin panel at the URL used by the Telegram admin button.
const legacyAdmin = path.join(publicDir, 'admin-live.html');
const adminTarget = path.join(publicDir, 'myfa.html');
if (fs.existsSync(legacyAdmin)) {
  fs.copyFileSync(legacyAdmin, adminTarget);
}

// Remove the legacy Monetag 41731 SDK that can auto-initialize at first page load.
const indexPath = path.join(publicDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html
    .replace(/\s*<script\b[^>]*src=["'](?:https?:)?\/\/libtl\.com\/sdk\.js["'][^>]*data-zone=["']41731["'][^>]*><\/script>\s*/gi, '\n')
    .replace(/\s*<script\b[^>]*src=["'](?:https?:)?\/\/libtl\.com\/sdk\.js["'][^>]*data-sdk=["']show_41731["'][^>]*><\/script>\s*/gi, '\n');
  fs.writeFileSync(indexPath, html);
}

// Do not configure Monetag in-app interstitials automatically.
// Rewarded ads remain available only through explicit user actions.
const runtimePath = path.join(publicDir, 'ads-reward-runtime.js');
if (fs.existsSync(runtimePath)) {
  let js = fs.readFileSync(runtimePath, 'utf8');
  const start = js.indexOf('  const configureMonetagInApp = () => {');
  const end = js.indexOf('\n  const officialTasksActive = () => {', start);
  if (start >= 0 && end > start) {
    js = js.slice(0, start) + '  const configureMonetagInApp = () => {\n    // Intentionally disabled: never auto-show ads on initial app load.\n    return;\n  };\n' + js.slice(end);
  }
  fs.writeFileSync(runtimePath, js);
}

console.log('Cloudflare runtime repaired: admin panel restored and startup ads disabled.');
