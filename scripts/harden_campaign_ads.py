from pathlib import Path
import subprocess


def patch_index():
    p = Path('api/index.js')
    s = p.read_text()

    helper = r'''const cmDateTime = (v) => {
    const str = String(v ?? '').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const m = str.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    return m ? m[1] : null;
};
'''
    marker = 'const cmValidUrl ='
    if 'const cmDateTime =' not in s:
        s = s.replace(marker, helper + marker, 1)

    s = s.replace(
        'startDate: b.startDate || null, endDate: b.endDate || null, dailyBudget:',
        'startDate: cmDateTime(b.startDate), endDate: cmDateTime(b.endDate), dailyBudget:',
        1,
    )

    old = "patch[k] = ['dailyBudget','frequencyCap','autoPauseThreshold'].includes(k) ? cmNum(b[k]) : b[k];"
    new = "patch[k] = k === 'startDate' || k === 'endDate' ? cmDateTime(b[k]) : (['dailyBudget','frequencyCap','autoPauseThreshold'].includes(k) ? cmNum(b[k]) : b[k]);"
    if old in s:
        s = s.replace(old, new, 1)

    old = "status: c.archived ? 'archived' : (c.paused ? 'paused' : (c.status || 'active')),\n    budgetState: cmBudgetState(c),"
    new = "status: c.archived ? 'archived' : (c.paused ? 'paused' : (c.status || 'active')),\n    startDate: cmDateTime(c.startDate),\n    endDate: cmDateTime(c.endDate),\n    budgetState: cmBudgetState(c),"
    if old in s:
        s = s.replace(old, new, 1)

    start = s.find("app.post('/api/watch-ad'")
    end = s.find('// TASK 2: ADSGRAM S2S WEBHOOK', start)
    if start < 0 or end <= start:
        raise SystemExit('Unable to locate legacy /api/watch-ad route')

    secure = r'''const MYFA_AD_REWARD_SECRET = process.env.ADS_REWARD_SECRET;
if (!MYFA_AD_REWARD_SECRET) {
    throw new Error('FATAL: ADS_REWARD_SECRET environment variable is missing.');
}
const verifyLegacyAdToken = (token) => {
    try {
        const parts = String(token || '').split('.');
        if (parts.length !== 2) return null;
        const payload = parts[0], signature = parts[1];
        const expected = crypto.createHmac('sha256', MYFA_AD_REWARD_SECRET).update(payload).digest('hex');
        if (expected !== signature) return null;
        return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch { return null; }
};

app.post('/api/watch-ad', async (req, res) => {
    try {
        const body = req.body || {};
        const token = body.rewardToken || body.sessionToken || req.headers['x-myfa-ad-token'];
        const tokenData = verifyLegacyAdToken(token);
        const userId = String(body.userId || req.headers['x-telegram-user-id'] || req.query.userId || '');
        const network = String(body.network || tokenData?.network || 'monetag');
        if (!userId || !tokenData || String(tokenData.userId) !== userId || tokenData.network !== network) {
            return res.status(403).json({ success:false, error:'Real ad session required' });
        }
        if (tokenData.exp && Number(tokenData.exp) < Date.now()) return res.status(403).json({success:false,error:'Expired ad session'});

        const session = await dbGet(`adSessions/${userId}/${tokenData.sessionId}`);
        const u = await dbGet(`users/${userId}`);
        const c = (await dbGet('config')) || {};
        if (!u || !session || session.userId !== userId) return res.status(409).json({success:false,error:'Invalid ad session'});
        if (session.completed) return res.status(409).json({success:false,error:'Reward session already used'});

        const minElapsed = network === 'myfa' ? 5000 : 15000;
        if (Date.now() - Number(session.startedAt || 0) < minElapsed) return res.status(400).json({success:false,error:'Ad view not completed'});
        const providerResult = body.providerResult || {};
        if ((network === 'monetag' || network === 'adsgram') && providerResult.done !== true) return res.status(400).json({success:false,error:'Ad provider did not confirm completion'});
        if (network === 'adsterra' && providerResult.visited !== true) return res.status(400).json({success:false,error:'Premium ad visit was not confirmed'});

        const limit = network === 'monetag' ? Number(c.monetagLimit || 5) : network === 'adsgram' ? Number(c.adsgramLimit || 5) : network === 'adsterra' ? Number(c.adsterraLimit || 10) : Number(c.myfaAdsLimit || 10);
        const watched = network === 'monetag' ? Number(u.monetagWatchedToday || 0) : network === 'adsgram' ? Number(u.adsgramWatchedToday || 0) : network === 'adsterra' ? Number(u.adsterraWatchedToday || 0) : Number(u.myfaAdsWatchedToday || 0);
        if (watched >= limit) return res.status(429).json({success:false,error:'Daily limit reached'});

        let rewardCash = 0;
        let rewardGems = 0;
        if (network === 'myfa' && tokenData.campaignId) {
            const campaign = await dbGet(`campaigns/${tokenData.campaignId}`);
            if (!campaign || campaign.archived || campaign.paused || (campaign.status && campaign.status !== 'active')) return res.status(410).json({success:false,error:'Sponsored ad is no longer available'});
            const remaining = campaign.schemaVersion === 2 ? Number(campaign.budget?.reserved || 0) - Number(campaign.budget?.spent || 0) : Number(campaign.stuckBalance || 0);
            rewardGems = Number(campaign.reward || 0) || Number(c.myfaAdRewardGems || 50);
            if (remaining < rewardGems) return res.status(410).json({success:false,error:'Sponsored budget exhausted'});
            if (campaign.schemaVersion === 2) {
                await dbUpdate(`campaigns/${tokenData.campaignId}`, {
                    'budget/spent': Number(campaign.budget?.spent || 0) + rewardGems,
                    'budget/spentToday': Number(campaign.budget?.spentToday || 0) + rewardGems,
                    'analytics/impressions': Number(campaign.analytics?.impressions || 0) + 1
                });
                const owner = campaign.ownerId ? await dbGet(`users/${campaign.ownerId}`) : null;
                if (owner) await dbUpdate(`users/${campaign.ownerId}`, { stuckBalance: Math.max(0, Number(owner.stuckBalance || 0) - rewardGems) });
            } else {
                await dbUpdate(`campaigns/${tokenData.campaignId}`, {
                    stuckBalance: Math.max(0, Number(campaign.stuckBalance || 0) - rewardGems),
                    impressions: Number(campaign.impressions || 0) + 1,
                    views: Number(campaign.views || 0) + 1,
                    claims: Number(campaign.claims || 0) + 1
                });
            }
        } else {
            rewardCash = Number(c.realMoneyPerAd || 0.05);
        }

        const field = network === 'monetag' ? 'monetagWatchedToday' : network === 'adsgram' ? 'adsgramWatchedToday' : network === 'adsterra' ? 'adsterraWatchedToday' : 'myfaAdsWatchedToday';
        const updates = {
            [field]: watched + 1,
            realBalance: Number(u.realBalance || 0) + rewardCash,
            points: Number(u.points || 0) + rewardGems,
            totalAdsWatchedLifetime: Number(u.totalAdsWatchedLifetime || 0) + 1,
            logs: logAction(u, `Watched ${network} Ad (+${rewardGems} Gems${rewardCash ? ` / +$${rewardCash}` : ''})`)
        };
        await dbUpdate(`users/${userId}`, updates);
        await dbUpdate(`adSessions/${userId}/${tokenData.sessionId}`, {completed:true,completedAt:Date.now(),rewardCash,rewardGems});
        return res.json({success:true,added:rewardCash,gems:rewardGems,newPoints:updates.points,newBalance:updates.realBalance});
    } catch (e) {
        return res.status(500).json({success:false,error:'Reward processing failed'});
    }
});

'''
    s = s[:start] + secure + s[end:]
    p.write_text(s)


def patch_ads():
    p = Path('api/ads.js')
    s = p.read_text()
    old = "if (network === 'monetag' && !config.monetagZoneId)"
    new = "if (network === 'monetag' && !(config.monetagZoneId || process.env.MONETAG_ZONE_ID || '41731'))"
    if old in s:
        s = s.replace(old, new, 1)
    p.write_text(s)


patch_index()
patch_ads()
subprocess.run(['node', '--check', 'api/index.js'], check=True)
subprocess.run(['node', '--check', 'api/ads.js'], check=True)
print('campaign/ad hardening patch verified')
