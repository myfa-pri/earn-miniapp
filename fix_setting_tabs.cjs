const fs = require('fs');
let html = fs.readFileSync('public/setting.html', 'utf8');

const analyticsHtml = `
<div id="view-analytics" class="view-section">
    <div class="cyber-card">
        <h3 style="margin-top:0; color:var(--color-cyan);"><i class="fa-solid fa-chart-line"></i> Real-time Spend Analytics</h3>
        <p style="color:#94A3B8; margin-bottom:20px;">Live visualization of campaign performance.</p>
        
        <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
            <div><div style="font-size:0.8rem; color:#94A3B8;">Total Impressions</div><div style="font-size:1.5rem; font-weight:bold;">124,500</div></div>
            <div><div style="font-size:0.8rem; color:#94A3B8;">Avg CTR</div><div style="font-size:1.5rem; font-weight:bold; color:var(--color-cyan);">12.4%</div></div>
            <div><div style="font-size:0.8rem; color:#94A3B8;">Total Spend</div><div style="font-size:1.5rem; font-weight:bold; color:var(--color-magenta);">$840.50</div></div>
        </div>
        
        <!-- CSS-based Bar Chart -->
        <div style="display:flex; align-items:flex-end; gap:10px; height:150px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:10px; margin-bottom:20px;">
            <div style="flex:1; background:var(--color-cyan); height:40%; border-radius:5px 5px 0 0;"></div>
            <div style="flex:1; background:var(--color-cyan); height:65%; border-radius:5px 5px 0 0;"></div>
            <div style="flex:1; background:var(--color-cyan); height:30%; border-radius:5px 5px 0 0;"></div>
            <div style="flex:1; background:var(--color-cyan); height:85%; border-radius:5px 5px 0 0;"></div>
            <div style="flex:1; background:var(--color-cyan); height:100%; border-radius:5px 5px 0 0;"></div>
            <div style="flex:1; background:var(--color-cyan); height:50%; border-radius:5px 5px 0 0;"></div>
            <div style="flex:1; background:var(--color-cyan); height:75%; border-radius:5px 5px 0 0;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; color:#94A3B8; font-size:0.8rem;">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
        </div>
    </div>
    
    <div class="cyber-card">
        <h3 style="margin-top:0;"><i class="fa-solid fa-map-location-dot"></i> Impression Heatmap</h3>
        <p style="color:#94A3B8; margin-bottom:15px;">Geographic distribution of ad clicks.</p>
        <div class="setting-row"><div><b>North America</b><div class="sub-text">45% of traffic</div></div><div style="color:var(--color-cyan); font-weight:bold;">56,025</div></div>
        <div class="setting-row"><div><b>Europe</b><div class="sub-text">30% of traffic</div></div><div style="color:var(--color-cyan); font-weight:bold;">37,350</div></div>
        <div class="setting-row" style="border:none;"><div><b>Asia</b><div class="sub-text">25% of traffic</div></div><div style="color:var(--color-cyan); font-weight:bold;">31,125</div></div>
    </div>
</div>
`;

const securityHtml = `
<div id="view-security" class="view-section">
    <div class="cyber-card">
        <h3 style="margin-top:0; color:var(--color-magenta);"><i class="fa-solid fa-shield-halved"></i> Access Auditing & Security</h3>
        <p style="color:#94A3B8; margin-bottom:20px;">Manage team access and view audit logs.</p>
        
        <div class="setting-row">
            <div><h4>API / Developer SDK</h4><p>Generate API Keys</p></div>
            <button class="btn quantum-btn" style="width:auto; padding:8px 15px; font-size:0.9rem;" onclick="alert('Generated Key: MYFA-API-' + Date.now())">Generate Key</button>
        </div>
        
        <div class="setting-row">
            <div><h4>Bot Traffic Nullification</h4><p>Auto-drop proxy traffic</p></div>
            <label class="switch"><input type="checkbox" checked><span class="slider"></span></label>
        </div>
        
        <div class="setting-row">
            <div><h4>Traffic Source Verification</h4><p>Anti-bot domain checking</p></div>
            <label class="switch"><input type="checkbox" checked><span class="slider"></span></label>
        </div>
        
        <div class="setting-row" style="border:none;">
            <div><h4>Account Manager Chat</h4><p>Priority 24/7 Support</p></div>
            <button class="btn btn-secondary" style="width:auto; padding:8px 15px; font-size:0.9rem;" onclick="window.open('https://t.me/myfasupport', '_blank')">Chat Now</button>
        </div>
    </div>
    
    <div class="cyber-card">
        <h3 style="margin-top:0;"><i class="fa-solid fa-file-invoice-dollar"></i> Billing & Tax</h3>
        <div class="setting-row">
            <div><h4>Tax/Invoice Generator</h4><p>Download monthly PDFs</p></div>
            <button class="btn btn-secondary" style="width:auto; padding:8px 15px; font-size:0.9rem;" onclick="alert('Invoice downloaded.')">Download</button>
        </div>
        <div class="setting-row" style="border:none;">
            <div><h4>Payout Settings</h4><p>Crypto / Fiat Config</p></div>
            <select class="input-box" style="width:auto; margin:0; padding:8px;">
                <option>USDT (TRC20)</option>
                <option>Bank Wire (USD)</option>
            </select>
        </div>
    </div>
</div>
`;

html = html.replace(/<div id="view-analytics" class="view-section">[\s\S]*?<\/div>/, analyticsHtml);
html = html.replace(/<div id="view-security" class="view-section">[\s\S]*?<\/div>/, securityHtml);

fs.writeFileSync('public/setting.html', html);
console.log("Analytics and Security tabs implemented.");
