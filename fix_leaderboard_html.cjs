const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// Fix podium Html
const podiumRegex = /const realName = u\.accountName \|\| u\.username \|\| 'Anonymous';([\s\S]*?)podiumHtml \+= \`/m;
const matchPodium = html.match(podiumRegex);

if (matchPodium) {
    let newLogic = `const realName = u.accountName || u.username || 'Anonymous';
                        const fbUrl = \`https://ui-avatars.com/api/?name=\${encodeURIComponent(realName)}&background=B026FF&color=fff\`;
                        const avatarUrl = u.id ? \`\${API_BASE_URL}/api/avatar/\${u.id}\` : fbUrl;
                        
                        const nameColor = u.usernameColor ? \`color: \${u.usernameColor} !important;\` : '';
                        const badge = u.titleBadge && u.titleBadge !== 'None' ? \`<span style="font-size:0.6rem; background:rgba(255,255,255,0.2); padding:2px 5px; border-radius:4px; margin-right:3px;">\${u.titleBadge}</span>\` : '';
                        
                        podiumHtml += \``;
    
    html = html.replace(podiumRegex, newLogic);
    
    // Inject into the actual HTML string for podium
    html = html.replace(/<div class="podium-name">\$\{realName\}<\/div>/, `<div class="podium-name" style="\${nameColor}">\${badge}\${realName}</div>`);
}

// Fix list Html
const listRegex = /const realName = u\.accountName \|\| u\.username \|\| 'Anonymous';([\s\S]*?)listHtml \+= \`/m;
const matchList = html.match(listRegex);

if (matchList) {
    let newLogic2 = `const realName = u.accountName || u.username || 'Anonymous';
                    const fbUrl = \`https://ui-avatars.com/api/?name=\${encodeURIComponent(realName)}&background=B026FF&color=fff\`;
                    const avatarUrl = u.id ? \`\${API_BASE_URL}/api/avatar/\${u.id}\` : fbUrl;
                    
                    const nameColor = u.usernameColor ? \`color: \${u.usernameColor} !important;\` : '';
                    const badge = u.titleBadge && u.titleBadge !== 'None' ? \`<span style="font-size:0.6rem; background:rgba(255,255,255,0.2); padding:2px 5px; border-radius:4px; margin-right:3px;">\${u.titleBadge}</span>\` : '';
                    
                    listHtml += \``;
                    
    html = html.replace(listRegex, newLogic2);
    
    // Inject into list HTML
    html = html.replace(/<div class="lb-name">\$\{realName\}<\/div>/, `<div class="lb-name" style="\${nameColor}">\${badge}\${realName}</div>`);
}

fs.writeFileSync('public/index.html', html);
console.log("Leaderboard HTML updated for colors and badges!");
