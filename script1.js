
        let errCount = 0;
        window.onerror = function(msg, url, lineNo, columnNo, error) {
            errCount++;
            console.error("Silenced JS Error:", msg, lineNo);
            if(errCount > 10) window.location.reload();
            return true;
        };
        window.addEventListener('unhandledrejection', function(event) {
            errCount++;
            console.error("Silenced Promise Rejection:", event.reason);
            event.preventDefault();
            if(errCount > 10) window.location.reload();
        });

        const API_BASE_URL = ''; 
        let currentUser = null, userId = null, startParam = null;
        
        // Aviator State
        let aviatorMultiplier = 1.00;
        let aviatorActive = false;
        let audioCtx = null, oscillator = null, gainNode = null;
        
        let currentLang = localStorage.getItem('appLang');
        let soundEnabled = localStorage.getItem('appSound') !== 'false';
        let appConfig = {};
        let globalTotalUsers = 10;
        
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                // Fetch Global Config First
                const globRes = await fetch(`${API_BASE_URL}/api/public/globals`);
                if(globRes.ok) {
                    const data = await globRes.json();
                    appConfig = data.config || {};
                    globalTotalUsers = data.totalUsers || 10;
                }

                // 1. Maintenance Mode
                if (appConfig.maintenanceMode) {
                    document.body.innerHTML = `
                        <div style="height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; background:rgba(0,0,0,0.8); backdrop-filter:blur(20px);">
                            <i class="fa-solid fa-triangle-exclamation" style="font-size:5rem; color:#EF4444; margin-bottom:20px; filter:drop-shadow(0 0 20px rgba(239,68,68,0.5));"></i>
                            <h1 style="color:white; font-size:2rem; text-align:center;">System Under Maintenance</h1>
                            <p style="color:#A7F3D0; margin-top:10px;">Please check back later.</p>
                        </div>
                    `;
                    return;
                }

                // 2. Forced Language
                if (appConfig.forcedLang && appConfig.forcedLang.toLowerCase() !== 'auto') {
                    currentLang = appConfig.forcedLang.toUpperCase();
                    const langBtn = document.getElementById('langToggle'); if(langBtn) { langBtn.style.display = 'none'; if(langBtn.previousElementSibling) langBtn.previousElementSibling.style.display = 'none'; }
                    
                } else if (!currentLang) {
                    currentLang = 'EN';
                }
                if(document.getElementById('langToggle')) document.getElementById('langToggle').innerText = currentLang;

                // 3. Default Theme
                const savedTheme = localStorage.getItem('appTheme');
                if (!savedTheme && typeof appConfig.defaultNight === 'boolean') {
                    if (!appConfig.defaultNight) {
                        document.body.classList.add('theme-light');
                        localStorage.setItem('appTheme', 'light');
                    }
                }
                
                const themeBtn = document.getElementById('themeToggle');
                if (localStorage.getItem('appTheme') === 'light' || document.body.classList.contains('theme-light')) {
                    document.body.classList.add('theme-light');
                    document.body.classList.remove('dark-mode');
                    if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-sun" style="color:#FFB347"></i>';
                } else {
                    document.body.classList.remove('theme-light');
                    if (themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
                }

                // 4. Default Sound
                if (!localStorage.getItem('appSound') && typeof appConfig.defaultSound === 'boolean') {
                    soundEnabled = appConfig.defaultSound;
                }
                const soundBtn = document.getElementById('soundToggle'); if(soundBtn) soundBtn.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';

                const tg = window.Telegram.WebApp;
                tg.expand();

                const tgUser = tg.initDataUnsafe?.user;
                const urlParams = new URLSearchParams(window.location.search);
                const impersonatedUserId = urlParams.get('impersonate');
                
                if (!impersonatedUserId && (!tgUser || !tgUser.id)) {
                    document.body.innerHTML = "<h2 style='text-align:center; margin-top:50px;'>Telegram Web App Error. Please open inside Telegram.</h2>";
                    return;
                }
                
                // 5. VPN / Proxy Check
                if (appConfig.blockVpn) {
                    try {
                        const ipRes = await fetch(`${API_BASE_URL}/api/check-ip`);
                        const ipData = await ipRes.json();
                        if (!ipData.allowed) {
                            document.body.innerHTML = "<h2 style='text-align:center; color:red; margin-top:50px;'>Access Denied (VPN/Proxy Detected)</h2>";
                            return;
                        }
                    } catch(e) {}
                }

                // 6. Max Sessions (UUID generation)
                let sessionId = localStorage.getItem('appSessionId');
                if (!sessionId) {
                    sessionId = (crypto.randomUUID && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
                    localStorage.setItem('appSessionId', sessionId);
                }
                
                userId = impersonatedUserId || tgUser.id.toString();
                startParam = tg.initDataUnsafe?.start_param || null;

                if (impersonatedUserId) {
                    const banner = document.createElement('div');
                    banner.style = "background:red; color:white; text-align:center; padding:5px; font-weight:bold; position:fixed; top:0; width:100%; z-index:9999;";
                    banner.innerText = "ADMIN IMPERSONATION MODE: " + userId;
                    document.body.appendChild(banner);
                }

                const realName = tgUser ? (tgUser.first_name + (tgUser.last_name ? " " + tgUser.last_name : "")) : "Impersonated User";

                let res = await fetch(`${API_BASE_URL}/api/user/${userId}?sessionId=${sessionId}`);
                if (res.status === 401) {
                    document.body.innerHTML = "<h2 style='text-align:center; color:red; margin-top:50px;'>Session Revoked. Too many active devices.</h2>";
                    return;
                }
                if(!res.ok) {
                    res = await fetch(`${API_BASE_URL}/api/ensure-user`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId, username: realName, refParam: startParam })
                    });
                    res = await fetch(`${API_BASE_URL}/api/user/${userId}?sessionId=${sessionId}`);
                }
                currentUser = await res.json();
                
                updateUI();
                
                if(currentUser.isBanned) {
                    document.body.innerHTML = "<h2 style='text-align:center; color:red; margin-top:50px;'>ACCOUNT BANNED</h2>";
                    return;
                }

                // Fade out loading
                setTimeout(() => {
    const l = document.getElementById('loading-overlay');
    if (l) { l.style.opacity = '0'; l.style.pointerEvents = 'none'; setTimeout(()=> { l.style.display = 'none'; }, 500); }
}, 1100);

                // GATE CHECK
                if (currentUser.requireGate === true) {
                    const gate = document.getElementById('gate-overlay');
                    const listHtml = appConfig.officialChannels.map((ch, idx) => {
                        const finalUrl = ch.link.startsWith('@') ? 'https://t.me/' + ch.link.substring(1) : ch.link;
                        return `
                        <div class="staggered-card" style="display:flex; justify-content:space-between; align-items:center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 15px; margin-bottom: 12px; animation: staggerFadeIn 0.5s ease forwards; animation-delay: ${idx * 0.15}s;">
                            <div style="display:flex; align-items:center; gap:12px; text-align:left;">
                                <i class="fa-brands ${ch.icon || 'fa-telegram'}" style="font-size:1.8rem; color:var(--color-cyan);"></i>
                                <span style="color:white; font-weight:600; font-size:1.1rem; line-height:1.2;">${ch.name}</span>
                            </div>
                            <button onclick="window.open('${finalUrl}', '_blank'); document.getElementById('verifyGateBtn').innerHTML = '<i class=\\'fa-solid fa-check-double\\'></i> Check'; document.getElementById('verifyGateBtn').style.background = '#3B82F6';" style="background:linear-gradient(90deg, var(--color-cyan), var(--color-purple)); border:none; color:white; padding:8px 25px; border-radius:50px; font-weight:700; cursor:pointer; box-shadow:0 4px 15px rgba(0,242,254,0.3);">Join Channel</button>
                        </div>
                        `;
                    }).join('');
                    document.getElementById('gateChannelList').innerHTML = listHtml;
                    gate.style.display = 'flex';
                    return; // Stop execution until gate passed
                }
                
                // 7. Idle Timeout
                if (appConfig.idleTimeout && appConfig.idleTimeout > 0) {
                    let idleTimer;
                    const resetTimer = () => {
                        clearTimeout(idleTimer);
                        idleTimer = setTimeout(() => {
                            document.body.innerHTML = `
                                <div style="height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center; background:rgba(0,0,0,0.8); backdrop-filter:blur(20px);">
                                    <i class="fa-solid fa-clock-rotate-left" style="font-size:5rem; color:#EF4444; margin-bottom:20px;"></i>
                                    <h1 style="color:white; font-size:2rem; text-align:center;">Session Timeout</h1>
                                    <p style="color:#A7F3D0; margin-top:10px;">You were inactive for too long.</p>
                                    <button class="btn quantum-btn" style="margin-top:20px;" onclick="location.reload()">Reload Application</button>
                                </div>
                            `;
                        }, appConfig.idleTimeout * 60000);
                    };
                    ['touchstart', 'mousemove', 'keydown', 'scroll', 'click'].forEach(evt => 
                        document.addEventListener(evt, resetTimer, { passive: true })
                    );
                    resetTimer();
                }
                
                // 8. 2X Event Badge
                if (appConfig.globalMultiplier == 2) {
                    const badge = document.createElement('div');
                    badge.innerHTML = `<i class="fa-solid fa-bolt"></i> 2X EVENT ACTIVE`;
                    badge.style = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:linear-gradient(90deg, #FF007A, #9D00FF); color:white; padding:5px 15px; border-radius:20px; font-weight:900; font-size:0.8rem; z-index:9999; box-shadow:0 0 15px #FF007A; animation: pulse 1s infinite alternate;";
                    document.body.appendChild(badge);
                    
                    const style = document.createElement('style');
                    style.innerHTML = `@keyframes pulse { from { opacity: 0.8; transform: translateX(-50%) scale(1); } to { opacity: 1; transform: translateX(-50%) scale(1.05); } }`;
                    document.head.appendChild(style);
                }
                
                // 9. Fake Online & Global Chat
                let totalOnline = globalTotalUsers;
                if (appConfig.fakeOnlineToggle) {
                    totalOnline = appConfig.fakeOnlineCount || 1000;
                    // Add random fluctuation
                    totalOnline += Math.floor(Math.random() * 50) - 25;
                }
                document.getElementById('onlineCounter').innerHTML = `<i class="fa-solid fa-circle" style="font-size:0.5rem; animation: pulse 2s infinite;"></i> ${totalOnline} Online`;

                if (appConfig.globalChatToggle !== false) {
                    const chatBtn = document.createElement('div');
                    chatBtn.id = 'officialChannelBtn';
                    chatBtn.innerHTML = `<i class="fa-solid fa-bullhorn"></i><span id="channelBadge" style="position:absolute; top:-5px; right:-5px; background:var(--danger-color); color:white; border-radius:50%; width:20px; height:20px; font-size:12px; display:none; justify-content:center; align-items:center;">!</span>`;
                    chatBtn.style = "position:fixed; bottom:80px; right:20px; width:50px; height:50px; border-radius:50%; background:var(--gradient-main); display:flex; justify-content:center; align-items:center; color:white; font-size:1.5rem; box-shadow:0 0 20px var(--color-magenta); z-index:999; cursor:pointer;";
                    chatBtn.onclick = async () => {
                        document.getElementById('channelOverlay').classList.add('open');
                        document.getElementById('channelBadge').style.display = 'none'; // mark read
                        try {
                            const res = await fetch(`${API_BASE_URL}/api/channel/posts`);
                            const posts = await res.json();
                            if(posts.length > 0) {
                                localStorage.setItem('lastSeenPostId', posts[0].id);
                                lastSeenPostId = posts[0].id;
                            }
                        } catch(e) {}
                    };
                    document.body.appendChild(chatBtn);
                    loadOfficialChannelPosts();
                }

                nav('home');
                startCSSListener();
            } catch (e) {
                console.error("Init Error", e);
            }
        });
        
        async function startCSSListener() {
            let lastToastTime = 0;
            setInterval(async () => {
                try {
                    const res = await fetch(`${API_BASE_URL}/api/public/globals`);
                    if(res.ok) {
                        const data = await res.json();
                        // Handle CSS
                        if(data.css && data.css.css) {
                            let styleTag = document.getElementById('admin-injected-css');
                            if(!styleTag) {
                                styleTag = document.createElement('style');
                                styleTag.id = 'admin-injected-css';
                                document.head.appendChild(styleTag);
                            }
                            if(styleTag.textContent !== data.css.css) {
                                styleTag.textContent = data.css.css;
                            }
                        }
                        // Handle Toast Broadcast
                        if(data.toast && data.toast.timestamp > lastToastTime) {
                            if(lastToastTime !== 0) { // Don't show on initial load
                                showToast("Global: " + data.toast.message, "info");
                            }
                            lastToastTime = data.toast.timestamp;
                        }
                    }
                } catch(e) {}
            }, 60000);
        }

        function toggleTheme() {
            const isLight = document.body.classList.contains('theme-light');
            const themeBtn = document.getElementById('themeToggle');
            if (isLight) {
                document.body.classList.remove('theme-light');
                localStorage.setItem('appTheme', 'dark');
                if(themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            } else {
                document.body.classList.add('theme-light');
                localStorage.setItem('appTheme', 'light');
                if(themeBtn) themeBtn.innerHTML = '<i class="fa-solid fa-sun" style="color:#FFB347"></i>';
            }
        }

const amharicDict = {
    "Home": "መነሻ",
    "Earn": "ያግኙ",
    "Tasks": "ተግባራት",
    "Leaderboard": "መሪ ሰሌዳ",
    "Invite": "ጋብዝ",
    "Invite & Earn": "ጋብዘው ያግኙ",
    "Earn 100 Gems for every friend you invite!": "ለሚጋብዙት ጓደኛ 100 እንቁዎችን ያግኙ!",
    "Your Invite Link": "የእርስዎ መጋበዣ ሊንክ",
    "Copy Link": "ሊንኩን ኮፒ ያድርጉ",
    "Share Link": "ሊንኩን ያጋሩ",
    "Referrals": "ሪፈራሎች",
    "Daily Combo": "ዕለታዊ ጥምረት",
    "Multiple OX": "የኦክስ ጨዋታ",
    "Official Channel": "ይፋዊ ቻናል",
    "Top 100 Players": "ምርጥ 100 ተጫዋቾች",
    "Current Balance": "የአሁኑ ቀሪ ሂሳብ",
    "Redeem": "መቀየር",
    "Enter Promo Code...": "የፕሮሞ ኮድ ያስገቡ...",
    "Withdraw": "ገንዘብ ማውጣት",
    "Coming Soon": "በቅርብ ቀን",
    "Loading...": "በመጫን ላይ..."
};

function translateDOM(node) {
    if(currentLang === 'EN') return; 
    if (node.nodeType === Node.TEXT_NODE) {
        let text = node.textContent.trim();
        if (amharicDict[text]) {
            node.originalText = text;
            node.textContent = node.textContent.replace(text, amharicDict[text]);
        }
    } else {
        if(node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
        for (let i = 0; i < node.childNodes.length; i++) {
            translateDOM(node.childNodes[i]);
        }
    }
}

function restoreDOM(node) {
    if (node.nodeType === Node.TEXT_NODE) {
        if (node.originalText) {
            node.textContent = node.textContent.replace(node.textContent.trim(), node.originalText);
            delete node.originalText;
        }
    } else {
        if(node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
        for (let i = 0; i < node.childNodes.length; i++) {
            restoreDOM(node.childNodes[i]);
        }
    }
}

function applyTranslation() {
    if (currentLang === 'AM') {
        translateDOM(document.body);
    } else {
        restoreDOM(document.body);
    }
}

        function toggleLang() {
            currentLang = currentLang === 'EN' ? 'AM' : 'EN';
            localStorage.setItem('appLang', currentLang);
            if(document.getElementById('langToggle')) document.getElementById('langToggle').innerText = currentLang;
            applyTranslation();
            showToast(currentLang === 'AM' ? 'ቋንቋ ወደ አማርኛ ተቀይሯል' : 'Language switched to EN', 'success');
            nav(document.querySelector('.nav-item.active').dataset.page);
        }

        function toggleSound() {
            soundEnabled = !soundEnabled;
            localStorage.setItem('appSound', soundEnabled);
            const soundBtn = document.getElementById('soundToggle'); if(soundBtn) soundBtn.innerHTML = soundEnabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
            showToast(soundEnabled ? "Sound Enabled" : "Sound Muted", 'info');
            if (!soundEnabled) {
                document.querySelectorAll('audio').forEach(a => {
                    a.pause();
                    a.currentTime = 0;
                });
                if(audioCtx && audioCtx.state === 'running') audioCtx.suspend();
            } else {
                if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
            }
        }

        function playSound(id) {
            if (!soundEnabled) return;
            const el = document.getElementById(id);
            if(el) {
                el.currentTime = 0;
                el.play().catch(e => console.error("Sound play blocked", e));
            }
        }

        function postTelegramStory() {
            if(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.shareToStory) {
                window.Telegram.WebApp.shareToStory('https://images.unsplash.com/photo-1621504450181-5d356f61d307?q=80&w=1000&auto=format&fit=crop', {
                    text: 'Join me and earn Gems! ' + currentUser.username
                });
            } else {
                showToast("Story API not supported on this client.", "error");
            }
        }

        
        
        
        function updateUI() {
            document.getElementById('pageHeaderName').textContent = currentUser.username;
            
            const isPriv = localStorage.getItem('set_priv') === 'true';
            const displayPoints = isPriv ? '****' : (currentUser.points || 0).toLocaleString();
            const displayReal = isPriv ? '****' : (currentUser.realBalance || 0).toFixed(2);
            
            if(document.getElementById('pageHeaderBalance')) document.getElementById('pageHeaderBalance').innerText = displayPoints;
            if(document.getElementById('pageHeaderRealBalance')) document.getElementById('pageHeaderRealBalance').innerText = displayReal;
            document.getElementById('pageHeaderStatus').innerHTML = currentUser.isVip ? '<i class="fa-solid fa-crown"></i> VIP' : 'Member';
            
            const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
            const avatarUrl = tgUser?.photo_url || currentUser.avatarUrl || `${window.location.origin}/api/avatar/${encodeURIComponent(userId)}`;
            document.getElementById('pageHeaderAvatar').style.backgroundImage = `url('${avatarUrl}')`;
            
            if (localStorage.getItem('set_data') === 'true') {
                document.body.classList.add('data-saver');
            } else {
                document.body.classList.remove('data-saver');
            }
        }
        
        function showToast(msg, type='info') {
            const t = document.getElementById('toast');
            if(document.getElementById('toast-msg')) document.getElementById('toast-msg').innerText = msg;
            t.className = `toast show ${type}`;
            setTimeout(() => t.className = 'toast', 3000);
        }

        
        var renderedPages = window.renderedPages || {};
        function nav(page) {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            let navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
            if(navItem) navItem.classList.add('active');
            
            document.getElementById('gameCanvasWrapper').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
            document.getElementById('pageHeader').style.display = 'flex';
            document.getElementById('leaderboardFooter').style.display = 'none';

            document.querySelectorAll('.page-container').forEach(el => {
                el.style.display = 'none';
                el.style.opacity = '0';
                el.style.transform = 'translate3d(0, 10px, 0)';
            });

            const activePage = document.getElementById(`page-${page}`);
            if (activePage) {
                activePage.style.display = 'block';
                activePage.style.opacity = '1';
                activePage.style.transform = 'translate3d(0,0,0)';
            }

            // Quick non-destructive UI update
            if(document.getElementById('headerBalance') && typeof currentUser !== 'undefined' && currentUser) {
                if(document.getElementById('headerBalance').innerText !== String(currentUser.points)) {
                    document.getElementById('headerBalance').innerText = currentUser.points;
                }
            }

            if (!renderedPages[page] && activePage) {
                renderedPages[page] = true;
                if(page === 'home') renderHome(activePage);
                if(page === 'settings') renderSettings(activePage);
                if(page === 'ads') renderAds(activePage);
                if(page === 'leaderboard') renderLeaderboard(activePage);
                if(page === 'withdraw') renderWithdraw(activePage);
                if(page === 'tasks') renderTasks(activePage);
                if(page === 'referrals') renderReferrals(activePage);
                if(page === 'games') renderGames(activePage);
            } else if (activePage) {
                // Update specific elements if cached
                if(page === 'home') {
                    const odom = document.getElementById("home-odometer");
                    if(odom && typeof currentUser !== 'undefined' && currentUser) odom.innerText = currentUser.points;
                }
                if(page === 'withdraw') {
                    const bal = document.getElementById("withdraw-balance");
                    if(bal && typeof currentUser !== 'undefined' && currentUser) bal.innerText = currentUser.points;
                }
            }
        }
        
        function claimEnkutatash() {
            if(localStorage.getItem('enkutatash_claimed')) {
                showToast('You already claimed your Enkutatash gift!', 'error');
                return;
            }
            if(typeof triggerConfetti === 'function') triggerConfetti();
            localStorage.setItem('enkutatash_claimed', 'true');
            currentUser.points += 1000;
            currentUser.realBalance = (currentUser.realBalance || 0) + 0.50;
            updateUI();
            showToast('Happy New Year! +1000 Gems & +$0.50 added!', 'success');
        };

        function renderHome(c) {
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
            const avatarUrl = tgUser?.photo_url || currentUser.avatarUrl || `${window.location.origin}/api/avatar/${encodeURIComponent(userId)}`;
    
    // Calculate accurate streak based on lastLoginTimestamp
    let streakCount = Math.max(Number(currentUser.streakCount || 0), Number(currentUser.streak || 0), 1);
    const lastLogin = currentUser.lastLoginTimestamp;
    const now = Date.now();
    if (lastLogin) {
        const hoursSince = (now - lastLogin) / (1000 * 60 * 60);
        if (hoursSince > 48) streakCount = 1; // reset
    }

    c.innerHTML = `
        <div class="card cyber-card" style="text-align:center; padding: 30px 20px; position:relative; overflow:hidden; margin-bottom: 20px;">
            <div style="position:absolute; top:-50px; left:-50px; width:150px; height:150px; background:var(--color-magenta); filter:blur(60px); opacity:0.3; border-radius:50%;"></div>
            <div style="position:absolute; bottom:-50px; right:-50px; width:150px; height:150px; background:var(--color-cyan); filter:blur(60px); opacity:0.3; border-radius:50%;"></div>
            
            <div class="avatar-ring" style="width:100px; height:100px; margin: 0 auto 15px;">
                <div class="avatar-inner" style="background-image:url('${avatarUrl}'); border-width: 4px;"></div>
            </div>
            <h2 style="font-size:1.6rem; margin-bottom:5px;">${currentUser.username}</h2>
            <div style="font-size: 2.5rem; color:var(--color-cyan); font-weight:800; text-shadow: 0 0 20px rgba(0, 242, 254, 0.5); margin: 10px 0;">
                <i class="fa-solid fa-gem"></i> <span id="home-odometer" class="odometer">${currentUser.points}</span>
            </div>
            
            <!-- Daily Streak -->
            <div class="timeline" style="margin-top:20px; padding-top:20px; border-top:1px solid rgba(255,255,255,0.1);">
                <div style="font-size: 0.9rem; color: #94A3B8; margin-bottom: 10px;">Login Streak: ${streakCount} Days</div>
                <div style="display:flex; justify-content:space-between;">
                    ${[1,2,3,4,5,6,7].map(d => `
                        <div style="width:30px; height:30px; border-radius:50%; background:${d <= streakCount ? 'var(--color-cyan)' : 'rgba(255,255,255,0.1)'}; color:${d <= streakCount ? 'black' : 'white'}; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:bold; box-shadow:${d <= streakCount ? '0 0 10px var(--color-cyan)' : 'none'};">${d}</div>
                    `).join('')}
                </div>
            </div>
        </div>

        <div style="display:flex; gap:10px; margin-bottom: 10px;">
            <button class="btn quantum-btn" style="flex:1; padding:15px; font-size:1.1rem; border-radius:15px;" onclick="showToast('Story Posted!', 'success')"><i class="fa-solid fa-camera"></i> Post Story</button>
            <button class="btn btn-secondary" style="flex:1; padding:15px; font-size:1.1rem; border-radius:15px;" onclick="window.location.href = '/setting.html?userId=' + userId"><i class="fa-solid fa-bullseye"></i> ADS</button>
        </div>
        <button class="btn" style="width:100%; padding:15px; font-size:1.1rem; border-radius:15px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.5); color: white; margin-bottom: 20px;" onclick="document.getElementById('profileModal').style.display='flex'"><i class="fa-solid fa-user-shield"></i> Profile & Security</button>
    `;
}

function renderWithdraw(c) {
            const realBal = currentUser.realBalance || 0;
            const curInvites = currentUser.referredUsers ? currentUser.referredUsers.length : 0;
            const curAds = currentUser.totalAdsWatchedLifetime || 0;
            const curTasks = currentUser.claimedBonuses ? currentUser.claimedBonuses.length : 0;
            
            const wCount = currentUser.withdrawCount || 0;
            const multiplier = wCount + 1; 
            
            const reqInvites = (appConfig.reqReferrals || 5) * multiplier;
            const reqAds = (appConfig.reqAds || 50) * multiplier;
            const reqTasks = (appConfig.reqTasks || 3) * multiplier;
            
            const req1Done = curInvites >= reqInvites;
            const req2Done = curAds >= reqAds;
            const req3Done = curTasks >= reqTasks;
            const allReqsMet = req1Done && req2Done && req3Done;
            
            const currName = appConfig.currencyName || 'Cash';

            const avatarUrl = currentUser.avatarUrl || 'https://ui-avatars.com/api/?name=User&background=B026FF&color=fff';
            const safeName = currentUser.accountName || currentUser.username || 'User';
            c.innerHTML = `
                <div style="text-align:center; padding: 20px 0;">
                    <div style="width: 90px; height: 90px; border-radius: 50%; margin: 0 auto 15px; background: url('${avatarUrl}') center/cover; border: 3px solid var(--brand-blue); box-shadow: 0 0 25px rgba(0, 168, 255, 0.6); position: relative;">
                        <div style="position: absolute; inset: 0; border-radius: 50%; box-shadow: inset 0 0 15px rgba(0, 168, 255, 0.8);"></div>
                    </div>
                    <h2 style="font-family:'Orbitron', sans-serif; font-size:1.5rem; text-shadow: 0 0 10px rgba(0, 168, 255, 0.5); margin-bottom:5px;">${safeName}</h2>
                    <p style="font-size:0.85rem; color:#94A3B8;">Secure Withdrawal Gateway</p>
                </div>
                
                <!-- Balances & Exchange Section -->
                <div class="card cyber-card" style="margin-bottom:20px; padding:25px 20px; position:relative; overflow:hidden;">
                    <div style="position:absolute; top:-30px; left:-30px; width:100px; height:100px; background:var(--color-cyan); filter:blur(40px); opacity:0.2;"></div>
                    
                    <div style="display:grid; grid-template-columns:1fr 1px 1fr; gap:15px; text-align:center; margin-bottom:25px;">
                        <div>
                            <div style="font-size:0.75rem; color:#94A3B8; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">Gems</div>
                            <div style="color:var(--color-cyan); font-weight:900; font-size:1.5rem;"><i class="fa-solid fa-gem"></i> <span id="exchangeGemsBal">${currentUser.points}</span></div>
                        </div>
                        <div style="background:rgba(255,255,255,0.1);"></div>
                        <div>
                            <div style="font-size:0.75rem; color:#94A3B8; font-weight:700; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">${currName}</div>
                            <div style="color:var(--success-color); font-weight:900; font-size:1.5rem;"><i class="fa-solid fa-money-bill-wave"></i> <span id="exchangeRealBal">${realBal.toFixed(2)}</span></div>
                        </div>
                    </div>

                    <h3 style="margin-bottom:10px; font-size:1.1rem;"><i class="fa-solid fa-right-left" style="color:var(--color-magenta);"></i> Quick Exchange</h3>
                    
                    <div style="display:flex; justify-content:space-between; gap:10px; margin-bottom:15px; background:rgba(0,0,0,0.3); padding:5px; border-radius:10px;">
                        <button id="btnGemsToCash" class="btn quantum-btn" style="flex:1; padding:8px; font-size:0.85rem;" onclick="setExchangeMode('gemsToCash')">Gems <i class="fa-solid fa-arrow-right"></i> Cash</button>
                        <button id="btnCashToGems" class="btn" style="flex:1; padding:8px; font-size:0.85rem; background:transparent; border:1px solid rgba(255,255,255,0.1); color:white;" onclick="setExchangeMode('cashToGems')">Cash <i class="fa-solid fa-arrow-right"></i> Gems</button>
                    </div>

                    <div style="font-size:0.75rem; color:#94A3B8; margin-bottom:15px; font-weight:600;">Live Rate: <span id="exchangeRateLabel">100 Gems = 1.00 ${currName}</span></div>
                    
                    <div style="position:relative; margin-bottom:15px;">
                        <input type="number" id="exchangeAmount" class="input-field" style="padding-left:40px; margin-bottom:0;" placeholder="Gems to Exchange" min="1" oninput="updateExchangePreview()">
                        <i id="exchangeIcon" class="fa-solid fa-gem" style="position:absolute; left:15px; top:50%; transform:translateY(-50%); color:var(--color-cyan);"></i>
                    </div>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-size:0.85rem; color:white; font-weight:700;">You receive: <span style="color:var(--success-color);"><span id="exchangePreview">0.00</span> <span id="exchangeReceiveLabel">${currName}</span></span></div>
                        <button class="btn quantum-btn" style="width:auto; padding:8px 20px;" onclick="processExchange()"><i class="fa-solid fa-coins"></i> Convert</button>
                    </div>
                </div>

                <!-- Withdrawal Requirements Checklist -->
                <div class="card cyber-card" style="margin-bottom:20px; border-left:4px solid ${allReqsMet ? 'var(--success-color)' : 'var(--danger-color)'};">
                    <h3 style="margin-bottom:15px; font-size:1.1rem;"><i class="fa-solid fa-list-check" style="color:var(--color-cyan);"></i> Unlock Withdrawal</h3>
                    
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05);">
                            <span style="color:${req1Done ? 'var(--success-color)' : '#94A3B8'}; font-weight:600;"><i class="fa-solid ${req1Done ? 'fa-circle-check' : 'fa-circle'}"></i> 1. Refer Friends</span>
                            <span style="font-weight:800; color:${req1Done ? 'var(--success-color)' : 'white'}; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:5px;">${curInvites} / ${reqInvites}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.05);">
                            <span style="color:${req2Done ? 'var(--success-color)' : '#94A3B8'}; font-weight:600;"><i class="fa-solid ${req2Done ? 'fa-circle-check' : 'fa-circle'}"></i> 2. Watch Ads</span>
                            <span style="font-weight:800; color:${req2Done ? 'var(--success-color)' : 'white'}; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:5px;">${curAds} / ${reqAds}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="color:${req3Done ? 'var(--success-color)' : '#94A3B8'}; font-weight:600;"><i class="fa-solid ${req3Done ? 'fa-circle-check' : 'fa-circle'}"></i> 3. Complete Tasks</span>
                            <span style="font-weight:800; color:${req3Done ? 'var(--success-color)' : 'white'}; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:5px;">${curTasks} / ${reqTasks}</span>
                        </div>
                    </div>
                </div>

                <!-- Withdrawal Form -->
                <div class="card cyber-card" style="position:relative; overflow:hidden;">
                    ${!allReqsMet ? `
                        <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.8); backdrop-filter:blur(8px); z-index:10; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
                            <i class="fa-solid fa-lock" style="font-size:3rem; color:rgba(255,255,255,0.3); margin-bottom:15px;"></i>
                            <div style="font-weight:800; color:white;">Complete Requirements to Unlock Form</div>
                        </div>
                    ` : ''}
                    
                    <h3 style="margin-bottom:15px; font-size:1.1rem;"><i class="fa-solid fa-paper-plane" style="color:var(--color-purple);"></i> Request Payout</h3>
                    
                    <div style="margin-bottom:15px;">
                        <label style="font-size:0.75rem; color:#94A3B8; font-weight:700; margin-bottom:5px; display:block;">Withdrawal Method</label>
                        <select id="wdBank" class="input-field" style="color:white; background:rgba(0,0,0,0.5);" disabled>
                            <option value="Telebirr" style="color:black;" selected>Telebirr</option>
                        </select>
                    </div>

                    <div style="margin-bottom:15px;">
                        <label style="font-size:0.75rem; color:#94A3B8; font-weight:700; margin-bottom:5px; display:block;">Account Number</label>
                        <input type="text" id="wdAccount" class="input-field" placeholder="e.g. 1000123456789">
                    </div>

                    <div style="margin-bottom:15px;">
                        <label style="font-size:0.75rem; color:#94A3B8; font-weight:700; margin-bottom:5px; display:block;">Account Holder Name</label>
                        <input type="text" id="wdName" class="input-field" placeholder="e.g. Abebe Kebede">
                    </div>

                    <div style="margin-bottom:20px;">
                        <label style="font-size:0.75rem; color:#94A3B8; font-weight:700; margin-bottom:5px; display:block;">Amount (${currName})</label>
                        <input type="number" id="wdAmount" class="input-field" placeholder="0.00" max="${realBal}">
                    </div>

                    <button class="btn quantum-btn" style="width:100%;" onclick="submitWithdraw()" ${!allReqsMet ? 'disabled' : ''}><i class="fa-solid fa-circle-check"></i> Submit Request</button>
                </div>
            `;
        }

        async function submitWithdraw() {
            const method = document.getElementById('wdBank').value;
            const account = document.getElementById('wdAccount').value;
            const accountName = document.getElementById('wdName').value;
            const amount = parseFloat(document.getElementById('wdAmount').value);

            if(!account || !accountName || !amount) return showToast('Please fill all fields', 'error');
            if(amount > (currentUser.realBalance||0)) return showToast('Insufficient funds', 'error');
            if(amount <= 0) return showToast('Invalid amount', 'error');

            const btn = document.querySelector('button[onclick="submitWithdraw()"]');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
            btn.disabled = true;

            try {
                const res = await fetch(`${API_BASE_URL}/api/request-withdrawal`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ userId, amount, method, account, accountName })
                });
                const data = await res.json();
                if(data.success) {
                    showToast('Withdrawal submitted successfully!', 'success');
                    const uRes = await fetch(`${API_BASE_URL}/api/user/${userId}`);
                    currentUser = await uRes.json();
                    nav('withdraw');
                } else {
                    showToast('Withdrawal failed', 'error');
                    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Request';
                    btn.disabled = false;
                }
            } catch(e) {
                showToast('Network error', 'error');
                btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Request';
                btn.disabled = false;
            }
        }

        window.currentExchangeMode = 'gemsToCash';
        
        function setExchangeMode(mode) {
            window.currentExchangeMode = mode;
            const btnG2C = document.getElementById('btnGemsToCash');
            const btnC2G = document.getElementById('btnCashToGems');
            const input = document.getElementById('exchangeAmount');
            const icon = document.getElementById('exchangeIcon');
            const rateLabel = document.getElementById('exchangeRateLabel');
            const recLabel = document.getElementById('exchangeReceiveLabel');
            
            const currName = (typeof appConfig !== 'undefined' && appConfig.currencyName) ? appConfig.currencyName : 'Cash';
            const rate = (typeof appConfig !== 'undefined' && appConfig.exchangeRate) ? appConfig.exchangeRate : 100;
            
            if(mode === 'gemsToCash') {
                btnG2C.className = 'btn quantum-btn';
                btnG2C.style.background = '';
                btnG2C.style.border = 'none';
                
                btnC2G.className = 'btn';
                btnC2G.style.background = 'transparent';
                btnC2G.style.border = '1px solid rgba(255,255,255,0.1)';
                
                input.placeholder = "Gems to Exchange";
                icon.className = "fa-solid fa-gem";
                icon.style.color = "var(--color-cyan)";
                rateLabel.innerText = `${rate} Gems = 1.00 ${currName}`;
                recLabel.innerText = currName;
            } else {
                btnC2G.className = 'btn quantum-btn';
                btnC2G.style.background = '';
                btnC2G.style.border = 'none';
                
                btnG2C.className = 'btn';
                btnG2C.style.background = 'transparent';
                btnG2C.style.border = '1px solid rgba(255,255,255,0.1)';
                
                input.placeholder = `${currName} to Exchange`;
                icon.className = "fa-solid fa-money-bill-wave";
                icon.style.color = "var(--success-color)";
                rateLabel.innerText = `1.00 ${currName} = ${rate} Gems`;
                recLabel.innerText = "Gems";
            }
            input.value = '';
            document.getElementById('exchangePreview').innerText = '0.00';
        };

        function updateExchangePreview() {
            const input = document.getElementById('exchangeAmount');
            const val = parseFloat(input.value) || 0;
            const rate = (typeof appConfig !== 'undefined' && appConfig.exchangeRate) ? appConfig.exchangeRate : 100;
            const taxCashGems = (typeof appConfig !== 'undefined' && appConfig.cashToGemsTaxRate) ? appConfig.cashToGemsTaxRate : 0;
            const taxGemsCash = (typeof appConfig !== 'undefined' && appConfig.taxRate) ? appConfig.taxRate : 0;
            
            if(window.currentExchangeMode === 'gemsToCash') {
                let rec = val / rate;
                if(taxGemsCash > 0) rec = (val - (val * (taxGemsCash / 100))) / rate;
                document.getElementById('exchangePreview').innerText = rec.toFixed(2);
            } else {
                let rec = val * rate;
                if(taxCashGems > 0) rec = (val - (val * (taxCashGems / 100))) * rate;
                document.getElementById('exchangePreview').innerText = Math.floor(rec);
            }
        };

        async function processExchange() {
            const amt = parseFloat(document.getElementById('exchangeAmount').value);
            if (!amt || amt <= 0) return showToast('Enter a valid amount', 'error');
            
            if (window.currentExchangeMode === 'gemsToCash' && amt > currentUser.points) return showToast('Not enough gems!', 'error');
            if (window.currentExchangeMode === 'cashToGems' && amt > (currentUser.realBalance || 0)) return showToast('Not enough cash!', 'error');

            const btn = document.querySelector('button[onclick="processExchange()"]');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            btn.disabled = true;

            try {
                const res = await fetch(`${API_BASE_URL}/api/exchange`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ userId, amount: amt, mode: window.currentExchangeMode })
                });
                const data = await res.json();
                
                if (data.success) {
                    showToast('Success! Exchange complete.', 'success');
                    const uRes = await fetch(`${API_BASE_URL}/api/user/${userId}`);
                    currentUser = await uRes.json();
                    nav('withdraw');
                } else {
                    showToast(data.error || 'Exchange failed', 'error');
                    btn.innerHTML = '<i class="fa-solid fa-coins"></i> Convert';
                    btn.disabled = false;
                }
            } catch (e) {
                showToast('Network error', 'error');
                btn.innerHTML = '<i class="fa-solid fa-coins"></i> Convert';
                btn.disabled = false;
            }
        }

        
        function renderAds(c) {
            c.innerHTML = `
                <div style="padding-bottom: 20px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                        <h2 style="font-size: 1.8rem; margin:0; text-shadow: 0 0 10px var(--brand-blue);"><i class="fa-solid fa-bullseye"></i> Ad Studio PRO</h2>
                        <button class="btn btn-secondary" onclick="nav('settings')" style="width:auto; padding:5px 15px;"><i class="fa-solid fa-arrow-left"></i> Back</button>
                    </div>

                    <!-- Tabs -->
                    <div style="display:flex; gap:10px; margin-bottom: 20px; background:rgba(0,0,0,0.2); padding:5px; border-radius:15px; border:1px solid rgba(255,255,255,0.05);">
                        <button class="btn quantum-btn" id="tab-campaign" style="flex:1; border-radius:10px; padding:10px;" onclick="switchAdTab('campaign')">Campaigns (15)</button>
                        <button class="btn" id="tab-network" style="flex:1; border-radius:10px; padding:10px; background:transparent; color:#94A3B8;" onclick="switchAdTab('network')">Ad Network (20)</button>
                    </div>

                    <div id="view-campaign">
                        <div class="card cyber-card" style="margin-bottom: 20px; padding: 20px;">
                            <h3 style="color:var(--color-cyan); margin-bottom:15px;"><i class="fa-solid fa-plus"></i> 1. Create New Campaign</h3>
                            <input type="text" placeholder="Campaign Name" style="width:100%; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px; color:white; margin-bottom:10px; outline:none;">
                            <div style="display:flex; gap:10px; margin-bottom:10px;">
                                <input type="number" placeholder="Budget (USD)" style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px; color:white; outline:none;">
                                <select style="flex:1; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:10px; padding:10px; color:white; outline:none;">
                                    <option>2. CPM Bidding</option>
                                    <option>CPC Bidding</option>
                                </select>
                            </div>
                            <button class="btn quantum-btn" onclick="showToast('Campaign draft saved!', 'success')">Save Draft</button>
                        </div>

                        <div class="card cyber-card" style="margin-bottom: 20px; padding: 20px;">
                            <h3 style="color:white; margin-bottom:15px;"><i class="fa-solid fa-sliders"></i> Target & Optimize</h3>
                            <div class="setting-row"><div><b>3. Geo-Targeting</b><div class="sub-text">Filter by Country/City</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Configure</button></div>
                            <div class="setting-row"><div><b>4. Device Targeting</b><div class="sub-text">iOS, Android, Web</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Configure</button></div>
                            <div class="setting-row"><div><b>5. Schedule / Flight Dates</b><div class="sub-text">Set start and end dates</div></div><input type="date" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px;"></div>
                            <div class="setting-row"><div><b>6. A/B Testing Engine</b><div class="sub-text">Split traffic across creatives</div></div><label class="switch"><input type="checkbox" checked><span class="slider round"></span></label></div>
                            <div class="setting-row"><div><b>7. Conversion Tracking</b><div class="sub-text">Install server-side pixel</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">View Pixel</button></div>
                            <div class="setting-row"><div><b>8. Real-time Spend Analytics</b><div class="sub-text">Chart visualization</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Open Chart</button></div>
                            <div class="setting-row"><div><b>9. Quick Actions</b><div class="sub-text">Pause/Resume/Duplicate</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Manage</button></div>
                            <div class="setting-row"><div><b>10. AI Health Score</b><div class="sub-text">Automated optimization (98%)</div></div><label class="switch"><input type="checkbox" checked><span class="slider round"></span></label></div>
                            <div class="setting-row"><div><b>11. Keyword Bidding</b><div class="sub-text">Search intent matching</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Edit List</button></div>
                            <div class="setting-row"><div><b>12. Placement Exclusion</b><div class="sub-text">Block specific domains</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Blacklist</button></div>
                            <div class="setting-row"><div><b>13. Access Auditing</b><div class="sub-text">View team activity logs</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">View Logs</button></div>
                            <div class="setting-row"><div><b>14. Fraud Protection</b><div class="sub-text">Block suspicious clicks</div></div><label class="switch"><input type="checkbox" checked><span class="slider round"></span></label></div>
                            <div class="setting-row" style="border:none; margin:0; padding:0;"><div><b>15. Auto-Scaling Budget</b><div class="sub-text">Increase if ROI > 200%</div></div><label class="switch"><input type="checkbox"><span class="slider round"></span></label></div>
                        </div>
                    </div>

                    <div id="view-network" style="display:none;">
                        <div class="card cyber-card" style="margin-bottom: 20px; padding: 20px; text-align:center;">
                            <h3 style="color:var(--color-magenta); margin-bottom:5px;"><i class="fa-solid fa-chart-pie"></i> 1. Monetization Dashboard</h3>
                            <div style="font-size:2rem; font-weight:bold; color:white; margin:10px 0;">$4,250.00</div>
                            <div style="color:#94A3B8; font-size:0.9rem;">Estimated Revenue (30 Days)</div>
                        </div>

                        <div class="card cyber-card" style="margin-bottom: 20px; padding: 20px;">
                            <h3 style="color:white; margin-bottom:15px;"><i class="fa-solid fa-network-wired"></i> Publisher Features</h3>
                            <div class="setting-row"><div><b>2. Setup Ad Zone</b><div class="sub-text">Banner, Interstitial, Video</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Create</button></div>
                            <div class="setting-row"><div><b>3. eCPM/CPC Rate Chart</b><div class="sub-text">Live performance metrics</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">View</button></div>
                            <div class="setting-row"><div><b>4. eCPM Floor Config</b><div class="sub-text">Minimum accepted bid</div></div><input type="number" value="1.50" style="width:60px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px;"></div>
                            <div class="setting-row"><div><b>5. Ad Fill Rate Tracker</b><div class="sub-text">Current fill: 94.2%</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Analyze</button></div>
                            <div class="setting-row"><div><b>6. Impression Heatmap</b><div class="sub-text">Visual click tracking</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Open</button></div>
                            <div class="setting-row"><div><b>7. Revenue Forecasting (AI)</b><div class="sub-text">Predictive ML models</div></div><label class="switch"><input type="checkbox" checked><span class="slider round"></span></label></div>
                            <div class="setting-row"><div><b>8. Payout Settings</b><div class="sub-text">Crypto / Fiat Config</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Billing</button></div>
                            <div class="setting-row"><div><b>9. Traffic Source Verification</b><div class="sub-text">Anti-bot domain checking</div></div><label class="switch"><input type="checkbox" checked><span class="slider round"></span></label></div>
                            <div class="setting-row"><div><b>10. Quality Score Monitor</b><div class="sub-text">Account standing: EXCELLENT</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">View</button></div>
                            <div class="setting-row"><div><b>11. Header Bidding</b><div class="sub-text">Real-time external bidders</div></div><label class="switch"><input type="checkbox" checked><span class="slider round"></span></label></div>
                            <div class="setting-row"><div><b>12. Ad Format Customizer</b><div class="sub-text">CSS styling for native ads</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Edit CSS</button></div>
                            <div class="setting-row"><div><b>13. API / Developer SDK</b><div class="sub-text">Generate API Keys</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Keys</button></div>
                            <div class="setting-row"><div><b>14. Viewability Measurement</b><div class="sub-text">IAB Standard Tracking</div></div><label class="switch"><input type="checkbox" checked><span class="slider round"></span></label></div>
                            <div class="setting-row"><div><b>15. Bot Traffic Nullification</b><div class="sub-text">Auto-drop proxy traffic</div></div><label class="switch"><input type="checkbox" checked><span class="slider round"></span></label></div>
                            <div class="setting-row"><div><b>16. Ad Frequency Capping</b><div class="sub-text">Max 3 ads per hour per user</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Config</button></div>
                            <div class="setting-row"><div><b>17. Safe Ads (Blocking)</b><div class="sub-text">Block NSFW/Gambling</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Categories</button></div>
                            <div class="setting-row"><div><b>18. Real-time Webhooks</b><div class="sub-text">Postbacks on impressions</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Endpoints</button></div>
                            <div class="setting-row"><div><b>19. Account Manager Chat</b><div class="sub-text">Priority 24/7 Support</div></div><button class="btn quantum-btn" style="width:auto; padding:5px 15px;">Chat Now</button></div>
                            <div class="setting-row" style="border:none; margin:0; padding:0;"><div><b>20. Tax/Invoice Generator</b><div class="sub-text">Download monthly PDFs</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">Invoices</button></div>
                        </div>
                    </div>

                </div>
                <style>
                    .setting-row { display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; }
                    .setting-row b { font-size: 1.05rem; }
                    .setting-row .sub-text { font-size: 0.8rem; color: #94A3B8; margin-top:2px; }
                </style>
            `;
        }

        function switchAdTab(tab) {
            const btnCamp = document.getElementById('tab-campaign');
            const btnNet = document.getElementById('tab-network');
            const viewCamp = document.getElementById('view-campaign');
            const viewNet = document.getElementById('view-network');

            if(tab === 'campaign') {
                btnCamp.classList.add('quantum-btn');
                btnCamp.style.background = '';
                btnCamp.style.color = 'white';
                
                btnNet.classList.remove('quantum-btn');
                btnNet.style.background = 'transparent';
                btnNet.style.color = '#94A3B8';

                viewCamp.style.display = 'block';
                viewNet.style.display = 'none';
            } else {
                btnNet.classList.add('quantum-btn');
                btnNet.style.background = '';
                btnNet.style.color = 'white';
                
                btnCamp.classList.remove('quantum-btn');
                btnCamp.style.background = 'transparent';
                btnCamp.style.color = '#94A3B8';

                viewCamp.style.display = 'none';
                viewNet.style.display = 'block';
            }
        };

        async function renderSettings(c) {
            c.innerHTML = `
                <div style="padding-bottom: 20px;">
                    <h2 style="font-size: 2rem; margin-bottom: 20px; text-shadow: 0 0 10px var(--brand-blue);">Settings Hub</h2>

                    <div class="card cyber-card" style="margin-bottom: 20px; padding: 20px; text-align:center; background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(0, 242, 254, 0.2)); border: 1px solid rgba(139, 92, 246, 0.5); cursor: pointer;" onclick="nav('ads')">
                        <i class="fa-solid fa-bullseye" style="font-size: 2.5rem; color: var(--color-cyan); margin-bottom: 10px;"></i>
                        <h3 style="color: white; font-size: 1.4rem;">Ad Studio PRO</h3>
                        <p style="color: #94A3B8; font-size: 0.9rem;">Manage Campaigns & Ad Network</p>
                    </div>

                    <div class="card cyber-card" style="margin-bottom: 20px; padding: 20px;">
                        <h3 style="color: var(--brand-blue); margin-bottom: 15px;"><i class="fa-solid fa-shield-halved"></i> Advanced Security</h3>
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.1rem;">Guard Mode</div>
                                <div style="font-size: 0.8rem; color: #94A3B8;">Gate group joins and auto-approve requests.</div>
                            </div>
                            <label class="switch"><input type="checkbox" id="set-guard" onchange="toggleSetting('guard')"><span class="slider round"></span></label>
                        </div>
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.1rem;">Secretary Mode</div>
                                <div style="font-size: 0.8rem; color: #94A3B8;">Auto-reply to chat messages on your behalf.</div>
                            </div>
                            <label class="switch"><input type="checkbox" id="set-sec" onchange="toggleSetting('sec')"><span class="slider round"></span></label>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.1rem;">Privacy Mode</div>
                                <div style="font-size: 0.8rem; color: #94A3B8;">Hide balances on main screens.</div>
                            </div>
                            <label class="switch"><input type="checkbox" id="set-priv" onchange="toggleSetting('priv')"><span class="slider round"></span></label>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.1rem;">Passcode Lock</div>
                                <div style="font-size: 0.8rem; color: #94A3B8;">Require PIN to open the app.</div>
                            </div>
                            <label class="switch"><input type="checkbox" id="set-pin" onchange="toggleSetting('pin')"><span class="slider round"></span></label>
                        </div>
                    </div>

                    <div class="card cyber-card" style="margin-bottom: 20px; padding: 20px;">
                        <h3 style="color: var(--brand-green); margin-bottom: 15px;"><i class="fa-solid fa-bolt"></i> Automation & Alerts</h3>
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.1rem;">Auto-Claim Bonus</div>
                                <div style="font-size: 0.8rem; color: #94A3B8;">Automatically claim daily bonuses.</div>
                            </div>
                            <label class="switch"><input type="checkbox" id="set-auto" onchange="toggleSetting('auto')"><span class="slider round"></span></label>
                        </div>
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.1rem;">Push Notifications</div>
                                <div style="font-size: 0.8rem; color: #94A3B8;">Receive alerts for tasks and drops.</div>
                            </div>
                            <label class="switch"><input type="checkbox" id="set-push" onchange="toggleSetting('push')"><span class="slider round"></span></label>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.1rem;">Daily Reminders</div>
                                <div style="font-size: 0.8rem; color: #94A3B8;">Never miss a login streak.</div>
                            </div>
                            <label class="switch"><input type="checkbox" id="set-remind" onchange="toggleSetting('remind')"><span class="slider round"></span></label>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.1rem;">Data Saver Mode</div>
                                <div style="font-size: 0.8rem; color: #94A3B8;">Reduce animations to save bandwidth.</div>
                            </div>
                            <label class="switch"><input type="checkbox" id="set-data" onchange="toggleSetting('data')"><span class="slider round"></span></label>
                        </div>
                    </div>

                    <div class="card cyber-card" style="margin-bottom: 20px; padding: 20px;">
                        <h3 style="color: var(--brand-orange); margin-bottom: 15px;"><i class="fa-solid fa-palette"></i> Experience & UI</h3>
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.1rem;">Sound Effects</div>
                                <div style="font-size: 0.8rem; color: #94A3B8;">In-game sounds and UI clicks.</div>
                            </div>
                            <label class="switch"><input type="checkbox" id="set-sfx" onchange="toggleSetting('sfx')"><span class="slider round"></span></label>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.1rem;">Background Music</div>
                                <div style="font-size: 0.8rem; color: #94A3B8;">Play ambient cyber tracks.</div>
                            </div>
                            <label class="switch"><input type="checkbox" id="set-bgm" onchange="toggleSetting('bgm')"><span class="slider round"></span></label>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                            <div>
                                <div style="font-weight: bold; font-size: 1.1rem;">Haptic Feedback</div>
                                <div style="font-size: 0.8rem; color: #94A3B8;">Vibrate on interactions (mobile only).</div>
                            </div>
                            <label class="switch"><input type="checkbox" id="set-hap" onchange="toggleSetting('hap')"><span class="slider round"></span></label>
                        </div>

                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                            <div style="flex:1;">
                                <div style="font-weight: bold; font-size: 1.1rem;">App Theme</div>
                                <select id="set-theme" onchange="toggleSetting('theme', this.value)" style="width:100%; margin-top:5px; background:rgba(0,0,0,0.5); color:white; border:1px solid rgba(255,255,255,0.2); padding:10px; border-radius:8px;">
                                    <option value="quantum">Quantum Cyber (Default)</option>
                                    <option value="dark">Pure Dark Mode</option>
                                    <option value="light">Light Mode</option>
                                    <option value="neon">Neon Tokyo</option>
                                </select>
                            </div>
                        </div>
                        
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                            <div style="flex:1;">
                                <div style="font-weight: bold; font-size: 1.1rem;">Language</div>
                                <select id="set-lang" onchange="toggleSetting('lang', this.value)" style="width:100%; margin-top:5px; background:rgba(0,0,0,0.5); color:white; border:1px solid rgba(255,255,255,0.2); padding:10px; border-radius:8px;">
                                    <option value="en">English (US)</option>
                                    <option value="am">Amharic (Ethiopia)</option>
                                    <option value="ru">Russian</option>
                                    <option value="es">Spanish</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="card cyber-card" style="margin-bottom: 20px; padding: 20px;">
                        <h3 style="color: #FF4444; margin-bottom: 15px;"><i class="fa-solid fa-triangle-exclamation"></i> Danger Zone</h3>
                        
                        <button class="btn" style="width:100%; background:rgba(255,255,255,0.1); color:white; margin-bottom:10px; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Active sessions cleared!', 'success')"><i class="fa-solid fa-laptop-code"></i> Logout other devices</button>
                        <button class="btn" style="width:100%; background:rgba(255,255,255,0.1); color:white; margin-bottom:10px; border:1px solid rgba(255,255,255,0.2);" onclick="showToast('Cache cleared. Performance boosted!', 'success')"><i class="fa-solid fa-broom"></i> Clear App Cache</button>
                        <button class="btn" style="width:100%; background:rgba(255,68,68,0.2); color:#FF4444; border:1px solid rgba(255,68,68,0.5);" onclick="showToast('Cannot delete while balance > 0', 'error')"><i class="fa-solid fa-trash-can"></i> Delete Account</button>
                    </div>

                </div>
                
                <style>
                    .switch { position: relative; display: inline-block; width: 50px; height: 26px; }
                    .switch input { opacity: 0; width: 0; height: 0; }
                    .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255,255,255,0.1); transition: .4s; }
                    .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 4px; bottom: 4px; background-color: white; transition: .4s; }
                    input:checked + .slider { background-color: var(--brand-blue); box-shadow: 0 0 10px var(--brand-blue); }
                    input:checked + .slider:before { transform: translateX(24px); }
                    .slider.round { border-radius: 34px; }
                    .slider.round:before { border-radius: 50%; }
                </style>
            `;
            
            // Hydrate values
            ['guard', 'sec', 'priv', 'pin', 'auto', 'push', 'remind', 'data', 'sfx', 'bgm', 'hap'].forEach(key => {
                const el = document.getElementById('set-' + key);
                if(el) el.checked = localStorage.getItem('set_' + key) === 'true';
            });
            const theme = localStorage.getItem('set_theme'); if(theme) document.getElementById('set-theme').value = theme;
            const lang = localStorage.getItem('set_lang'); if(lang) document.getElementById('set-lang').value = lang;
        }

        function toggleSetting(key, val) {
            if(val !== undefined) {
                localStorage.setItem('set_' + key, val);
                showToast(key.toUpperCase() + ' updated successfully!', 'success');
            } else {
                const isChecked = document.getElementById('set-' + key).checked;
                localStorage.setItem('set_' + key, isChecked);
                showToast('Setting updated: ' + (isChecked ? 'ON' : 'OFF'), 'success');
                if(key === 'priv') updateUI(); // Re-render header to hide/show balances
                if(key === 'sfx') soundEnabled = isChecked;
            }
        };

        
        async function renderLeaderboard(c) {
            c.innerHTML = `
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
            `;
            
            try {
                const res = await fetch(`${API_BASE_URL}/api/leaderboard/${userId}`);
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
                        const fbUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(realName)}&background=B026FF&color=fff`;
                        const avatarUrl = u.avatarUrl || (u.id ? `${API_BASE_URL}/api/avatar/${u.id}` : fbUrl);
                        
                        const nameColor = u.usernameColor ? `color: ${u.usernameColor} !important;` : '';
                        const badge = u.titleBadge && u.titleBadge !== 'None' ? `<span style="font-size:0.6rem; background:rgba(255,255,255,0.2); padding:2px 5px; border-radius:4px; margin-right:3px;">${u.titleBadge}</span>` : '';
                        
                        podiumHtml += `
                            <div class="podium-tier rank-${rank}">
                                <div class="podium-crown"><i class="fa-solid fa-crown"></i></div>
                                <img loading="lazy" src="${avatarUrl}" class="podium-avatar" loading="lazy" onerror="this.onerror=null; this.src='${fbUrl}';">
                                <div class="podium-name" style="${nameColor}">${badge}${realName}</div>
                                <div class="podium-gems"><i class="fa-solid fa-gem"></i> ${Number(u.points || 0).toLocaleString()}</div>
                            </div>
                        `;
                    });
                    
                    podiumCont.innerHTML = podiumHtml;
                }

                // --- REST OF LIST (4-100) ---
                let listHtml = '';
                for (let i = 3; i < top100.length; i++) {
                    const u = top100[i];
                    const rank = i + 1;
                    const realName = u.accountName || u.username || 'Anonymous';
                    const fbUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(realName)}&background=B026FF&color=fff`;
                    const avatarUrl = u.avatarUrl || (u.id ? `${API_BASE_URL}/api/avatar/${u.id}` : fbUrl);
                    
                    const nameColor = u.usernameColor ? `color: ${u.usernameColor} !important;` : '';
                    const badge = u.titleBadge && u.titleBadge !== 'None' ? `<span style="font-size:0.6rem; background:rgba(255,255,255,0.2); padding:2px 5px; border-radius:4px; margin-right:3px;">${u.titleBadge}</span>` : '';
                    
                    listHtml += `
                        <div class="lb-list-item">
                            <div class="lb-badge">${rank}</div>
                            <img loading="lazy" src="${avatarUrl}" class="lb-avatar" loading="lazy" onerror="this.onerror=null; this.src='${fbUrl}';">
                            <div class="lb-name" style="${nameColor}">${badge}${realName}</div>
                            <div class="lb-gems">${Number(u.points || 0).toLocaleString()} <i class="fa-solid fa-gem"></i></div>
                        </div>
                    `;
                }
                listContainer.innerHTML = listHtml;
                listContainer.style.display = 'block';

                // --- STICKY FOOTER (99+) ---
                const footer = document.getElementById('leaderboardFooter');
                const userRank = data.userRankPoints;
                
                let myName = currentUser.accountName || currentUser.username || 'Anonymous';
                let myAvatar = currentUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(myName)}&background=B026FF&color=fff`;
                
                let displayRank = (userRank && userRank >= 1 && userRank <= 100) ? userRank : '99+';
                let rankColor = displayRank === '99+' ? 'var(--color-magenta)' : 'white';

                footer.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px; max-width: 45%;">
                        <img loading="lazy" src="${myAvatar}" style="width:40px; height:40px; border-radius:50%; border:2px solid var(--color-cyan);">
                        <div style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden; max-width: 100%;">
                            <div style="font-weight:800; font-size:1rem; color:white; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${myName}</div>
                        </div>
                    </div>
                    <div style="text-align:center;">
                        <div style="font-weight:bold; font-size:0.75rem; color:#94A3B8;">Rank</div>
                        <div style="font-weight:900; font-size:1.1rem; color:${rankColor};">${displayRank === '99+' ? displayRank : '#' + displayRank}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:bold; font-size:0.75rem; color:#94A3B8;">Gems</div>
                        <div style="font-weight:900; font-size:1.1rem; color:var(--color-cyan); display:flex; align-items:center; gap:5px; justify-content:flex-end;">
                            ${Number(currentUser.points).toLocaleString()} <i class="fa-solid fa-gem"></i>
                        </div>
                    </div>
                `;
                footer.style.display = 'flex';
                
            } catch (err) {
                console.error(err);
                if (document.getElementById('leaderboardLoading')) {
                    document.getElementById('leaderboardLoading').innerHTML = `
                        <div style="text-align:center; color:var(--danger-color); padding: 20px;">
                            <i class="fa-solid fa-triangle-exclamation" style="font-size:2rem; margin-bottom:10px;"></i>
                            <div>Failed to load leaderboard. Retrying...</div>
                        </div>
                    `;
                    setTimeout(() => renderLeaderboard(c), 3000);
                }
            }
        }

        function openGame(gameId) {
            if(gameId === 'ludo') {
                window.location.href = '/ludo.html?userId=' + (typeof userId !== 'undefined' ? userId : '');
                return;
            }
            if(gameId === 'chickenroad') {
                window.location.href = '/chicken.html?userId=' + (typeof userId !== 'undefined' ? userId : '');
                return;
            }
            const main = document.getElementById('mainContent');
            const wrapper = document.getElementById('gameCanvasWrapper');
            const canvasArea = document.getElementById('activeGameCanvas');
            const header = document.getElementById('pageHeader');
            if(!main || !wrapper || !canvasArea) return console.error("DOM missing");

            if (header) header.style.display = 'none';
            main.style.display = 'none';
            wrapper.style.display = 'block';
            canvasArea.innerHTML = ''; // Clear previous

            if(gameId === 'aviator') renderAviatorGame(canvasArea);
            else if(gameId === 'multiox') renderMultiOxGame(canvasArea);
            else if(gameId === 'dailycombo') renderDailyComboGame(canvasArea);
            else if(gameId === 'prospin') renderProSpinGame(canvasArea);
            else if(gameId === 'scratchcard') renderScratchCardGame(canvasArea);
        };

        function closeGame() { if(typeof window.clearAllGameLoops === "function") window.clearAllGameLoops();
            const main = document.getElementById('mainContent');
            const wrapper = document.getElementById('gameCanvasWrapper');
            const canvasArea = document.getElementById('activeGameCanvas');
            const header = document.getElementById('pageHeader');
            
            if(typeof aviatorActive !== 'undefined') window.aviatorActive = false;
            if(typeof avGameState !== 'undefined') window.avGameState = 'IDLE';
            if(typeof avReq !== 'undefined') cancelAnimationFrame(window.avReq);
            if(typeof chatInterval !== 'undefined') clearInterval(window.chatInterval);
            if(typeof avBetTimer !== 'undefined') clearInterval(window.avBetTimer);
            if(typeof stopEngineSound === 'function') stopEngineSound();
            
            if (wrapper) wrapper.style.display = 'none';
            if (canvasArea) canvasArea.innerHTML = '';
            if (main) main.style.display = 'block';
            if (header) header.style.display = 'flex';
            
            updateUI();
        };

        // ==========================================
        // AVIATOR 20 FEATURES OVERHAUL & STRICT 5-SECOND LOOP
        // ==========================================
        let aviatorRound = null;
        let avReq;
        let avGameState = 'IDLE'; // IDLE, BETTING, FLYING, CRASHED
        let avBetTimer = null;
        let avBetTimeLeft = 5;

        function renderAviatorGame(c) {
            c.innerHTML = `
                <div class="game-sticky-header" style="position:sticky; top:0; z-index:100; display:flex; justify-content:space-between; align-items:center; background:rgba(15,23,42,0.9); backdrop-filter:blur(10px); padding:10px 15px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <button class="btn btn-secondary" onclick="closeGame()" style="width:auto; padding:5px 15px; font-size:0.9rem;"><i class="fa-solid fa-arrow-left"></i> Back to Hub</button>
                    <div style="font-weight:bold; color:var(--accent-color);"><i class="fa-solid fa-gem"></i> <span id="avHeaderBal">${currentUser.points}</span></div>
                </div>
                <div class="card cyber-card" style="padding: 10px; position: relative;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <h2 style="color:var(--danger-color); margin:0;"><i class="fa-solid fa-plane-up"></i> Aviator</h2>
                            <button onclick="document.getElementById('pfModal').style.display='flex'" style="background:none; border:none; color:#94A3B8; cursor:pointer;"><i class="fa-solid fa-shield-halved"></i></button>
                        </div>

                    </div>

                    <!-- 1. Multiplier History Bar -->
                    <div class="aviator-history-bar" id="avHistory" style="display:flex; overflow-x:auto; gap:8px; padding-bottom:10px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom:15px; scrollbar-width:none;"></div>

                    <!-- 3. Altitude/Atmosphere Canvas Shifts & 4. Dynamic Zoom -->
                    <div class="aviator-wrapper" id="avWrapper" style="position:relative; width:100%; height:350px; background:linear-gradient(to bottom, #0F172A, #1E293B); overflow:hidden; border-radius:15px; margin-bottom:20px; border: 2px solid #EF4444; box-shadow: inset 0 0 50px rgba(0,0,0,0.5), 0 0 20px rgba(239,68,68,0.3);">
                        <!-- 17. Highest Win Banner -->
                        <div class="highest-win-banner" id="avBanner" style="position:absolute; top:10px; left:50%; transform:translateX(-50%); background:rgba(239, 68, 68, 0.2); border:1px solid rgba(239, 68, 68, 0.5); padding:5px 15px; border-radius:20px; font-size:0.75rem; color:white; z-index:10; white-space:nowrap; transition:0.3s;"><i class="fa-solid fa-fire" style="color:#ef4444;"></i> Mesechebo won 15,000 Gems at 15.2x!</div>
                        
                        <!-- 6. Live Chat Overlay -->
                        <div class="aviator-chat-overlay" id="avChat" style="position:absolute; top:10px; right:10px; max-width:150px; z-index:10; font-size:0.8rem; pointer-events:none;"></div>
                        
                        <div id="avMult" style="position:absolute; top:40%; left:50%; transform:translate(-50%,-50%); font-size:4.5rem; font-weight:900; font-family:monospace; color:white; z-index:5; text-shadow: 0 0 20px rgba(255,255,255,0.3);">1.00x</div>
                        
                        <!-- 5-Second Betting Mask -->
                        <div id="avBetMask" style="position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:6; display:none; flex-direction:column; justify-content:center; align-items:center;">
                            <div id="avBetProgress" style="width:80%; height:8px; background:rgba(255,255,255,0.2); border-radius:10px; margin-bottom:15px; overflow:hidden;">
                                <div id="avBetProgressBar" style="width:100%; height:100%; background:var(--danger-color); transition: width 0.1s linear;"></div>
                            </div>
                            <div id="avBetTimerText" style="font-size:1.5rem; font-weight:900; color:white; text-shadow:0 2px 10px rgba(0,0,0,0.5);">NEXT ROUND IN 5.0s</div>
                        </div>

                        <div id="avCrashMsg" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:4rem; font-weight:900; color:#EF4444; opacity:0; z-index:7; white-space:nowrap; text-shadow: 0 0 30px rgba(239,68,68,0.8); pointer-events:none;">FLEW AWAY!</div>
                        
                        <canvas id="avCanvas" style="position:absolute; bottom:0; left:0; width:100%; height:100%;"></canvas>
                        
                        <!-- 19. Sparks element -->
                        <div id="avSpark" class="spark"></div>
                    </div>

                    <!-- Provably Fair Modal -->
                    <div id="pfModal" class="cyber-card" style="display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:90%; max-width:400px; padding:20px; z-index:9999; border-radius:15px; text-align:center;">
                        <h3 style="color:var(--color-cyan); margin-bottom:15px;"><i class="fa-solid fa-shield-halved"></i> Provably Fair</h3>
                        <p style="color:#94A3B8; font-size:0.9rem; line-height:1.5;">This game is secured by Own Myfa Server. The outcome is generated before the round begins and is 100%fair.</p>
                        <button class="btn btn-secondary" onclick="document.getElementById('pfModal').style.display='none'" style="margin-top:20px; width:100%;">Close</button>
                    </div>

                    <!-- 18. Dual Independent Auto-Cashouts & Betting Panels -->
                    <div style="display:flex; justify-content:center; gap:10px; margin-bottom:15px;">
                        <button class="panel-toggle-btn" style="border-radius:10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); padding: 8px 12px; display:flex; align-items:center; gap:5px; flex:1; justify-content:center;" onclick="document.getElementById('myBetsSide').classList.toggle('open')"><i class="fa-solid fa-clock-rotate-left"></i> My Bets</button>
                        <button class="panel-toggle-btn" style="border-radius:10px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); padding: 8px 12px; display:flex; align-items:center; gap:5px; flex:1; justify-content:center;" onclick="document.getElementById('topBetsSide').classList.toggle('open')"><i class="fa-solid fa-trophy"></i> Top Bets</button>
                    </div>
                    <div class="bet-panel-container" style="display:flex; flex-direction:column; gap:15px;">
                        <!-- Panel 1 -->
                        <div class="bet-panel cyber-card" style="padding:15px; border-radius:15px; border:1px solid rgba(255,255,255,0.1); background:linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));">
                            <!-- 11. Auto Play Toggle -->
                            <div class="auto-play-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:0.9rem; color:#A0AEC0;">
                                <span><i class="fa-solid fa-robot"></i> Auto Play</span> 
                                <label class="switch"><input type="checkbox" id="avAutoPlay1"><span class="slider"></span></label>
                            </div>
                            
                            <div style="display:flex; gap:10px; margin-bottom:10px;">
                                <div style="flex:1;">
                                    <div style="font-size:0.7rem; color:#888; margin-bottom:3px;"><i class="fa-solid fa-coins"></i> Bet Amount</div>
                                    <div style="display:flex; background:rgba(0,0,0,0.3); border-radius:8px; border:1px solid rgba(255,255,255,0.1); overflow:hidden;">
                                        <button onclick="modBet('avBet1', -10)" style="background:transparent; border:none; color:white; padding:10px; cursor:pointer;"><i class="fa-solid fa-minus"></i></button>
                                        <input type="number" id="avBet1" style="background:transparent; border:none; color:white; text-align:center; width:100%; outline:none; font-weight:bold; -moz-appearance: textfield;" value="10">
                                        <button onclick="modBet('avBet1', 10)" style="background:transparent; border:none; color:white; padding:10px; cursor:pointer;"><i class="fa-solid fa-plus"></i></button>
                                    </div>
                                </div>
                                <div style="flex:1;">
                                    <div style="font-size:0.7rem; color:#888; margin-bottom:3px;"><i class="fa-solid fa-hand-holding-dollar"></i> Auto Cashout</div>
                                    <input type="number" id="avAutoCash1" class="input-field" style="margin:0; text-align:center; height:42px; border-radius:8px;" placeholder="e.g. 2.0">
                                </div>
                            </div>
                            
                            <!-- 7. Quick-Bet Hotkeys -->
                            <div class="hotkey-row" style="display:flex; gap:5px; margin-bottom:10px;">
                                <button class="hotkey-btn" style="flex:1; background:rgba(255,255,255,0.1); border:none; border-radius:5px; color:white; padding:5px; font-size:0.8rem; cursor:pointer;" onclick="modBet('avBet1', 10)">+10</button>
                                <button class="hotkey-btn" style="flex:1; background:rgba(255,255,255,0.1); border:none; border-radius:5px; color:white; padding:5px; font-size:0.8rem; cursor:pointer;" onclick="modBet('avBet1', 50)">+50</button>
                                <button class="hotkey-btn" style="flex:1; background:rgba(255,255,255,0.1); border:none; border-radius:5px; color:white; padding:5px; font-size:0.8rem; cursor:pointer;" onclick="modBet('avBet1', 'half')">1/2</button>
                                <button class="hotkey-btn" style="flex:1; background:rgba(255,255,255,0.1); border:none; border-radius:5px; color:white; padding:5px; font-size:0.8rem; cursor:pointer;" onclick="modBet('avBet1', 'max')">MAX</button>
                            </div>
                            
                            <button class="bet-btn idle" id="avBtn1" style="width:100%; padding:15px; border-radius:10px; font-weight:900; font-size:1.2rem; border:none; cursor:pointer; text-transform:uppercase; transition:0.2s;" onclick="avAction(1)">BET</button>
                        </div>
                        
                        <!-- Panel 2 -->
                        <div class="bet-panel cyber-card" style="padding:15px; border-radius:15px; border:1px solid rgba(255,255,255,0.1); background:linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01));">
                            <div class="auto-play-row" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; font-size:0.9rem; color:#A0AEC0;">
                                <span><i class="fa-solid fa-robot"></i> Auto Play</span> 
                                <label class="switch"><input type="checkbox" id="avAutoPlay2"><span class="slider"></span></label>
                            </div>
                            
                            <div style="display:flex; gap:10px; margin-bottom:10px;">
                                <div style="flex:1;">
                                    <div style="font-size:0.7rem; color:#888; margin-bottom:3px;"><i class="fa-solid fa-coins"></i> Bet Amount</div>
                                    <div style="display:flex; background:rgba(0,0,0,0.3); border-radius:8px; border:1px solid rgba(255,255,255,0.1); overflow:hidden;">
                                        <button onclick="modBet('avBet2', -10)" style="background:transparent; border:none; color:white; padding:10px; cursor:pointer;"><i class="fa-solid fa-minus"></i></button>
                                        <input type="number" id="avBet2" style="background:transparent; border:none; color:white; text-align:center; width:100%; outline:none; font-weight:bold; -moz-appearance: textfield;" value="10">
                                        <button onclick="modBet('avBet2', 10)" style="background:transparent; border:none; color:white; padding:10px; cursor:pointer;"><i class="fa-solid fa-plus"></i></button>
                                    </div>
                                </div>
                                <div style="flex:1;">
                                    <div style="font-size:0.7rem; color:#888; margin-bottom:3px;"><i class="fa-solid fa-hand-holding-dollar"></i> Auto Cashout</div>
                                    <input type="number" id="avAutoCash2" class="input-field" style="margin:0; text-align:center; height:42px; border-radius:8px;" placeholder="e.g. 2.0">
                                </div>
                            </div>
                            
                            <div class="hotkey-row" style="display:flex; gap:5px; margin-bottom:10px;">
                                <button class="hotkey-btn" style="flex:1; background:rgba(255,255,255,0.1); border:none; border-radius:5px; color:white; padding:5px; font-size:0.8rem; cursor:pointer;" onclick="modBet('avBet2', 10)">+10</button>
                                <button class="hotkey-btn" style="flex:1; background:rgba(255,255,255,0.1); border:none; border-radius:5px; color:white; padding:5px; font-size:0.8rem; cursor:pointer;" onclick="modBet('avBet2', 50)">+50</button>
                                <button class="hotkey-btn" style="flex:1; background:rgba(255,255,255,0.1); border:none; border-radius:5px; color:white; padding:5px; font-size:0.8rem; cursor:pointer;" onclick="modBet('avBet2', 'half')">1/2</button>
                                <button class="hotkey-btn" style="flex:1; background:rgba(255,255,255,0.1); border:none; border-radius:5px; color:white; padding:5px; font-size:0.8rem; cursor:pointer;" onclick="modBet('avBet2', 'max')">MAX</button>
                            </div>
                            
                            <button class="bet-btn idle" id="avBtn2" style="width:100%; padding:15px; border-radius:10px; font-weight:900; font-size:1.2rem; border:none; cursor:pointer; text-transform:uppercase; transition:0.2s;" onclick="avAction(2)">BET</button>
                        </div>
                    </div>

                    <!-- 9. My Bet History Panel -->
                    <div id="myBetsSide" class="side-panel left cyber-card" style="padding:20px; box-shadow:5px 0 30px rgba(0,0,0,0.5);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; font-weight:bold; font-size:1.2rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
                            <span><i class="fa-solid fa-clock-rotate-left"></i> My Flights</span> 
                            <button class="panel-toggle-btn" style="background:transparent; border:none; color:white; font-size:1.5rem; cursor:pointer;" onclick="document.getElementById('myBetsSide').classList.remove('open')"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div id="myBetsList" style="display:flex; flex-direction:column; gap:10px;"></div>
                    </div>

                    <!-- 8. Top Bets Panel -->
                    <div id="topBetsSide" class="side-panel right cyber-card" style="padding:20px; box-shadow:-5px 0 30px rgba(0,0,0,0.5);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; font-weight:bold; font-size:1.2rem; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
                            <span><i class="fa-solid fa-trophy"></i> Top Bets</span> 
                            <button class="panel-toggle-btn" style="background:transparent; border:none; color:white; font-size:1.5rem; cursor:pointer;" onclick="document.getElementById('topBetsSide').classList.remove('open')"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div id="topBetsList" style="display:flex; flex-direction:column; gap:10px;"></div>
                    </div>
                </div>
            `;
            initAviatorCanvas();
            loadHistory();
            avGameState = 'IDLE';
            startBettingPhase(); // Immediately start loop when opened
            
            // 15. Network Disconnect Auto-loss money
            window.addEventListener('offline', avForceLoss);
            // 10. Keyboard Shortcuts (Spacebar to bet/cashout Panel 1)
            window.addEventListener('keydown', handleSpacebar);

            if(window.avBannerInterval) clearInterval(window.avBannerInterval);
            window.avBannerInterval = setInterval(() => {
                const banner = document.getElementById('avBanner');
                if(!banner) {
                    clearInterval(window.avBannerInterval);
                    return;
                }
                const names = ["Alex", "CryptoKing", "Sarah", "Mesechebo", "Oleg", "Ivan", "Maria", "John_Doe", "Alice", "Bob", "MoonLambo", "DogecoinWhale", "Satoshi", "Vitalic", "Gamer99", "LuckyStrike", "Winner777", "HighRoller", "DiamondHands", "Ape"];
                const rName = names[Math.floor(Math.random()*names.length)];
                const rGems = Math.floor(Math.random() * 49000) + 1000;
                const rMult = (Math.random() * 19 + 1).toFixed(2);
                banner.style.opacity = 0;
                setTimeout(() => {
                    banner.innerHTML = `<i class="fa-solid fa-fire" style="color:#ef4444;"></i> ${rName} won ${rGems.toLocaleString()} Gems at ${rMult}x!`;
                    banner.style.opacity = 1;
                }, 300);
            }, 4000);
        }

        function handleSpacebar(e) {
            if(e.code === 'Space' && document.getElementById('avBtn1')) {
                e.preventDefault();
                avAction(1);
            }
        }

        function avForceLoss() {
            if(aviatorActive) {
                showToast("Network Disconnected. Bets Lost.", "error");
                avCrash(aviatorMultiplier);
            }
        }

        function modBet(inputId, val) {
            const input = document.getElementById(inputId);
            let cur = Number(input.value) || 0;
            if(val === 'max') input.value = currentUser.points;
            else if(val === 'half') input.value = Math.floor(cur / 2);
            else input.value = cur + val;
        }

        let avCtx, avX, avY, bgOffset = 0;
        function initAviatorCanvas() {
            const canvas = document.getElementById('avCanvas');
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
            avCtx = canvas.getContext('2d');
            drawPlane(0, canvas.height, 1.0);
        }

        // 16. VIP Golden Plane Skin & Explosion logic with Bezier Curve + Parallax
        function drawPlane(x, y, scale = 1.0, exploded = false) {
            avCtx.clearRect(0,0, avCtx.canvas.width, avCtx.canvas.height);
            
            // Parallax Grid Background (Diagonally Panning)
            if (avGameState === 'FLYING' || avGameState === 'CRASHED') {
                bgOffset += 2;
                if(bgOffset > 40) bgOffset = 0;
                avCtx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                avCtx.lineWidth = 1;
                avCtx.beginPath();
                for(let i = -bgOffset; i < avCtx.canvas.width; i+=40) { avCtx.moveTo(i, 0); avCtx.lineTo(i, avCtx.canvas.height); }
                for(let j = -bgOffset; j < avCtx.canvas.height; j+=40) { avCtx.moveTo(0, j); avCtx.lineTo(avCtx.canvas.width, j); }
                avCtx.stroke();
            }

            avCtx.save();
            avCtx.translate(0, avCtx.canvas.height * (1-scale)); 
            avCtx.scale(1, scale);

            if (avGameState === 'FLYING' || avGameState === 'CRASHED') {
                // Gradient Fill Under Bezier Curve
                avCtx.beginPath();
                avCtx.moveTo(0, avCtx.canvas.height);
                avCtx.quadraticCurveTo(x/2, avCtx.canvas.height, x, y);
                avCtx.lineTo(x, avCtx.canvas.height);
                avCtx.lineTo(0, avCtx.canvas.height);
                const grad = avCtx.createLinearGradient(0, y, 0, avCtx.canvas.height);
                grad.addColorStop(0, 'rgba(239,68,68,0.5)');
                grad.addColorStop(1, 'rgba(239,68,68,0.0)');
                avCtx.fillStyle = grad;
                avCtx.fill();

                // Draw Bezier Line
                avCtx.beginPath();
                avCtx.moveTo(0, avCtx.canvas.height);
                avCtx.quadraticCurveTo(x/2, avCtx.canvas.height, x, y);
                avCtx.lineWidth = 4;
                avCtx.strokeStyle = '#EF4444';
                avCtx.stroke();
            }

            avCtx.restore();

            if (avGameState !== 'IDLE' && avGameState !== 'BETTING') {
                if (exploded) {
                    // Smoke puff
                    avCtx.fillStyle = '#333';
                    avCtx.beginPath();
                    avCtx.arc(x, y, 30, 0, Math.PI*2);
                    avCtx.arc(x-15, y+10, 20, 0, Math.PI*2);
                    avCtx.arc(x+15, y+10, 20, 0, Math.PI*2);
                    avCtx.fill();
                    avCtx.fillStyle = '#555';
                    avCtx.beginPath();
                    avCtx.arc(x-5, y-5, 15, 0, Math.PI*2);
                    avCtx.fill();
                } else {
                    const isGolden = currentUser.points > 50000;
                    avCtx.save();
                    avCtx.translate(x, y);
                    avCtx.scale(0.8, 0.8);
                    
                    if (isGolden) {
                        avCtx.shadowColor = '#FFD700';
                        avCtx.shadowBlur = 20;
                        avCtx.fillStyle = '#FFD700';
                    } else {
                        avCtx.shadowColor = 'rgba(239,68,68,0.5)';
                        avCtx.shadowBlur = 15;
                        avCtx.fillStyle = '#EF4444';
                    }

                    // Biplane SVG Path
                    const path = new Path2D("M30,-5 C35,-5 38,-2 38,2 C38,6 35,9 30,9 L25,9 L15,18 L0,18 L10,9 L-15,9 L-20,13 L-25,13 L-20,4 L-25,-5 L-20,-5 L-15,0 L10,0 L0,-9 L15,-9 Z M38,0 C40,0 42,2 42,4 C42,6 40,8 38,8 C36,8 34,6 34,4 C34,2 36,0 38,0 Z");
                    avCtx.fill(path);
                    
                    // Spinning propeller (pulsating ellipse at the front)
                    avCtx.fillStyle = 'rgba(255,255,255,0.8)';
                    const propScale = Math.abs(Math.sin(Date.now() / 20));
                    avCtx.beginPath();
                    avCtx.ellipse(40, 4, 3, 10 * propScale, 0, 0, Math.PI*2);
                    avCtx.fill();

                    avCtx.restore();
                }
            }
        }

        // Web Audio API for Pitch
        function initEngineSound() {
            if(!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                oscillator = audioCtx.createOscillator();
                gainNode = audioCtx.createGain();
                
                oscillator.type = 'sawtooth';
                oscillator.frequency.value = 100;
                gainNode.gain.value = 0.1;
                
                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);
                oscillator.start();
            } else {
                gainNode.gain.value = 0.1;
                oscillator.frequency.value = 100;
            }
        }
        function stopEngineSound() {
            if(gainNode) gainNode.gain.value = 0;
        }

        async function loadHistory() {
            const h = await fetch(`${API_BASE_URL}/api/config`).then(r=>r.json());
            window.avCurrentHistory = h.aviatorHistory || [1.2, 5.0, 1.0, 2.5, 12.1];
            updateHistoryBar(window.avCurrentHistory);
            
            // Populate Fake Top Bets
            let html = '';
            for(let i=0; i<10; i++) {
                html += `<div class="history-item"><span>${avNames ? avNames[Math.floor(Math.random()*avNames.length)] : 'User' + Math.floor(Math.random()*999)}</span><span class="win">+${Math.floor(Math.random()*5000)} Gems</span></div>`;
            }
            document.getElementById('topBetsList').innerHTML = html;

            // My Bet History
            let myHtml = '';
            const logs = currentUser.logs || [];
            logs.filter(l=>l.includes('Aviator')).reverse().slice(0,10).forEach(l => {
                const isWin = l.includes('Cashout');
                myHtml += `<div class="history-item"><span>${l.split('] ')[0].replace('[','')}</span><span class="${isWin?'win':'loss'}">${isWin?'WON':'LOST'}</span></div>`;
            });
            document.getElementById('myBetsList').innerHTML = myHtml || 'No flights yet.';
        }

        function updateHistoryBar(list) {
            const histHtml = list.map(m => {
                let c = 'pill-low';
                if(m >= 2.0 && m < 10.0) c = 'pill-med';
                if(m >= 10.0) c = 'pill-high';
                return `<div class="history-pill ${c}">${m.toFixed(2)}x</div>`;
            }).join('');
            document.getElementById('avHistory').innerHTML = histHtml;
        }

        function avAction(panel) {
            const btn = document.getElementById(`avBtn${panel}`);
            
            if (avGameState === 'FLYING' || avGameState === 'CRASHED') {
                if (btn.classList.contains('waiting') && avGameState === 'FLYING') {
                    // Cashout Request
                    const mult = aviatorMultiplier;
                    const bet = parseInt(btn.dataset.queuedBet) || 0;
                    
                    fetch(`${API_BASE_URL}/api/aviator/cashout`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ userId, roundId: aviatorRound.roundId, multiplier: mult, betAmount: bet })
                    }).then(r => r.json()).then(data => {
                        if(data.success) {
                            btn.className = "bet-btn idle";
                            btn.innerText = `WON ${data.winnings}`;
                            playSound('audioCashout');
                            currentUser.points += data.winnings; // Backend already added, sync locally
                            updateUI();
                            if(document.getElementById('avHeaderBal')) document.getElementById('avHeaderBal').innerText = currentUser.points;
                            triggerSpark(avX, avY);
                            if(mult > 5.0) confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#FFD700', '#FFA500'] });
                        }
                    });
                } else if(avGameState === 'FLYING') {
                    showToast("Wait for next round.", "info");
                }
                return;
            }

            if(btn.classList.contains('idle')) {
                // Place Bet during BETTING phase
                const bet = parseInt(document.getElementById(`avBet${panel}`).value);
                if(currentUser.points < bet) return showToast("Not enough Gems", "error");
                
                currentUser.points -= bet; // Local deduction for instant UI feedback
                updateUI();
                if(document.getElementById('avHeaderBal')) document.getElementById('avHeaderBal').innerText = currentUser.points;
                
                btn.className = "bet-btn active";
                btn.innerText = "CANCEL";
                btn.dataset.queuedBet = bet;
                
                if (avGameState === 'IDLE') startBettingPhase();
            } 
            else if (btn.classList.contains('active') && avGameState === 'BETTING') {
                // Cancel Bet
                const queued = parseInt(btn.dataset.queuedBet) || 0;
                currentUser.points += queued;
                updateUI();
                if(document.getElementById('avHeaderBal')) document.getElementById('avHeaderBal').innerText = currentUser.points;
                
                btn.className = "bet-btn idle";
                btn.innerText = "BET";
                btn.dataset.queuedBet = "0";
            }
        }

        function triggerSpark(x, y) {
            const spark = document.getElementById('avSpark');
            spark.style.left = `${x}px`;
            spark.style.top = `${y}px`;
            spark.style.animation = 'none';
            spark.offsetHeight; // trigger reflow
            spark.style.animation = 'sparkAnim 0.5s ease-out';
        }

        // 6. Live Chat Simulator
        let chatInterval;
        var avNames = ['CryptoKing', 'BitcoinBob', 'MoonWalker', 'Satoshi99', 'ETH_Whale', 'DiamondHands', 'PepeFrog', 'DogeLover', 'AviatorPro', 'SkyHigh', 'BullRun', 'BearTear', 'WhaleAlert', 'TxHash', 'BlockBuilder', 'NodeRunner', 'GasFee', 'GweiTracker', 'SolanaSurfer', 'TonMaster', 'NotcoinNinja', 'HamsterBoss', 'TapTapTap', 'Web3Warrior', 'DeFiDegen', 'SmartContract', 'LedgerLive', 'TrezorSafe', 'SeedPhrase', 'MintedNFT', 'FloorPrice', 'PaperHands', 'RektCity', 'FOMO_Buyer', 'HODLer', 'BagHolder', 'MoonShot', 'AlphaSeeker', 'BetaTester', 'GammaRay', 'DeltaForce', 'EpsilonEdge', 'ZetaZero', 'EtaChain', 'ThetaToken', 'IotaInvest', 'KappaKoin', 'LambdaLogic', 'MuMiner', 'NuNetwork', 'XiXchange', 'PavelDurov'];

        function simulateChat() {
            const chatBox = document.getElementById('avChat');
            const msgs = ["Wow!", "Cash out now!", "Greedy!", "Boom!", "Nice win", "RIP", "Fly high!"];
            chatInterval = setInterval(() => {
                if(avGameState !== 'FLYING') return;
                const div = document.createElement('div');
                div.className = 'chat-msg';
                div.innerHTML = `<span class="user">${avNames[Math.floor(Math.random()*avNames.length)]}:</span> ${msgs[Math.floor(Math.random()*msgs.length)]}`;
                chatBox.prepend(div);
                if(chatBox.children.length > 5) chatBox.removeChild(chatBox.lastChild);
            }, 1500);
        }

        async function startBettingPhase() {
            if (avGameState === 'BETTING') return;
            avGameState = 'BETTING';
            avBetTimeLeft = 5.0;
            
            const msgEl = document.getElementById('avCrashMsg');
            if(msgEl) msgEl.style.opacity = '0';
            
            const maskEl = document.getElementById('avBetMask');
            const timerEl = document.getElementById('avBetTimerText');
            const progBar = document.getElementById('avBetProgressBar');
            if (maskEl) maskEl.style.display = 'flex';
            
            [1,2].forEach(p => {
                const btn = document.getElementById(`avBtn${p}`);
                if(btn) {
                    btn.className = "bet-btn idle";
                    btn.innerText = "BET";
                    const autoCheck = document.getElementById(`avAutoPlay${p}`);
                    if (autoCheck && autoCheck.checked) {
                        avAction(p);
                    }
                }
            });

            drawPlane(0, document.getElementById('avCanvas').height, 1.0);

            avBetTimer = setInterval(() => {
                avBetTimeLeft -= 0.1;
                if (avBetTimeLeft <= 0) {
                    clearInterval(avBetTimer);
                    if (maskEl) maskEl.style.display = 'none';
                    startFlight();
                    return;
                }
                if (timerEl) timerEl.innerText = `NEXT ROUND IN ${avBetTimeLeft.toFixed(1)}s`;
                if (progBar) progBar.style.width = `${(avBetTimeLeft / 5) * 100}%`;
            }, 100);
        }

        async function startFlight() {
            avGameState = 'FLYING';
            aviatorMultiplier = 1.00;
            
            let totalBet = 0;
            [1,2].forEach(p => {
                const btn = document.getElementById(`avBtn${p}`);
                if(btn.classList.contains('active')) {
                    totalBet += parseInt(btn.dataset.queuedBet) || 0;
                    btn.className = "bet-btn waiting";
                    btn.innerText = "CASHOUT";
                } else {
                    btn.className = "bet-btn disabled";
                    btn.innerText = "WAIT";
                }
            });

            // If local bet was deducted, restore it momentarily because backend subtracts it in /start
            if (totalBet > 0) currentUser.points += totalBet;

            const res = await fetch(`${API_BASE_URL}/api/aviator/start`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId, betAmount: totalBet })
            });
            aviatorRound = await res.json();
            
            if (totalBet > 0) {
                // Ensure UI is synced with backend deduction
                const uRes = await fetch(`${API_BASE_URL}/api/user/${userId}`);
                currentUser = await uRes.json();
                updateUI();
                if(document.getElementById('avHeaderBal')) document.getElementById('avHeaderBal').innerText = currentUser.points;
            }

            window.avCurrentHistory = aviatorRound.history || window.avCurrentHistory;
            updateHistoryBar(window.avCurrentHistory);
            
            document.getElementById('avCrashMsg').style.opacity = '0';
            document.getElementById('avMult').style.color = "white";
            const wrapper = document.getElementById('avWrapper');
            wrapper.className = "aviator-wrapper"; // reset bg
            
            if(audioCtx) audioCtx.resume();
            initEngineSound();
            simulateChat();

            const targetMult = aviatorRound.crashPoint;
            const canvas = document.getElementById('avCanvas');
            let t = 0;

            function animate() {
                if(avGameState !== 'FLYING') return;
                t += 0.02;
                aviatorMultiplier = 1.00 + Math.pow(t, 2) * 0.1;
                
                if(document.getElementById('avMult')) document.getElementById('avMult').innerText = aviatorMultiplier.toFixed(2) + 'x';
                
                // 3. Atmosphere Shifts
                const wrapper = document.getElementById('avWrapper');
                if(aviatorMultiplier > 2 && aviatorMultiplier <= 5) wrapper.classList.add('clouds');
                if(aviatorMultiplier > 5) wrapper.classList.add('space');
                
                // 13. Progressive Engine Pitch
                if(oscillator) oscillator.frequency.value = 100 + (aviatorMultiplier * 20);

                // 18. Independent Auto-Cashouts
                [1,2].forEach(p => {
                    const autoVal = document.getElementById(`avAutoCash${p}`).value;
                    const btn = document.getElementById(`avBtn${p}`);
                    if(autoVal && aviatorMultiplier >= parseFloat(autoVal) && btn.classList.contains('waiting')) {
                        avAction(p);
                    }
                });

                // 14. Pre-Crash Turbulence
                if(targetMult - aviatorMultiplier < 0.5 && targetMult > 1.5) {
                    wrapper.classList.add('turbulence');
                }

                avX = Math.min(canvas.width - 50, t * 25);
                avY = Math.max(50, canvas.height - (t * 20));
                
                // Dynamic Zoom scale factor
                let scale = 1.0 - (t * 0.01);
                if(scale < 0.7) scale = 0.7;

                drawPlane(avX, avY, scale);

                if(aviatorMultiplier >= targetMult) {
                    avCrash(targetMult);
                } else {
                    avReq = requestAnimationFrame(animate);
                }
            }
            animate();
        }

        function avCrash(crashedAt) {
            avGameState = 'CRASHED';
            cancelAnimationFrame(avReq);
            stopEngineSound();
            clearInterval(chatInterval);
            playSound('audioCrash');

            const wrapper = document.getElementById('avWrapper');
            wrapper.classList.remove('turbulence');
            
            document.getElementById('avCrashMsg').style.opacity = '1';
            document.getElementById('avCrashMsg').style.color = "var(--danger-color)";
            if(document.getElementById('avCrashMsg')) document.getElementById('avCrashMsg').innerText = 'FLEW AWAY';
            document.getElementById('avMult').style.color = "var(--danger-color)";
            if(document.getElementById('avMult')) document.getElementById('avMult').innerText = (crashedAt).toFixed(2) + 'x';
            if (window.avCurrentHistory) {
                window.avCurrentHistory.push(crashedAt);
                if (window.avCurrentHistory.length > 20) window.avCurrentHistory.shift();
                updateHistoryBar(window.avCurrentHistory);
            }

            // 12. Explosion Render
            drawPlane(avX, avY, 1.0, true);
            
            [1,2].forEach(p => {
                const btn = document.getElementById(`avBtn${p}`);
                if(btn.classList.contains('waiting')) {
                    btn.className = "bet-btn idle";
                    btn.innerText = "BET";
                }
                
                // 11. Auto-Play check
                const isAuto = document.getElementById(`avAutoPlay${p}`).checked;
                if(isAuto) {
                    // Queue for next round immediately
                    setTimeout(() => { if (btn.classList.contains('idle')) avAction(p); }, 2000);
                }
            });

            // Reset visual state after 3s and restart betting
            setTimeout(() => {
                if(!document.getElementById('avMult')) return;
                document.getElementById('avMult').style.color = "white";
                if(document.getElementById('avMult')) document.getElementById('avMult').innerText = '1.00x';
                wrapper.className = "aviator-wrapper";
                drawPlane(0, document.getElementById('avCanvas').height, 1.0);
                startBettingPhase();
            }, 3000);
        }

        // ==========================================
        // MULTI OX GAME (Tic Tac Toe vs Bot)
        // ==========================================
        function renderMultiOxGame(c) {
            c.innerHTML = `
                <div class="game-sticky-header" style="position:sticky; top:0; z-index:100; display:flex; justify-content:space-between; align-items:center; background:rgba(15,23,42,0.9); backdrop-filter:blur(10px); padding:10px 15px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <button class="btn btn-secondary" onclick="closeGame()" style="width:auto; padding:5px 15px; font-size:0.9rem;"><i class="fa-solid fa-arrow-left"></i> Back to Hub</button>
                    <div style="font-weight:bold; color:var(--accent-color);"><i class="fa-solid fa-gem"></i> <span id="gameHeaderBal">${currentUser.points}</span></div>
                </div>
                <div class="card cyber-card" style="padding:20px; text-align:center;">
                    <h2 style="color:#3B82F6;"><i class="fa-solid fa-xmarks-lines"></i> Multi OX (Minimax)</h2>
                    <p style="color:#94a3b8; font-size:0.9rem;">Wager Gems and try to beat the unbeatable Bot!</p>
                    
                    <div style="margin: 15px auto; display:flex; gap:10px; justify-content:center; align-items:center;">
                        <select id="oxWager" class="input-field" style="width:100px; padding:10px; background:rgba(0,0,0,0.5); color:white; border:1px solid var(--color-cyan); border-radius:8px;">
                            <option value="15">15 Gems</option>
                            <option value="25">25 Gems</option>
                            <option value="50">50 Gems</option>
                            <option value="75">75 Gems</option>
                            <option value="90">90 Gems</option>
                            <option value="100">100 Gems</option>
                            <option value="200">200 Gems</option>
                        </select>
                        <button class="btn quantum-btn" id="oxBtnBot" onclick="startOxBot()">Play Bot</button>
                        <button class="btn btn-secondary" id="oxBtnOnline" onclick="showToast('Searching for players... (Simulated Timeout)', 'info')">Play Online</button>
                    </div>

                    <div style="margin:20px auto; display:grid; grid-template-columns:repeat(3, 80px); gap:10px; justify-content:center; opacity:0.5; pointer-events:none;" id="oxBoardUI">
                        ${[0,1,2,3,4,5,6,7,8].map(i => `<div class="ox-cell" id="ox-${i}" onclick="playOx(${i})" style="width:80px; height:80px; background:var(--glass-bg); border:1px solid var(--glass-border); box-shadow:0 4px 6px rgba(0,0,0,0.1); border-radius:15px; display:flex; justify-content:center; align-items:center; font-size:2.5rem; cursor:pointer; color:var(--accent-color);"></div>`).join('')}
                    </div>
                </div>
            `;
            window.oxBoard = Array(9).fill(null);
            window.oxActive = false;
            window.oxWager = 0;
        }

        function startOxBot() {
            const wager = parseInt(document.getElementById('oxWager').value);
            if ((currentUser.points || 0) < wager) return showToast("Not enough Gems!", "error");
            
            window.oxWager = wager;
            window.oxBoard = Array(9).fill(null);
            window.oxActive = true;
            
            // Deduct wager locally for instant UI update
            currentUser.points -= wager;
            updateUI();
            if(document.getElementById('gameHeaderBal')) document.getElementById('gameHeaderBal').innerText = currentUser.points;
            
            document.getElementById('oxBoardUI').style.opacity = '1';
            document.getElementById('oxBoardUI').style.pointerEvents = 'auto';
            document.getElementById('oxBtnBot').disabled = true;
            document.getElementById('oxWager').disabled = true;
            
            for(let i=0; i<9; i++) document.getElementById(`ox-${i}`).innerHTML = '';
            showToast(`Wagered ${wager} Gems. Your turn! (O)`, "info");
        }

        function playOx(idx) {
            if(!window.oxActive || window.oxBoard[idx]) return;
            window.oxBoard[idx] = 'O';
            document.getElementById(`ox-${idx}`).innerHTML = '<i class="fa-regular fa-circle" style="color:var(--color-cyan);"></i>';
            
            if(checkOxWinState(window.oxBoard, 'O')) return endOxGame('win');
            if(!window.oxBoard.includes(null)) return endOxGame('draw');

            // Rigged Bot Move based on oxWinRate
            let move = null;
            let winRate = appConfig.oxWinRate ? parseFloat(appConfig.oxWinRate) : 0; // Default 0 chance to win
            
            let emptySlots = [];
            for(let i=0; i<9; i++) if(window.oxBoard[i] === null) emptySlots.push(i);

            if (emptySlots.length > 0) {
                if (Math.random() < winRate) {
                    // Bot makes a random mistake
                    move = emptySlots[Math.floor(Math.random() * emptySlots.length)];
                } else {
                    // Pure Minimax Bot Move
                    let bestScore = -Infinity;
                    for(let i = 0; i < 9; i++) {
                        if(window.oxBoard[i] === null) {
                            window.oxBoard[i] = 'X';
                            let score = minimax(window.oxBoard, 0, false);
                            window.oxBoard[i] = null;
                            if(score > bestScore) {
                                bestScore = score;
                                move = i;
                            }
                        }
                    }
                }
            }

            
            window.oxBoard[move] = 'X';
            setTimeout(() => {
                document.getElementById(`ox-${move}`).innerHTML = '<i class="fa-solid fa-xmark" style="color:var(--danger-color);"></i>';
                if(checkOxWinState(window.oxBoard, 'X')) return endOxGame('loss');
                if(!window.oxBoard.includes(null)) return endOxGame('draw');
            }, 300);
        }

        function minimax(board, depth, isMaximizing) {
            if (checkOxWinState(board, 'X')) return 10 - depth;
            if (checkOxWinState(board, 'O')) return depth - 10;
            if (!board.includes(null)) return 0;

            if (isMaximizing) {
                let bestScore = -Infinity;
                for (let i = 0; i < 9; i++) {
                    if (board[i] === null) {
                        board[i] = 'X';
                        let score = minimax(board, depth + 1, false);
                        board[i] = null;
                        bestScore = Math.max(score, bestScore);
                    }
                }
                return bestScore;
            } else {
                let bestScore = Infinity;
                for (let i = 0; i < 9; i++) {
                    if (board[i] === null) {
                        board[i] = 'O';
                        let score = minimax(board, depth + 1, true);
                        board[i] = null;
                        bestScore = Math.min(score, bestScore);
                    }
                }
                return bestScore;
            }
        }

        function checkOxWinState(board, player) {
            const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
            return wins.some(combo => combo.every(i => board[i] === player));
        }

        async function endOxGame(result) {
            window.oxActive = false;
            document.getElementById('oxBoardUI').style.pointerEvents = 'none';
            document.getElementById('oxBtnBot').disabled = false;
            document.getElementById('oxWager').disabled = false;
            
            if (result === 'win') showToast("You beat Minimax?! (Impossible)", "success");
            else if (result === 'loss') showToast(`You lost! -${window.oxWager} Gems`, "error");
            else showToast(`Draw! Wager returned.`, "info");
            
            // Sync with backend for RTP tracking
            const res = await fetch(`${API_BASE_URL}/api/ox/result`, {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ userId, bet: window.oxWager, result })
            });
            const data = await res.json();
            if(data.success) {
                currentUser.points = data.newBal;
                updateUI();
                if(document.getElementById('gameHeaderBal')) document.getElementById('gameHeaderBal').innerText = currentUser.points;
            }
        }

        // ==========================================
        // DAILY COMBO GAME
        // ==========================================
        const comboSVGs = {
            c1: '<svg viewBox="0 0 24 24" fill="var(--color-cyan)"><path d="M14 2c0-1.1-.9-2-2-2S10 .9 10 2c0 1.1.9 2 2 2s2-.9 2-2zm2 18H8v-2h8v2zm-3-15H9v1.2C7.3 7 6 8.8 6 11v1h2v-1c0-1.7 1.3-3 3-3h1.8c.1 0 .2.1.2.2v5.6c0 1.2 1 2.2 2.2 2.2h1.6c1.2 0 2.2-1 2.2-2.2v-2.6c1.1-.3 2-1.3 2-2.4V8c0-1.7-1.3-3-3-3h-1v-.8c0-.7-.5-1.2-1.2-1.2z"/></svg>',
            c2: '<svg viewBox="0 0 24 24" fill="var(--gold-color)"><path d="M17.5 11.5c-1.5-2-2.5-4.5-2.5-7 0-.6-.5-1-1-1s-1 .4-1 1c0 2-1 4-2 5.5s-2.5 3-2.5 5c0 3.3 2.7 6 6 6s6-2.7 6-6c0-2-1.5-3.5-3-4.5zM12 20c-2.2 0-4-1.8-4-4 0-1.3.8-2.6 1.8-3.5 1.5-1.2 2.2-3 2.2-4.5.5 1.5 2 2.5 3 3.5 1.2 1 1.5 2.2 1.5 3.5 0 2.2-1.8 4-4.5 5z"/></svg>',
            c3: '<svg viewBox="0 0 24 24" fill="var(--color-purple)"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c2.8 0 5.3-1.3 7-3.3-4.4-.3-7.7-4-7.7-8.7 0-3.3 1.8-6.1 4.5-7.6-.9-.3-1.9-.4-2.8-.4z"/></svg>',
            c4: '<svg viewBox="0 0 24 24" fill="var(--color-magenta)"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
            c5: '<svg viewBox="0 0 24 24" fill="var(--success-color)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/></svg>',
            c6: '<svg viewBox="0 0 24 24" fill="white"><path d="M19 10h-5V5h-4v5H5v4h5v8h4v-8h5v-4z"/></svg>',
            c7: '<svg viewBox="0 0 24 24" fill="var(--color-cyan)"><path d="M20 9c0 1.1-.9 2-2 2h-3v3c0 1.1-.9 2-2 2h-2v3c0 1.1-.9 2-2 2h-1c-.6 0-1-.4-1-1v-4c0-.6.4-1 1-1h1v-3c0-.6.4-1 1-1h2v-3c0-.6.4-1 1-1h3V6c0-1.1.9-2 2-2s2 .9 2 2v3zM8 7H6v2H4v2h2v2h2v-2h2V9H8V7z"/></svg>',
            c8: '<svg viewBox="0 0 24 24" fill="var(--gold-color)"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm-1-13h2v10h-2V7z"/></svg>',
            c9: '<svg viewBox="0 0 24 24" fill="var(--color-magenta)"><path d="M12 2c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm2-13h-4v2h4V7zm0 4h-4v2h4v-2zm-6 4h8v2H8v-2z"/></svg>'
        };

        function renderDailyComboGame(c) {
            let shuffled = Object.keys(comboSVGs).sort(() => Math.random() - 0.5);
            
            c.innerHTML = `
                <div class="game-sticky-header" style="position:sticky; top:0; z-index:100; display:flex; justify-content:space-between; align-items:center; background:rgba(15,23,42,0.9); backdrop-filter:blur(10px); padding:10px 15px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <button class="btn btn-secondary" onclick="closeGame()" style="width:auto; padding:5px 15px; font-size:0.9rem;"><i class="fa-solid fa-arrow-left"></i> Back to Hub</button>
                    <div style="font-weight:bold; color:var(--accent-color);"><i class="fa-solid fa-gem"></i> <span id="gameHeaderBal2">${currentUser.points}</span></div>
                </div>
                <div class="card cyber-card" style="padding:20px; text-align:center;">
                    <h2 style="color:var(--gold-color);"><i class="fa-solid fa-puzzle-piece"></i> Ethiopian Daily Combo</h2>
                    <p style="color:#94a3b8; font-size:0.9rem;">Drag the icons into the correct sequence. 3 tries/day!</p>
                    <p id="comboTriesTxt" style="color:var(--danger-color); font-weight:bold; margin-top:5px;"></p>
                    
                    <div id="comboBank" style="margin:20px auto; display:flex; flex-wrap:wrap; gap:10px; justify-content:center; min-height:60px; background:var(--glass-bg); border:1px solid var(--glass-border); padding:10px; border-radius:15px;" ondrop="comboDrop(event, 'bank')" ondragover="comboAllowDrop(event)">
                        ${shuffled.map(k => `<div id="${k}" class="combo-drag" draggable="true" ondragstart="comboDrag(event)" style="width:50px; height:50px; cursor:grab;">${comboSVGs[k]}</div>`).join('')}
                    </div>

                    <div id="comboSlots" style="margin:20px auto; display:grid; grid-template-columns:repeat(3, 80px); gap:10px; justify-content:center;">
                        ${[0,1,2,3,4,5,6,7,8].map(i => `<div class="combo-slot" id="slot-${i}" ondrop="comboDrop(event, 'slot-${i}')" ondragover="comboAllowDrop(event)" style="width:80px; height:80px; background:var(--glass-bg); border:1px dashed var(--glass-border); border-radius:15px; display:flex; justify-content:center; align-items:center;"></div>`).join('')}
                    </div>
                    
                    <button class="btn quantum-btn" onclick="checkComboPattern()">Check Pattern</button>
                </div>
            `;
            
            if (currentUser.comboTries !== undefined) {
                if(document.getElementById('comboTriesTxt')) document.getElementById('comboTriesTxt').innerText = `Tries left today: ${currentUser.comboTries}`;
            } else {
                if(document.getElementById('comboTriesTxt')) document.getElementById('comboTriesTxt').innerText = `Tries left today: 3`;
            }
        }

        function comboAllowDrop(ev) {
            ev.preventDefault();
        }

        function comboDrag(ev) {
            ev.dataTransfer.setData("text", ev.target.id);
        }

        function comboDrop(ev, targetId) {
            ev.preventDefault();
            var data = ev.dataTransfer.getData("text");
            var el = document.getElementById(data);
            if (!el) return;
            
            if (targetId === 'bank') {
                document.getElementById('comboBank').appendChild(el);
            } else {
                var slot = document.getElementById(targetId);
                // Ensure dropping happens strictly on the slot container, not an already placed SVG inside
                if(ev.target.classList.contains('combo-slot')) {
                    if (slot.children.length === 0) {
                        slot.appendChild(el);
                    } else {
                        document.getElementById('comboBank').appendChild(slot.children[0]);
                        slot.appendChild(el);
                    }
                } else if (ev.target.closest('.combo-slot')) {
                    // Swapping logic if dropped onto an existing child
                    const parentSlot = ev.target.closest('.combo-slot');
                    document.getElementById('comboBank').appendChild(parentSlot.children[0]);
                    parentSlot.appendChild(el);
                }
            }
        }

        async function checkComboPattern() {
            let pattern = [];
            for(let i=0; i<9; i++) {
                const slot = document.getElementById(`slot-${i}`);
                if(slot.children.length > 0) {
                    pattern.push(slot.children[0].id);
                }
            }
            if(pattern.length < 9) return showToast("Please fill all slots!", "error");
            
            const res = await fetch(`${API_BASE_URL}/api/combo`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId, combination: pattern })
            });
            const data = await res.json();
            
            if(!data.success) {
                showToast(data.msg, "error");
            } else if (data.isCorrect) {
                showToast(`COMBO CRACKED! You won ${data.reward} Gems!`, "success");
                currentUser.points += data.reward;
                currentUser.comboTries = 0;
                updateUI();
                if(document.getElementById('gameHeaderBal2')) document.getElementById('gameHeaderBal2').innerText = currentUser.points;
                if(document.getElementById('comboTriesTxt')) document.getElementById('comboTriesTxt').innerText = `Tries left today: 0`;
                confetti({ particleCount: 300, spread: 150 });
            } else {
                showToast("Incorrect pattern! You lost 1 try.", "error");
                currentUser.comboTries = data.triesLeft;
                if(document.getElementById('comboTriesTxt')) document.getElementById('comboTriesTxt').innerText = `Tries left today: ${data.triesLeft}`;
                // Flash red
                for(let i=0; i<9; i++) {
                    const slot = document.getElementById(`slot-${i}`);
                    slot.style.border = "2px solid var(--danger-color)";
                    setTimeout(() => slot.style.border = "1px dashed rgba(255,255,255,0.3)", 1000);
                }
            }
        }

        // ==========================================
        // PRO SPIN WHEEL
        // ==========================================
        function renderProSpinGame(c) {
            c.innerHTML = `
                <div class="game-sticky-header" style="position:sticky; top:0; z-index:100; display:flex; justify-content:space-between; align-items:center; background:rgba(15,23,42,0.9); backdrop-filter:blur(10px); padding:10px 15px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <button class="btn btn-secondary" onclick="closeGame()" style="width:auto; padding:5px 15px; font-size:0.9rem;"><i class="fa-solid fa-arrow-left"></i> Back to Hub</button>
                    <div style="font-weight:bold; color:var(--accent-color);"><i class="fa-solid fa-gem"></i> <span id="gameHeaderBal3">${currentUser.points}</span></div>
                </div>
                <div class="card cyber-card" style="padding:20px; text-align:center;">
                    <h2 style="color:var(--accent-color);"><i class="fa-solid fa-dharmachakra"></i> Pro Spin</h2>
                    <p style="color:#94a3b8; font-size:0.9rem;">Spin the wheel. 10 Gems per spin.</p>
                    <div style="position:relative; width:250px; height:250px; margin:30px auto;">
                        <div style="position:absolute; top:-20px; left:50%; transform:translateX(-50%); z-index:10; font-size:3rem; color:white; filter:drop-shadow(0 2px 5px rgba(0,0,0,0.5));"><i class="fa-solid fa-caret-down"></i></div>
                        <div id="spinWheel" style="position:relative; width:250px; height:250px; border-radius:50%; background:conic-gradient(#FF007A 0 72deg, #9D00FF 72deg 144deg, #00E1FF 144deg 216deg, #00FF7A 216deg 288deg, #FFAA00 288deg 360deg); transition: transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99); display:flex; justify-content:center; align-items:center; box-shadow: 0 0 20px rgba(0,0,0,0.5), inset 0 0 15px rgba(0,0,0,0.5);">
                            <!-- Slice Labels -->
                            <div style="position:absolute; width:100%; height:100%; top:0; left:0; pointer-events:none;">
                                <div style="position:absolute; top:15%; left:50%; transform:translate(-50%, 0) rotate(36deg); color:white; font-weight:bold; font-size:1.1rem; transform-origin: 50% 87.5px; text-shadow:1px 1px 2px black;">1000</div>
                                <div style="position:absolute; top:15%; left:50%; transform:translate(-50%, 0) rotate(108deg); color:white; font-weight:bold; font-size:1.1rem; transform-origin: 50% 87.5px; text-shadow:1px 1px 2px black;">500</div>
                                <div style="position:absolute; top:15%; left:50%; transform:translate(-50%, 0) rotate(180deg); color:white; font-weight:bold; font-size:1.1rem; transform-origin: 50% 87.5px; text-shadow:1px 1px 2px black;">200</div>
                                <div style="position:absolute; top:15%; left:50%; transform:translate(-50%, 0) rotate(252deg); color:white; font-weight:bold; font-size:1.1rem; transform-origin: 50% 87.5px; text-shadow:1px 1px 2px black;">50</div>
                                <div style="position:absolute; top:15%; left:50%; transform:translate(-50%, 0) rotate(324deg); color:white; font-weight:bold; font-size:1.1rem; transform-origin: 50% 87.5px; text-shadow:1px 1px 2px black;">10</div>
                            </div>
                            <div style="width:60px; height:60px; border-radius:50%; background:#1E293B; z-index:2; display:flex; justify-content:center; align-items:center; border:3px solid rgba(255,255,255,0.2);"><i class="fa-solid fa-gem" style="color:var(--color-cyan); font-size:1.5rem;"></i></div>
                        </div>
                    </div>
                    <button class="btn quantum-btn" onclick="spinWheelAction()">Spin (10 Gems)</button>
                </div>
            `;
            window.spinAngle = 0;
            window.isSpinning = false;
        }

        async function spinWheelAction() {
            if(window.isSpinning) return;
            if((currentUser.points || 0) < 10) return showToast("Not enough Gems", "error");
            
            window.isSpinning = true;
            
            try {
                const res = await fetch(`${API_BASE_URL}/api/spin`, {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({userId})
                });
                const data = await res.json();
                
                if(!data.success) {
                    window.isSpinning = false;
                    return showToast(data.error, "error");
                }
                
                // Deduct cost locally instantly
                currentUser.points -= 10;
                updateUI();
                if(document.getElementById('gameHeaderBal3')) document.getElementById('gameHeaderBal3').innerText = currentUser.points;

                // Determine target degree based on reward
                let targetDeg = 36; // Default to 10 slice
                if(data.reward == 1000) targetDeg = 324;
                else if(data.reward == 500) targetDeg = 252;
                else if(data.reward == 200) targetDeg = 180;
                else if(data.reward == 50) targetDeg = 108;
                else if(data.reward == 10) targetDeg = 36;
                else targetDeg = 108; // fallback to 50 for custom rigged amounts
                
                const currentMod = window.spinAngle % 360;
                let delta = targetDeg - currentMod;
                if (delta < 0) delta += 360;
                
                const spins = 5; // number of full rotations
                const totalDeg = (spins * 360) + delta;
                
                window.spinAngle += totalDeg;
                
                const wheel = document.getElementById('spinWheel');
                wheel.style.transform = `rotate(${window.spinAngle}deg)`;
                
                setTimeout(() => {
                    window.isSpinning = false;
                    showToast(`You won ${data.reward} Gems!`, "success");
                    currentUser.points = data.newBal;
                    updateUI();
                    if(document.getElementById('gameHeaderBal3')) document.getElementById('gameHeaderBal3').innerText = currentUser.points;
                    if(data.reward >= 50) confetti({ particleCount: 100, spread: 70 });
                }, 4000); // 4s matches transition duration
            } catch (e) {
                window.isSpinning = false;
                showToast("Network error", "error");
            }
        }

        // ==========================================
        // SCRATCH CARD
        // ==========================================
        function renderScratchCardGame(c) {
            c.innerHTML = `
                <div class="game-sticky-header" style="position:sticky; top:0; z-index:100; display:flex; justify-content:space-between; align-items:center; background:rgba(15,23,42,0.9); backdrop-filter:blur(10px); padding:10px 15px; border-bottom:1px solid rgba(255,255,255,0.1);">
                    <button class="btn btn-secondary" onclick="closeGame()" style="width:auto; padding:5px 15px; font-size:0.9rem;"><i class="fa-solid fa-arrow-left"></i> Back to Hub</button>
                    <div style="font-weight:bold; color:var(--accent-color);"><i class="fa-solid fa-gem"></i> <span id="gameHeaderBal4">${currentUser.points}</span></div>
                </div>
                <div class="card cyber-card" style="padding:20px; text-align:center;">
                    <h2 style="color:var(--success-color);"><i class="fa-solid fa-ticket"></i> Scratch Card</h2>
                    <p style="color:#94a3b8; font-size:0.9rem;">Cost: 50 Gems. Scrub to reveal your prize!</p>
                    
                    <div style="position:relative; width:280px; height:150px; margin:30px auto; border-radius:15px; overflow:hidden; background:var(--bg-color); box-shadow:0 10px 30px rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center;">
                        <div id="scratchRewardText" style="font-size:3rem; font-weight:bold; color:var(--gold-color); opacity:0; transition:0.3s;"><i class="fa-solid fa-gem"></i> <span id="sVal">0</span></div>
                        <canvas id="scratchCanvas" width="280" height="150" style="position:absolute; top:0; left:0; z-index:2; touch-action:none; opacity:1; transition:0.5s; cursor:pointer;"></canvas>
                    </div>

                    <button class="btn btn-secondary" id="buyScratchBtn" onclick="buyScratchCard()">Buy Card (50 Gems)</button>
                </div>
            `;
            
            initScratchCanvas();
            window.scratchActive = false;
        }

        function initScratchCanvas() {
            const canvas = document.getElementById('scratchCanvas');
            if(!canvas) return;
            const ctx = canvas.getContext('2d');
            
            // Fill with silver texture
            ctx.fillStyle = '#C0C0C0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add some noise/pattern for realism
            ctx.fillStyle = '#A9A9A9';
            for(let i=0; i<500; i++) {
                ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 2, 2);
            }
            ctx.font = '20px Arial';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'center';
            ctx.fillText('SCRATCH HERE', canvas.width/2, canvas.height/2);

            let isDrawing = false;
            
            function getBrushPos(xRef, yRef) {
                var canvasRect = canvas.getBoundingClientRect();
                return {
                  x: Math.floor((xRef - canvasRect.left) / (canvasRect.right - canvasRect.left) * canvas.width),
                  y: Math.floor((yRef - canvasRect.top) / (canvasRect.bottom - canvasRect.top) * canvas.height)
                };
            }

            function scratch(x, y) {
                if(!window.scratchActive) return;
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.arc(x, y, 20, 0, Math.PI * 2, false);
                ctx.fill();
                checkScratchProgress();
            }

            canvas.addEventListener('mousedown', (e) => { isDrawing = true; scratch(getBrushPos(e.clientX, e.clientY).x, getBrushPos(e.clientX, e.clientY).y); });
            canvas.addEventListener('mousemove', (e) => { if(isDrawing) scratch(getBrushPos(e.clientX, e.clientY).x, getBrushPos(e.clientX, e.clientY).y); });
            canvas.addEventListener('mouseup', () => { isDrawing = false; });
            canvas.addEventListener('mouseleave', () => { isDrawing = false; });

            canvas.addEventListener('touchstart', (e) => { isDrawing = true; const touch = e.touches[0]; scratch(getBrushPos(touch.clientX, touch.clientY).x, getBrushPos(touch.clientX, touch.clientY).y); });
            canvas.addEventListener('touchmove', (e) => { if(isDrawing){ e.preventDefault(); const touch = e.touches[0]; scratch(getBrushPos(touch.clientX, touch.clientY).x, getBrushPos(touch.clientX, touch.clientY).y); } }, {passive:false});
            canvas.addEventListener('touchend', () => { isDrawing = false; });
        }

        function checkScratchProgress() {
            if(!window.scratchActive) return;
            const canvas = document.getElementById('scratchCanvas');
            const ctx = canvas.getContext('2d');
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            let clearCount = 0;
            for (let i = 3; i < pixels.length; i += 4) {
                if (pixels[i] === 0) clearCount++;
            }
            const percent = (clearCount / (canvas.width * canvas.height)) * 100;
            if (percent > 40) {
                window.scratchActive = false;
                canvas.style.opacity = '0'; // fade out the rest
                setTimeout(() => {
                    showToast(`You won ${window.scratchRewardAmount} Gems!`, "success");
                    currentUser.points = window.scratchNewBal;
                    updateUI();
                    if(document.getElementById('gameHeaderBal4')) document.getElementById('gameHeaderBal4').innerText = currentUser.points;
                    confetti();
                    document.getElementById('buyScratchBtn').disabled = false;
                }, 500);
            }
        }

        async function buyScratchCard() {
            if((currentUser.points || 0) < 50) return showToast("Not enough Gems", "error");
            
            document.getElementById('buyScratchBtn').disabled = true;

            try {
                const res = await fetch(`${API_BASE_URL}/api/scratch`, {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({userId})
                });
                const data = await res.json();
                
                if(!data.success) {
                    document.getElementById('buyScratchBtn').disabled = false;
                    return showToast(data.error, "error");
                }
                
                // Deduct cost visually
                currentUser.points -= 50;
                updateUI();
                if(document.getElementById('gameHeaderBal4')) document.getElementById('gameHeaderBal4').innerText = currentUser.points;

                window.scratchRewardAmount = data.reward;
                window.scratchNewBal = data.newBal;
                if(document.getElementById('sVal')) document.getElementById('sVal').innerText = data.reward;
                document.getElementById('scratchRewardText').style.opacity = '1';
                
                // reset canvas
                const canvas = document.getElementById('scratchCanvas');
                canvas.style.opacity = '1';
                const ctx = canvas.getContext('2d');
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = '#C0C0C0';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#A9A9A9';
                for(let i=0; i<500; i++) {
                    ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 2, 2);
                }
                ctx.font = '20px Arial';
                ctx.fillStyle = '#666';
                ctx.textAlign = 'center';
                ctx.fillText('SCRATCH HERE', canvas.width/2, canvas.height/2);

                window.scratchActive = true;
                showToast("Card purchased! Start scratching.", "success");
            } catch(e) {
                document.getElementById('buyScratchBtn').disabled = false;
                showToast("Network error", "error");
            }
        }
    