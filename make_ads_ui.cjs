const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

const adScript = `
        function renderAds(c) {
            c.innerHTML = \`
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
            \`;
        }

        window.switchAdTab = function(tab) {
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
`;

// Insert the new function before renderSettings
const splitTarget = "async function renderSettings(c) {";
if (html.includes(splitTarget)) {
    html = html.replace(splitTarget, adScript + "\n        " + splitTarget);
    fs.writeFileSync('public/index.html', html);
    console.log("Success");
} else {
    console.log("Failed to find split target");
}
