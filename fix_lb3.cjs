const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

const regex = /let listHtml = '';\s*for \(let i = 3; i < top100\.length; i\+\+\) \{([\s\S]*?)listContainer\.innerHTML = listHtml;/m;

let match = html.match(regex);
if (match) {
    let fix = `let listHtml = '';
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
                listContainer.innerHTML = listHtml;`;
    
    html = html.replace(regex, fix);
    fs.writeFileSync('public/index.html', html);
    console.log("Successfully fixed the listHtml loop!");
} else {
    console.log("Regex not found");
}

