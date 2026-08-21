const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

html = html.replace(`<div><b>3. Title Badges</b><div class="sub-text">Prefix display name</div></div><select style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px;">`, `<div><b>3. Title Badges</b><div class="sub-text">Prefix display name</div></div><select onchange="updateProfileSetting('titleBadge', this.value)" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px;">`);

html = html.replace(`<div><b>4. Stealth Mode</b><div class="sub-text">Hide from leaderboard</div></div><label class="switch"><input type="checkbox">`, `<div><b>4. Stealth Mode</b><div class="sub-text">Hide from leaderboard</div></div><label class="switch"><input type="checkbox" onchange="updateProfileSetting('stealthMode', this.checked)">`);

html = html.replace(`<div><b>5. Custom Tone</b><div class="sub-text">Notification sound</div></div><select style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px;">`, `<div><b>5. Custom Tone</b><div class="sub-text">Notification sound</div></div><select onchange="changeTone(this.value)" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px;">`);

html = html.replace(`<div><b>6. Auto-Claim Bonus</b><div class="sub-text">Claim daily on boot</div></div><label class="switch"><input type="checkbox">`, `<div><b>6. Auto-Claim Bonus</b><div class="sub-text">Claim daily on boot</div></div><label class="switch"><input type="checkbox" onchange="updateProfileSetting('autoClaim', this.checked)">`);

html = html.replace(`onclick="showToast('Sessions destroyed.', 'success')"`, `onclick="handlePanic()"`);

html = html.replace(`<div><b>8. 2FA Phrase</b><div class="sub-text">Secure recovery</div></div><input type="password" placeholder="6 digits" style="width:80px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px; text-align:center;">`, `<div><b>8. 2FA Phrase</b><div class="sub-text">Secure recovery</div></div><input type="password" placeholder="6 digits" onchange="updateProfileSetting('twoFactorPhrase', this.value)" style="width:80px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px; text-align:center;">`);

html = html.replace(`<div><b>9. Profile Bio</b><div class="sub-text">100 chars public bio</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;" onclick="showToast('Bio updated.', 'success')">`, `<div><b>9. Profile Bio</b><div class="sub-text">100 chars public bio</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;" onclick="updateProfileSetting('bio', prompt('Enter Bio:'))">`);

html = html.replace(`<div><b>10. Display Fiat</b><div class="sub-text">Currency conversion</div></div><select style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px;">`, `<div><b>10. Display Fiat</b><div class="sub-text">Currency conversion</div></div><select onchange="changeFiat(this.value)" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px;">`);

html = html.replace(`<div><b>11. Ghost Viewer</b><div class="sub-text">Anonymous browsing</div></div><label class="switch"><input type="checkbox">`, `<div><b>11. Ghost Viewer</b><div class="sub-text">Anonymous browsing</div></div><label class="switch"><input type="checkbox" onchange="updateProfileSetting('ghostViewer', this.checked)">`);

html = html.replace(`<div><b>12. Auto-Convert Gems</b><div class="sub-text">At 10,000 threshold</div></div><label class="switch"><input type="checkbox">`, `<div><b>12. Auto-Convert Gems</b><div class="sub-text">At 10,000 threshold</div></div><label class="switch"><input type="checkbox" onchange="updateProfileSetting('autoConvert', this.checked)">`);

html = html.replace(`<div><b>14. Tx Filter</b><div class="sub-text">History sorting</div></div><select style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px;">`, `<div><b>14. Tx Filter</b><div class="sub-text">History sorting</div></div><select onchange="updateProfileSetting('txFilter', this.value)" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px;">`);

html = html.replace(`onclick="showToast('100 Gems Burned!', 'success')"`, `onclick="handleBurnGems()"`);

html = html.replace(`<div><b>16. Pinned Task</b><div class="sub-text">Stick favorite to top</div></div><select style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px;">`, `<div><b>16. Pinned Task</b><div class="sub-text">Stick favorite to top</div></div><select onchange="updateProfileSetting('pinnedTask', this.value)" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); border-radius:5px; color:white; padding:5px;">`);

html = html.replace(`<div><b>17. Custom Icon</b><div class="sub-text">App shortcut icon</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;">`, `<div><b>17. Custom Icon</b><div class="sub-text">App shortcut icon</div></div><button class="btn btn-secondary" style="width:auto; padding:5px 15px;" onclick="changeAppIcon('gold')">`);

html = html.replace(`<div><b>18. Sound / Haptic</b><div class="sub-text">App feedback</div></div><label class="switch"><input type="checkbox" checked onchange="toggleSound()">`, `<div><b>18. Sound / Haptic</b><div class="sub-text">App feedback</div></div><label class="switch"><input type="checkbox" checked onchange="toggleHaptic(this.checked)">`);

fs.writeFileSync('public/index.html', html);
console.log("Modal bindings fixed.");
