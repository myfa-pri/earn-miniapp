const fs = require('fs');
const path = 'c:/Users/Admin/Downloads/earn-miniapp-main (2)/earn-miniapp-main/public/index.html';
let content = fs.readFileSync(path, 'utf8');

// 1. Replace Loading Overlay
content = content.replace(/<div id="loading-overlay">[\s\S]*?<\/div>\s*<style>@keyframes loadingBar[\s\S]*?<\/style>/, 
`<div id="loading-overlay" class="holographic-loader">
        <div class="hologram-wrapper">
            <div class="hologram-ring ring1"></div>
            <div class="hologram-ring ring2"></div>
            <div class="hologram-ring ring3"></div>
            <div class="hologram-core"></div>
        </div>
        <div class="hologram-text">AUTHENTICATING...</div>
    </div>`);

// 2. Remove Theme Toggle (pill)
content = content.replace(/<div id="themeToggle"[^>]*>.*?<\/div>\s*<div style="width:1px; background:rgba\(255,255,255,0\.2\);"><\/div>/, '');

// 3. Replace pageHeader
content = content.replace(/<div id="pageHeader" class="page-header glass">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
`<div id="pageHeader" class="quantum-header">
            <div style="display:flex; align-items:center; gap:12px;">
                <div class="hologram-avatar" id="pageHeaderAvatar"></div>
                <div style="display:flex; flex-direction:column; justify-content:center; z-index: 2;">
                    <div style="font-weight:800; font-size:1.1rem; line-height:1;" id="pageHeaderName">User</div>
                    <div style="font-size:0.75rem; color:#64748B; font-weight:700; margin-top:2px;" id="pageHeaderStatus">Member</div>
                    <div style="font-size:0.65rem; color:var(--success-color); font-weight:bold; margin-top:2px;" id="onlineCounter"><i class="fa-solid fa-circle" style="font-size:0.5rem; animation: pulse 2s infinite;"></i> 0 Online</div>
                </div>
            </div>
            <div class="balances" style="z-index: 2;">
                <div class="bal-gems"><i class="fa-solid fa-gem"></i> <span id="pageHeaderBalance" class="odometer">0</span></div>
                <div class="bal-real"><i class="fa-solid fa-money-bill-wave"></i> $<span id="pageHeaderRealBalance">0.00</span></div>
            </div>
        </div>`);

// 4. Replace bottomNav
content = content.replace(/<div class="bottom-nav glass" id="bottomNav">[\s\S]*?<\/div>/,
`<div class="quantum-nav" id="bottomNav">
            <a class="nav-item active" data-page="home" onclick="nav('home')"><i class="fa-solid fa-house"></i><span>Home</span></a>
            <a class="nav-item" data-page="tasks" onclick="nav('tasks')"><i class="fa-solid fa-list-check"></i><span>Tasks</span></a>
            <a class="nav-item" data-page="games" onclick="nav('games')"><i class="fa-solid fa-gamepad"></i><span>Hub</span></a>
            <a class="nav-item" data-page="referrals" onclick="nav('referrals')"><i class="fa-solid fa-user-group"></i><span>Invite</span></a>
            <a class="nav-item" data-page="leaderboard" onclick="nav('leaderboard')"><i class="fa-solid fa-trophy"></i><span>Top</span></a>
            <a class="nav-item" data-page="settings" onclick="window.location.href='setting.html'"><i class="fa-solid fa-gear"></i><span>Settings</span></a>
        </div>`);

// 5. Global replacements for glass to cyber-card, btn-primary to quantum-btn
content = content.replace(/class="([^"]*)glass([^"]*)"/g, (match, p1, p2) => {
    if (p1.includes('floating-pill') || p1.includes('sticky-footer')) return `class="${p1}cyber-card${p2}"`;
    if (p1.includes('ad-card') || p1.includes('search-bar')) return `class="${p1.trim()}${p2}"`;
    return `class="${p1}cyber-card${p2}"`;
});
content = content.replace(/btn-primary/g, 'quantum-btn');

fs.writeFileSync(path, content, 'utf8');
console.log('Update complete.');
