const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// 1. Re-add renderTasks, renderGames, renderInvite
const additionalFunctions = `

function renderTasks(container) {
    container.innerHTML = \`
        <div class="card fade-in cyber-card">
            <h2 style="margin-bottom: 20px; font-weight: 700; color: var(--color-cyan);"><i class="fa-solid fa-list-check"></i> Earn Gems</h2>
            
            <div class="task-list" style="display:flex; flex-direction:column; gap:15px;">
                <div class="task-item" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 15px; display:flex; justify-content:space-between; align-items:center;">
                    <div class="task-info" style="display:flex; align-items:center; gap:15px;">
                        <i class="fa-brands fa-youtube" style="color: #ff0000; font-size:2rem;"></i>
                        <div>
                            <div class="task-title" style="font-weight:bold; font-size:1.1rem;">Watch Video</div>
                            <div class="task-reward" style="color:var(--color-cyan); font-size:0.9rem;">+500 Gems</div>
                        </div>
                    </div>
                    <button class="btn btn-secondary" style="width:auto; padding:8px 15px;" onclick="showToast('Watching...', 'info')">Start</button>
                </div>

                <div class="task-item" style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 15px; display:flex; justify-content:space-between; align-items:center;">
                    <div class="task-info" style="display:flex; align-items:center; gap:15px;">
                        <i class="fa-brands fa-twitter" style="color: #1da1f2; font-size:2rem;"></i>
                        <div>
                            <div class="task-title" style="font-weight:bold; font-size:1.1rem;">Follow Us</div>
                            <div class="task-reward" style="color:var(--color-cyan); font-size:0.9rem;">+1,000 Gems</div>
                        </div>
                    </div>
                    <button class="btn btn-secondary" style="width:auto; padding:8px 15px;" onclick="showToast('Verified!', 'success')">Verify</button>
                </div>
            </div>
        </div>
    \`;
}

function renderGames(container) {
    container.innerHTML = \`
        <div class="card fade-in cyber-card">
            <h2 style="margin-bottom: 20px; font-weight: 700; color: var(--color-magenta);"><i class="fa-solid fa-gamepad"></i> Game Hub</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">Play to earn real rewards.</p>
            
            <div style="display:grid; grid-template-columns: 1fr; gap: 15px;">
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 15px; display:flex; align-items:center; justify-content:space-between;">
                    <div>
                        <b style="color:white; font-size:1.1rem;">Tap to Earn</b>
                        <div style="color:var(--text-secondary); font-size:0.9rem; margin-top:5px;">Classic clicker game</div>
                    </div>
                    <button class="btn quantum-btn" style="width:auto; padding: 10px 20px;" onclick="openGame('tap')">Play</button>
                </div>
                
                <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 15px; display:flex; align-items:center; justify-content:space-between;">
                    <div>
                        <b style="color:white; font-size:1.1rem;">Spin the Wheel</b>
                        <div style="color:var(--text-secondary); font-size:0.9rem; margin-top:5px;">Daily lucky spin</div>
                    </div>
                    <button class="btn quantum-btn" style="width:auto; padding: 10px 20px;" onclick="openGame('spin')">Play</button>
                </div>
            </div>
        </div>
    \`;
}

function renderInvite(container) {
    container.innerHTML = \`
        <div class="card fade-in cyber-card" style="text-align: center;">
            <i class="fa-solid fa-users" style="font-size: 3rem; color: var(--color-cyan); margin-bottom: 15px;"></i>
            <h2 style="margin-bottom: 10px; font-weight: 700;">Invite Friends</h2>
            <p style="color: var(--text-secondary); margin-bottom: 20px;">Earn 50,000 Gems for each referral!</p>
            
            <div style="background: rgba(0,0,0,0.4); padding: 15px; border-radius: 10px; border: 1px dashed var(--color-cyan); margin-bottom: 20px;">
                <code style="color: white; font-size: 1.2rem;" id="refLink">t.me/MYFA_bot?start=\${currentUser.id || '123'}</code>
            </div>
            
            <button class="btn quantum-btn" onclick="copyRef()">Copy Link <i class="fa-solid fa-copy"></i></button>
            <div style="margin-top: 15px; font-size: 0.9rem; color: var(--color-magenta);" id="copyMsg"></div>
        </div>
    \`;
}

function renderReferrals(container) {
    renderInvite(container);
}

function copyRef() {
    const text = document.getElementById('refLink').innerText;
    navigator.clipboard.writeText(text).then(() => {
        document.getElementById('copyMsg').innerText = "Copied to clipboard!";
        setTimeout(() => document.getElementById('copyMsg').innerText = "", 2000);
    });
}
`;

if (!html.includes('function renderTasks')) {
    html = html.replace('function openGame(gameId)', additionalFunctions + '\n\nfunction openGame(gameId)');
}

// 2. Add Stats grid to renderHome
const statsGrid = `
            <!-- Stats Grid -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom: 20px;">
                <div class="stat-card" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05); padding:15px; border-radius:15px; text-align:center;">
                    <i class="fa-solid fa-trophy" style="color:var(--color-magenta); font-size:1.5rem; margin-bottom:10px;"></i>
                    <div style="font-size:0.9rem; color:var(--text-secondary);">Level</div>
                    <div style="font-size:1.2rem; font-weight:bold;">\${currentUser.level || 1}</div>
                </div>
                <div class="stat-card" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05); padding:15px; border-radius:15px; text-align:center;">
                    <i class="fa-solid fa-ranking-star" style="color:var(--color-cyan); font-size:1.5rem; margin-bottom:10px;"></i>
                    <div style="font-size:0.9rem; color:var(--text-secondary);">Global Rank</div>
                    <div style="font-size:1.2rem; font-weight:bold;">#\${currentUser.rank || 'N/A'}</div>
                </div>
                <div class="stat-card" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05); padding:15px; border-radius:15px; text-align:center;">
                    <i class="fa-solid fa-play" style="color:#ef4444; font-size:1.5rem; margin-bottom:10px;"></i>
                    <div style="font-size:0.9rem; color:var(--text-secondary);">Ads Watched</div>
                    <div style="font-size:1.2rem; font-weight:bold;">\${currentUser.totalAdsWatchedLifetime || 0}</div>
                </div>
                <div class="stat-card" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.05); padding:15px; border-radius:15px; text-align:center;">
                    <i class="fa-solid fa-users" style="color:#10b981; font-size:1.5rem; margin-bottom:10px;"></i>
                    <div style="font-size:0.9rem; color:var(--text-secondary);">Invites</div>
                    <div style="font-size:1.2rem; font-weight:bold;">\${currentUser.referredUsers ? currentUser.referredUsers.length : 0}</div>
                </div>
            </div>
`;

if (html.includes('<!-- Daily Streak -->') && !html.includes('<!-- Stats Grid -->')) {
    html = html.replace('<!-- Daily Streak -->', statsGrid + '\n            <!-- Daily Streak -->');
}

fs.writeFileSync('public/index.html', html);
console.log("Patched index.html with missing views and stats grid.");
