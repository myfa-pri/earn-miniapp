const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

const profileLogic = `
    async function updateProfileSetting(key, value) {
        try {
            currentUser[key] = value;
            await fetch(API_BASE_URL + '/api/profile/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId, updates: { [key]: value } })
            });
            showToast('Setting updated!', 'success');
        } catch(e) {
            showToast('Network Error', 'error');
        }
    }

    async function handleBurnGems() {
        try {
            const res = await fetch(API_BASE_URL + '/api/profile/burn', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId, amount: 100 })
            });
            const data = await res.json();
            if(data.success) {
                currentUser.points = data.newPoints;
                if(document.getElementById('headerBalance')) document.getElementById('headerBalance').innerText = currentUser.points;
                showToast('100 Gems Burned!', 'success');
            } else {
                showToast(data.error, 'error');
            }
        } catch(e) {
            showToast('Network Error', 'error');
        }
    }

    async function handlePanic() {
        try {
            await fetch(API_BASE_URL + '/api/profile/panic', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId })
            });
            showToast('All other sessions destroyed. You must re-login.', 'success');
            setTimeout(() => window.location.reload(), 2000);
        } catch(e) {
            showToast('Network Error', 'error');
        }
    }

    async function handleRevokeSessions() {
        try {
            await fetch(API_BASE_URL + '/api/profile/sessions', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId, action: 'revoke' })
            });
            showToast('Active sessions revoked.', 'success');
        } catch(e) {
            showToast('Network Error', 'error');
        }
    }
    
    function changeFiat(currency) {
        updateProfileSetting('fiatCurrency', currency);
        let rate = 1;
        if(currency === 'ETB') rate = 115;
        if(currency === 'EUR') rate = 0.92;
        if(currency === 'GBP') rate = 0.78;
        
        const realEls = document.querySelectorAll('.bal-real span, #pageHeaderRealBalance');
        realEls.forEach(el => {
            const val = currentUser.realBalance || 0;
            el.innerText = (val * rate).toFixed(2) + ' ' + currency;
        });
    }
    
    function changeAppIcon(icon) {
        updateProfileSetting('appIcon', icon);
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = (icon === 'gold') ? 'https://cdn-icons-png.flaticon.com/512/1036/1036814.png' : 'https://cdn-icons-png.flaticon.com/512/3233/3233483.png';
    }
    
    function changeTone(tone) {
        updateProfileSetting('notifTone', tone);
        const audioUrl = tone === 'Chime' ? 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' : 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3';
        let audio = document.getElementById('successAudio');
        if(!audio) {
            audio = document.createElement('audio');
            audio.id = 'successAudio';
            document.body.appendChild(audio);
        }
        audio.src = audioUrl;
        audio.play().catch(e=>{});
    }

    function toggleHaptic(checked) {
        soundEnabled = checked;
        localStorage.setItem('appSound', soundEnabled);
        if(checked && window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
    }
`;

html = html.replace('</script>\n</body>', profileLogic + '\n</script>\n</body>');

// Inject the real JS function calls into the modal UI
html = html.replace(`onclick="showToast('No other active sessions.', 'info')"`, `onclick="handleRevokeSessions()"`);
html = html.replace(`onchange="showToast('Color saved!', 'success')"`, `onchange="updateProfileSetting('usernameColor', this.value)"`);
html = html.replace(`[VIP]</option></select>`, `[VIP]</option></select>`).replace(/<select style="background:rgba\(0,0,0,0\.3\); border:1px solid rgba\(255,255,255,0\.1\); border-radius:5px; color:white; padding:5px;">/g, (match, offset, string) => {
    // Only target the specific ones by checking surrounding text, wait, simpler to just replace using specific substrings.
    return match;
});

// Since doing exact string replacements on the large HTML blob might be brittle, I will just rewrite the modal block specifically.

fs.writeFileSync('public/index.html', html);
console.log("Profile frontend logic injected!");
