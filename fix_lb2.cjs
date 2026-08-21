const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

const correctRenderLeaderboard = `
        async function renderLeaderboard(c) {
            c.innerHTML = \`
                <style>
                    /* Leaderboard Custom CSS */
                    .skeleton-row {
                        height: 60px;
                        background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.05) 75%);
                        background-size: 200% 100%;
                        animation: shimmer 1.5s infinite;
                        border-radius: 16px;
                        margin-bottom: 8px;
                    }
                    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                    
                    .podium-container {
                        display: flex;
                        align-items: flex-end;
                        justify-content: center;
                        gap: 15px;
                        margin-bottom: 30px;
                        margin-top: 40px;
                    }
                    
                    .podium-tier {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        text-align: center;
                    }
                    
                    .podium-avatar {
                        border-radius: 50%;
                        border: 3px solid var(--color-magenta);
                        background: #1E293B;
                        object-fit: cover;
                    }
                    
                    .rank-1 .podium-avatar { width: 90px; height: 90px; border-color: #FFD700; box-shadow: 0 0 30px rgba(255,215,0,0.4); z-index: 3; }
                    .rank-2 .podium-avatar { width: 75px; height: 75px; border-color: #C0C0C0; box-shadow: 0 0 20px rgba(192,192,192,0.4); z-index: 2; }
                    .rank-3 .podium-avatar { width: 65px; height: 65px; border-color: #CD7F32; box-shadow: 0 0 15px rgba(205,127,50,0.4); z-index: 1; }
                    
                    .podium-crown {
                        color: #FFD700;
                        font-size: 1.8rem;
                        margin-bottom: -15px;
                        z-index: 4;
                        filter: drop-shadow(0 0 10px rgba(255,215,0,0.8));
                    }
                    .rank-2 .podium-crown, .rank-3 .podium-crown { display: none; }
                    
                    .podium-name { font-weight: 800; font-size: 0.9rem; margin-top: 8px; max-width: 90px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                    .podium-gems { font-size: 0.8rem; color: var(--color-cyan); font-weight: 900; }
                    
                    .lb-list-item {
                        display: flex;
                        align-items: center;
                        background: rgba(255,255,255,0.03);
                        border: 1px solid rgba(255,255,255,0.05);
                        border-radius: 16px;
                        padding: 12px 15px;
                        margin-bottom: 8px;
                        transition: transform 0.2s;
                    }
                    .lb-list-item:active { transform: scale(0.98); }
                    
                    .lb-badge {
                        width: 30px;
                        font-weight: 900;
                        color: #94A3B8;
                        font-size: 1.1rem;
                    }
                    
                    .lb-avatar {
                        width: 45px;
                        height: 45px;
                        border-radius: 50%;
                        margin-right: 15px;
                        object-fit: cover;
                        border: 2px solid rgba(255,255,255,0.1);
                    }
                    
                    .lb-name { flex: 1; font-weight: bold; font-size: 1rem; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; }
                    .lb-gems { font-weight: 900; color: var(--color-cyan); font-size: 1rem; }
                    
                    .lb-sticky-footer {
                        position: fixed;
                        bottom: 85px;
                        left: 0;
                        right: 0;
                        background: rgba(15, 23, 42, 0.95);
                        backdrop-filter: blur(20px);
                        border-top: 1px solid rgba(255,255,255,0.1);
                        padding: 15px 20px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        z-index: 90;
                        box-shadow: 0 -10px 30px rgba(0,0,0,0.5);
                    }
                </style>
                <div class="header-main" style="padding: 20px 15px 5px 15px; background: none; border: none; box-shadow: none;">
                    <h2 style="font-size: 1.8rem; margin:0;"><i class="fa-solid fa-trophy" style="color:#FFD700;"></i> Top 100</h2>
                    <p style="color:#94A3B8; margin-top:5px; font-size:0.9rem;">Rankings update in real-time</p>
                </div>
                
                <div id="leaderboardLoading" style="padding: 15px;">
                    <div class="skeleton-row" style="height:150px; margin-bottom:30px; border-radius:20px;"></div>
                    <div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div>
                </div>
                
                <div id="podiumContainer" class="podium-container"></div>
                <div id="leaderboardList" style="padding: 0 15px; margin-bottom: 140px; display:none;"></div>
                <div id="leaderboardFooter" class="lb-sticky-footer" style="display:none;"></div>
            \`;
            
            try {
                const res = await fetch(\`\${API_BASE_URL}/api/leaderboard/\${userId}\`);
                const data = await res.json();
                
                const loader = document.getElementById('leaderboardLoading');
                if (loader) loader.style.display = 'none';

                const listContainer = document.getElementById('leaderboardList');
                if (!listContainer) return; // user navigated away

                if (data.frozen) {
                    const banner = document.createElement('div');
                    banner.style = "background:var(--danger-color); color:white; text-align:center; padding:10px; font-weight:bold; position:sticky; top:0; z-index:99; margin-bottom:15px;";
                    banner.innerHTML = "🏆 Leaderboard is Currently Frozen for Payouts";
                    listContainer.parentNode.insertBefore(banner, document.getElementById('podiumContainer'));
                }
                
                const top100 = data.byPoints || [];
                
                // --- PODIUM (Top 3) ---
                const podiumCont = document.getElementById('podiumContainer');
                const top3 = top100.slice(0, 3);
                
                if (top3.length > 0) {
                    // Order for layout: 2nd, 1st, 3rd
                    const order = [1, 0, 2];
                    let podiumHtml = '';
                    
                    order.forEach(idx => {
                        const u = top3[idx];
                        if(!u) return;
                        
                        const rank = idx + 1;
                        const realName = u.accountName || u.username || 'Anonymous';
                        const fbUrl = \`https://ui-avatars.com/api/?name=\${encodeURIComponent(realName)}&background=B026FF&color=fff\`;
                        const avatarUrl = u.id ? \`\${API_BASE_URL}/api/avatar/\${u.id}\` : fbUrl;
                        
                        const nameColor = u.usernameColor ? \`color: \${u.usernameColor} !important;\` : '';
                        const badge = u.titleBadge && u.titleBadge !== 'None' ? \`<span style="font-size:0.6rem; background:rgba(255,255,255,0.2); padding:2px 5px; border-radius:4px; margin-right:3px;">\${u.titleBadge}</span>\` : '';
                        
                        podiumHtml += \`
                            <div class="podium-tier rank-\${rank}">
                                <div class="podium-crown"><i class="fa-solid fa-crown"></i></div>
                                <img loading="lazy" src="\${avatarUrl}" class="podium-avatar" loading="lazy" onerror="this.onerror=null; this.src='\${fbUrl}';">
                                <div class="podium-name" style="\${nameColor}">\${badge}\${realName}</div>
                                <div class="podium-gems"><i class="fa-solid fa-gem"></i> \${Number(u.points || 0).toLocaleString()}</div>
                            </div>
                        \`;
                    });
                    
                    podiumCont.innerHTML = podiumHtml;
                }

                // --- REST OF LIST (4-100) ---
                let listHtml = '';
                for (let i = 3; i < top100.length; i++) {
                    const u = top100[i];
                    const rank = i + 1;
                    const realName = u.accountName || u.username || 'Anonymous';
                    const fbUrl = \`https://ui-avatars.com/api/?name=\${encodeURIComponent(realName)}&background=B026FF&color=fff\`;
                    const avatarUrl = u.id ? \`\${API_BASE_URL}/api/avatar/\${u.id}\` : fbUrl;
                    
                    const nameColor = u.usernameColor ? \`color: \${u.usernameColor} !important;\` : '';
                    const badge = u.titleBadge && u.titleBadge !== 'None' ? \`<span style="font-size:0.6rem; background:rgba(255,255,255,0.2); padding:2px 5px; border-radius:4px; margin-right:3px;">\${u.titleBadge}</span>\` : '';
                    
                    listHtml += \`
                        <div class="lb-list-item">
                            <div class="lb-badge">\${rank}</div>
                            <img loading="lazy" src="\${avatarUrl}" class="lb-avatar" loading="lazy" onerror="this.onerror=null; this.src='\${fbUrl}';">
                            <div class="lb-name" style="\${nameColor}">\${badge}\${realName}</div>
                            <div class="lb-gems">\${Number(u.points || 0).toLocaleString()} <i class="fa-solid fa-gem"></i></div>
                        </div>
                    \`;
                }
                listContainer.innerHTML = listHtml;
                listContainer.style.display = 'block';

                // --- STICKY FOOTER (99+) ---
                const footer = document.getElementById('leaderboardFooter');
                const userRank = data.userRankPoints;
                
                let myName = currentUser.accountName || currentUser.username || 'Anonymous';
                let myAvatar = currentUser.avatarUrl || \`https://ui-avatars.com/api/?name=\${encodeURIComponent(myName)}&background=B026FF&color=fff\`;
                
                let displayRank = (userRank && userRank >= 1 && userRank <= 100) ? userRank : '99+';
                let rankColor = displayRank === '99+' ? 'var(--color-magenta)' : 'white';

                footer.innerHTML = \`
                    <div style="display:flex; align-items:center; gap:10px; max-width: 45%;">
                        <img loading="lazy" src="\${myAvatar}" style="width:40px; height:40px; border-radius:50%; border:2px solid var(--color-cyan);">
                        <div style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden; max-width: 100%;">
                            <div style="font-weight:800; font-size:1rem; color:white; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">\${myName}</div>
                        </div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-weight:bold; font-size:0.75rem; color:#94A3B8;">Rank</div>
                        <div style="font-weight:900; font-size:1.1rem; color:\${rankColor};">\${displayRank === '99+' ? displayRank : '#' + displayRank}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:bold; font-size:0.75rem; color:#94A3B8;">Gems</div>
                        <div style="font-weight:900; font-size:1.1rem; color:var(--color-cyan); display:flex; align-items:center; gap:5px; justify-content:flex-end;">
                            \${Number(currentUser.points).toLocaleString()} <i class="fa-solid fa-gem"></i>
                        </div>
                    </div>
                \`;
                footer.style.display = 'flex';
                
            } catch (err) {
                console.error(err);
                if (document.getElementById('leaderboardLoading')) {
                    document.getElementById('leaderboardLoading').innerHTML = \`
                        <div style="text-align:center; color:var(--danger-color); padding: 20px;">
                            <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:10px;"></i>
                            <div>Failed to load leaderboard. Retrying...</div>
                        </div>
                    \`;
                    setTimeout(() => renderLeaderboard(c), 3000);
                }
            }
        }
`;

const i1 = html.indexOf('async function renderLeaderboard(c)');
const i2 = html.indexOf('function fetchProfileParams');
if (i1 > -1 && i2 > -1) {
    html = html.substring(0, i1) + correctRenderLeaderboard + "\n        " + html.substring(i2);
    fs.writeFileSync('public/index.html', html);
    console.log("Successfully manually sliced and replaced renderLeaderboard.");
} else {
    console.log("Could not find indices.");
}
