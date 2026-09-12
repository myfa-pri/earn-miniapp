import crypto from 'crypto';
import fetch from 'node-fetch';

const DB_URL = 'https://besh-81e22-default-rtdb.firebaseio.com';
const REWARD_SECRET = process.env.ADS_REWARD_SECRET || 'MYFA-ADS-REWARD-ENGINE-2026';
const SESSION_TTL_MS = 90 * 1000;
const HISTORY_LIMIT = 50;

async function db(path, method = 'GET', data) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const opts = { method, headers: { 'content-type': 'application/json' }, signal: controller.signal };
    if (data !== undefined) opts.body = JSON.stringify(data);
    const r = await fetch(`${DB_URL}/${path}.json`, opts);
    if (!r.ok) throw new Error(`database ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}
const get = p => db(p, 'GET');
const set = (p, v) => db(p, 'PUT', v);
const update = (p, v) => db(p, 'PATCH', v);

function json(res, code, body) { res.status(code).json(body); }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function sign(payload) {
  return crypto.createHmac('sha256', REWARD_SECRET).update(payload).digest('hex');
}
function makeToken(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
function readToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  if (sign(payload) !== sig) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
}
function cleanHistory(history) {
  return Array.isArray(history) ? history.slice(-HISTORY_LIMIT) : [];
}
function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function providerLimit(config, network) {
  if (network === 'monetag') return safeNumber(config.monetagLimit, 5);
  if (network === 'adsgram') return safeNumber(config.adsgramLimit, 5);
  if (network === 'adsterra') return safeNumber(config.adsterraLimit, 10);
  return safeNumber(config.myfaAdsLimit, 10);
}
function watchedFor(user, network) {
  if (network === 'monetag') return safeNumber(user.monetagWatchedToday);
  if (network === 'adsgram') return safeNumber(user.adsgramWatchedToday);
  if (network === 'adsterra') return safeNumber(user.adsterraWatchedToday);
  return safeNumber(user.myfaAdsWatchedToday);
}

async function loadCampaign(userId, ua = '') {
  const campaigns = await get('campaigns') || {};
  const now = Date.now();
  const candidates = Object.values(campaigns).filter(c => {
    const owner = c.ownerId || c.userId;
    if (!owner || owner === userId) return false;
    if (c.schemaVersion === 2) {
      if (c.delivery?.status !== 'Running') return false;
      const remaining = c.schemaVersion === 2 ? safeNumber(c.adBudgetRemaining) : (safeNumber(c.budget?.reserved) - safeNumber(c.budget?.spent));
      if (remaining <= 0) return false;
      if (c.budget?.daily && safeNumber(c.budget?.spentToday) >= safeNumber(c.budget.daily)) return false;
      if (c.targeting?.device && c.targeting.device !== 'all') {
        const mobile = /android|iphone|ipad|ipod/i.test(ua);
        if (c.targeting.device === 'web' && mobile) return false;
        if (c.targeting.device === 'android' && !/android/i.test(ua)) return false;
        if (c.targeting.device === 'ios' && !/iphone|ipad|ipod/i.test(ua)) return false;
      }
      if ((c.targeting?.excludedIds || '').split(',').map(s => s.trim()).includes(userId)) return false;
      return true;
    }
    if (c.status && c.status !== 'active') return false;
    if (c.paused) return false;
    if (safeNumber(c.stuckBalance) <= 0) return false;
    if (c.startDate && now < new Date(c.startDate).getTime()) return false;
    if (c.endDate && now > new Date(c.endDate).getTime()) return false;
    if ((c.excludedIds || '').split(',').map(s => s.trim()).includes(userId)) return false;
    return true;
  });
  if (!candidates.length) return null;
  const campaign = candidates[Math.floor(Math.random() * candidates.length)];
  return campaign;
}

export { makeToken, sign, readToken };
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const action = req.query.action || (req.method === 'GET' ? 'stats' : 'start');

    if (action === 'stats') {
      const userId = String(req.query.userId || '');
      if (!userId) return json(res, 400, { success: false, error: 'Missing userId' });
      const user = await get(`users/${userId}`);
      if (!user) return json(res, 404, { success: false, error: 'User not found' });
      const config = await get('config') || {};
      const today = todayKey();
      const history = cleanHistory(user.adRewardHistory).filter(x => x.day === today);
      const network = ['monetag', 'adsgram', 'adsterra', 'myfa'];
      const counts = Object.fromEntries(network.map(n => [n, watchedFor(user, n)]));
      const limits = Object.fromEntries(network.map(n => [n, providerLimit(config, n)]));
      const cashToday = history.reduce((s, x) => s + safeNumber(x.cash), 0);
      const gemsToday = history.reduce((s, x) => s + safeNumber(x.gems), 0);
      return json(res, 200, {
        success: true,
        balance: { gems: safeNumber(user.points), cash: safeNumber(user.realBalance) },
        today: { key: today, cash: cashToday, gems: gemsToday, total: history.length },
        counts, limits,
        lifetime: safeNumber(user.totalAdsWatchedLifetime),
        history: cleanHistory(user.adRewardHistory).reverse(),
        config: {
          realMoneyPerAd: safeNumber(config.realMoneyPerAd, 0.05),
          myfaRewardGems: safeNumber(config.myfaAdRewardGems, 50),
          minWatchSeconds: safeNumber(config.myfaAdWatchSeconds, 10)
        }
      });
    }

    if (action === 'inventory') {
      const userId = String(req.query.userId || '');
      const user = await get(`users/${userId}`);
      if (!user) return json(res, 404, { success: false, error: 'User not found' });
      const campaign = await loadCampaign(userId, req.headers['user-agent'] || '');
      if (!campaign) return json(res, 200, { success: true, available: false });
      return json(res, 200, { success: true, available: true, ad: {
        id: campaign.id,
        title: campaign.name || campaign.creative?.headline || 'MYFA Sponsored Ad',
        description: campaign.desc || campaign.creative?.description || '',
        imageUrl: campaign.imageUrl || campaign.creative?.mediaUrl || '',
        link: campaign.link || campaign.creative?.destinationUrl || '',
        format: campaign.creative?.format || 'image'
      }});
    }

    if (action === 'start') {
      const body = req.body || {};
      const userId = String(body.userId || '');
      const network = String(body.network || 'myfa');
      if (!userId) return json(res, 400, { success: false, error: 'Missing userId' });
      const user = await get(`users/${userId}`);
      if (!user) return json(res, 404, { success: false, error: 'User not found' });
      const config = await get('config') || {};
      const today = todayKey();
      if (network === 'monetag' && !(config.monetagZoneId || process.env.MONETAG_ZONE_ID || '11759807')) return json(res, 503, { success: false, error: 'Monetag is not configured' });
      if (network === 'adsgram' && !config.adsgramBlockId) return json(res, 503, { success: false, error: 'Adsgram is not configured' });
      if (network === 'adsterra' && !config.adsterraLink) return json(res, 503, { success: false, error: 'Premium Ads are not configured' });
      const limit = providerLimit(config, network);
      const watched = watchedFor(user, network);
      if (watched >= limit) return json(res, 429, { success: false, error: 'Daily limit reached', watched, limit });

      const recent = cleanHistory(user.adRewardHistory).filter(x => x.day === today && (Date.now() - safeNumber(x.at)) < 60 * 60 * 1000);
      if (recent.length >= safeNumber(config.adsPerHourLimit, 3)) return json(res, 429, { success: false, error: 'Hourly ad limit reached' });

      let campaign = null;
      if (network === 'myfa') campaign = await loadCampaign(userId, req.headers['user-agent'] || '');
      const now = Date.now();
      const sessionId = crypto.randomUUID();
      await set(`adSessions/${userId}/${sessionId}`, {
        userId, network, campaignId: campaign?.id || null, startedAt: now, expiresAt: now + SESSION_TTL_MS, completed: false
      });
      const token = makeToken({ userId, network, campaignId: campaign?.id || null, sessionId, exp: now + SESSION_TTL_MS });
      return json(res, 200, {
        success: true, token, network, campaign: campaign ? {
          id: campaign.id,
          title: campaign.name || campaign.creative?.headline || 'MYFA Sponsored Ad',
          description: campaign.desc || campaign.creative?.description || '',
          imageUrl: campaign.imageUrl || campaign.creative?.mediaUrl || '',
          link: campaign.link || campaign.creative?.destinationUrl || '',
          format: campaign.creative?.format || 'image'
        } : null,
        rewardPreview: network === 'myfa' ? { gems: safeNumber(config.myfaAdRewardGems, 50), cash: 0 } : { gems: 0, cash: safeNumber(config.realMoneyPerAd, 0.05) },
        minSeconds: network === 'myfa' ? safeNumber(config.myfaAdWatchSeconds, 10) : 0
      });
    }

    if (action === 'complete') {
      const body = req.body || {};
      const data = readToken(String(body.token || ''));
      if (!data || data.exp < Date.now()) return json(res, 403, { success: false, error: 'Expired reward session' });
      const userId = String(data.userId);
      const user = await get(`users/${userId}`);
      const session = await get(`adSessions/${userId}/${data.sessionId}`);
      if (!user || !session || session.completed || session.userId !== userId) return json(res, 409, { success: false, error: 'Reward session already used' });
      const minimumElapsed = data.network === 'myfa' ? 5000 : 5000;
      if (Date.now() - safeNumber(session.startedAt) < minimumElapsed) return json(res, 400, { success: false, error: 'Ad view not completed' });

      const config = await get('config') || {};
      const limit = providerLimit(config, data.network);
      const watched = watchedFor(user, data.network);
      if (watched >= limit) return json(res, 429, { success: false, error: 'Daily limit reached' });

      const providerResult = req.body?.providerResult || {};
      if (data.network === 'monetag' || data.network === 'adsgram') {
        if (providerResult.done !== true || providerResult.error === true) {
          return json(res, 400, { success: false, error: 'Ad provider did not confirm a completed reward view' });
        }
      }
      if (data.network === 'adsterra' && providerResult.visited !== true) {
        return json(res, 400, { success: false, error: 'Premium ad visit was not confirmed' });
      }

      let rewardCash = 0;
      let rewardGems = 0;
      const updates = {};
      if (data.network === 'myfa') {
        const campaign = data.campaignId ? await get(`campaigns/${data.campaignId}`) : null;
        if (!campaign || (campaign.status && campaign.status !== 'active') || campaign.paused) return json(res, 410, { success: false, error: 'Sponsored ad is no longer available' });
        if (safeNumber(campaign.stuckBalance) <= 0 && campaign.schemaVersion !== 2) return json(res, 410, { success: false, error: 'Sponsored budget exhausted' });
        rewardGems = safeNumber(campaign.reward, safeNumber(config.myfaAdRewardGems, 50));
        if (campaign.schemaVersion === 2) rewardGems = safeNumber(config.myfaAdRewardGems, 50);
        if (campaign.schemaVersion === 2) {
          const remaining = safeNumber(campaign.adBudgetRemaining);
          if (remaining < rewardGems) return json(res, 410, { success: false, error: 'Sponsored budget exhausted' });
          const nextRemaining = remaining - rewardGems;
          await update(`campaigns/${data.campaignId}`, {
            adBudgetRemaining: nextRemaining,
            budgetRemaining: Math.max(0, safeNumber(campaign.budgetRemaining) - rewardGems),
            escrowReserved: Math.max(0, safeNumber(campaign.budgetRemaining) - rewardGems),
            adSpend: safeNumber(campaign.adSpend) + rewardGems,
            claims: safeNumber(campaign.claims) + 1,
            conversions: safeNumber(campaign.conversions) + 1,
            'analytics/impressions': safeNumber(campaign.analytics?.impressions) + 1,
            'analytics/conversions': safeNumber(campaign.analytics?.conversions) + 1
          });
          if (campaign.ownerId) {
            const owner = await get(`users/${campaign.ownerId}`);
            if (owner) {
              await update(`users/${campaign.ownerId}`, {
                campaignReserved: Math.max(0, safeNumber(owner.campaignReserved) - rewardGems)
              });
            }
          }
        } else {
          await update(`campaigns/${data.campaignId}`, {
            stuckBalance: Math.max(0, safeNumber(campaign.stuckBalance) - rewardGems),
            impressions: safeNumber(campaign.impressions) + 1,
            views: safeNumber(campaign.views) + 1,
            claims: safeNumber(campaign.claims) + 1
          });
        }
      } else {
        rewardCash = safeNumber(config.realMoneyPerAd, 0.05);
      }

      const field = data.network === 'monetag' ? 'monetagWatchedToday' : data.network === 'adsgram' ? 'adsgramWatchedToday' : data.network === 'adsterra' ? 'adsterraWatchedToday' : 'myfaAdsWatchedToday';
      updates[field] = watched + 1;
      updates.realBalance = safeNumber(user.realBalance) + rewardCash;
      updates.points = safeNumber(user.points) + rewardGems;
      updates.totalAdsWatchedLifetime = safeNumber(user.totalAdsWatchedLifetime) + 1;
      const entry = {
        id: data.sessionId, day: todayKey(), at: Date.now(), network: data.network,
        campaignId: data.campaignId || null, cash: rewardCash, gems: rewardGems
      };
      updates.adRewardHistory = [...cleanHistory(user.adRewardHistory), entry].slice(-HISTORY_LIMIT);
      updates.logs = [...(Array.isArray(user.logs) ? user.logs : []).slice(-29), `[${new Date().toISOString()}] Watched ${data.network} ad (+${rewardGems} Gems${rewardCash ? ` / +$${rewardCash.toFixed(4)}` : ''})`];
      await update(`users/${userId}`, updates);
      await update(`adSessions/${userId}/${data.sessionId}`, { completed: true, completedAt: Date.now(), rewardCash, rewardGems });
      return json(res, 200, { success: true, reward: { cash: rewardCash, gems: rewardGems }, newBalance: { cash: updates.realBalance, gems: updates.points } });
    }

    return json(res, 404, { success: false, error: 'Unknown ads action' });
  } catch (e) {
    console.error('[ads.js]', e);
    return json(res, 500, { success: false, error: 'Ads service error' });
  }
}
