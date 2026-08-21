const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
const badStart = html.indexOf('function updateUI() {');
const showToastIndex = html.indexOf('function showToast', badStart);

const newUI = `
        function updateUI() {
            document.getElementById('pageHeaderName').textContent = currentUser.username;
            
            const isPriv = localStorage.getItem('set_priv') === 'true';
            const displayPoints = isPriv ? '****' : (currentUser.points || 0).toLocaleString();
            const displayReal = isPriv ? '****' : (currentUser.realBalance || 0).toFixed(2);
            
            if(document.getElementById('pageHeaderBalance')) document.getElementById('pageHeaderBalance').innerText = displayPoints;
            if(document.getElementById('pageHeaderRealBalance')) document.getElementById('pageHeaderRealBalance').innerText = displayReal;
            document.getElementById('pageHeaderStatus').innerHTML = currentUser.isVip ? '<i class="fa-solid fa-crown"></i> VIP' : 'Member';
            
            const avatarUrl = window.Telegram.WebApp.initDataUnsafe?.user?.photo_url || currentUser.avatarUrl || \`https://ui-avatars.com/api/?name=\${currentUser.username}&background=00F2FE&color=fff\`;
            document.getElementById('pageHeaderAvatar').style.backgroundImage = \`url('\${avatarUrl}')\`;
            
            if (localStorage.getItem('set_data') === 'true') {
                document.body.classList.add('data-saver');
            } else {
                document.body.classList.remove('data-saver');
            }
        }
        
        `;

html = html.substring(0, badStart) + newUI + html.substring(showToastIndex);
fs.writeFileSync('public/index.html', html);
