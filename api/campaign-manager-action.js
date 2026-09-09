const DB_URL = 'https://besh-81e22-default-rtdb.firebaseio.com';

async function db(path, method = 'GET', data) {
  const r = await fetch(`${DB_URL}/${path}.json`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data)
  });
  if (!r.ok) throw new Error(`database ${r.status}`);
  return r.json();
}

const get = path => db(path, 'GET');
const update = (path, value) => db(path, 'PATCH', value);
const remove = path => db(path, 'DELETE');

const ownerOf = c => String(c?.ownerId || c?.userId || '');
const n = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d;

function normalize(c, id) {
  const schema2 = Number(c?.schemaVersion) === 2;
  const adRemaining = Math.max(0, n(c?.adBudgetRemaining, schema2 ? 0 : n(c?.stuckBalance)));
  const taskRemaining = Math.max(0, n(c?.taskBudgetRemaining, schema2 ? 0 : 0));
  const totalRemaining = Math.max(0, n(c?.budgetRemaining, adRemaining + taskRemaining));
  const completed = totalRemaining <= 0;
  return {
    ...c,
    id: c?.id || id,
    ownerId: ownerOf(c),
    status: c?.archived ? 'archived' : (completed ? 'completed' : (c?.paused ? 'paused' : (c?.status || 'active'))),
    budgetState: {
      total: Math.max(0, n(c?.budgetTotal, typeof c?.budget === 'object' ? c.budget.total : c?.budget)),
      remaining: totalRemaining,
      ad: adRemaining,
      task: taskRemaining
    },
    impressions: n(c?.impressions || c?.views),
    clicks: n(c?.clicks || c?.adClicks),
    conversions: n(c?.conversions || c?.claims || c?.analytics?.conversions),
    spend: n(c?.adSpend) + n(c?.taskSpend)
  };
}

function audit(c, action, userId, meta = {}) {
  const logs = Array.isArray(c?.auditLog) ? [...c.auditLog] : [];
  logs.push({ timestamp: Date.now(), action, userId: String(userId), meta });
  return logs.slice(-100);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-User-ID');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const id = String(req.query?.id || '');
    const body = req.body || {};
    const userId = String(body.userId || req.headers['x-telegram-user-id'] || '');
    const action = String(body.action || '');
    if (!id || !userId) return res.status(400).json({ success: false, error: 'Missing campaign or user' });

    const campaign = await get(`campaigns/${id}`);
    if (!campaign || ownerOf(campaign) !== userId) {
      return res.status(404).json({ success: false, error: 'Campaign not found or not owned by this user' });
    }
    const user = await get(`users/${userId}`);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    if (action === 'remove' || action === 'liquidate' || action === 'refund' || action === 'archive') {
      if (campaign.archived || campaign.status === 'archived' || campaign.status === 'liquidated') {
        return res.status(400).json({ success: false, error: 'Campaign is already removed' });
      }

      let refund = 0;
      const schema2 = Number(campaign.schemaVersion) === 2;

      if (schema2) {
        // Refund only budget that is genuinely still available for delivery.
        // Already delivered ad/task rewards are represented by spend/conversions and are NOT returned.
        refund = Math.max(0,
          n(campaign.adBudgetRemaining) +
          n(campaign.taskBudgetRemaining)
        );
      } else if (campaign.mode === 'task' || campaign.mode === 'hybrid' || campaign.sponsoredTask) {
        const maxUsers = Math.max(0, Math.floor(n(campaign.maxUsers)));
        const claims = Math.max(0, Math.floor(n(campaign.claims)));
        const reward = Math.max(0, n(campaign.reward));
        refund = Math.max(0, (maxUsers - claims) * reward);
      } else {
        // Legacy advertisements keep their undelivered pool in stuckBalance.
        refund = Math.max(0, n(campaign.stuckBalance, n(campaign.budgetRemaining)));
      }

      const next = {
        ...campaign,
        paused: true,
        archived: true,
        status: 'archived',
        delivery: { ...(campaign.delivery || {}), status: 'Archived' },
        budgetRemaining: 0,
        escrowReserved: 0,
        adBudgetRemaining: 0,
        taskBudgetRemaining: 0,
        stuckBalance: 0,
        auditLog: audit(campaign, 'removed', userId, { refund, schemaVersion: campaign.schemaVersion || 1 })
          ,updatedAt: Date.now()
      };
      if (typeof next.budget === 'object') next.budget = { ...next.budget, remaining: 0, status: 'archived' };
      else if (!schema2) next.budget = 0;

      await update(`campaigns/${id}`, next);

      const newPoints = n(user.points) + refund;
      const newCampaignReserved = Math.max(0, n(user.campaignReserved) - refund);
      await update(`users/${userId}`, {
        points: newPoints,
        campaignReserved: newCampaignReserved,
        logs: [...(Array.isArray(user.logs) ? user.logs : []).slice(-29),
          `[${new Date().toISOString()}] Removed campaign ${campaign.name || id} (+${refund} Gems refunded from remaining undelivered budget)`]
      });

      const all = await get('campaigns') || {};
      const campaigns = Object.entries(all)
        .map(([cid, c]) => normalize(c, cid))
        .filter(c => ownerOf(c) === userId && !c.archived)
        .sort((a, b) => n(b.updatedAt || b.createdAt) - n(a.updatedAt || a.createdAt));

      return res.json({
        success: true,
        removed: true,
        refunded: refund,
        campaign: normalize(next, id),
        user: { ...user, points: newPoints, campaignReserved: newCampaignReserved },
        campaigns
      });
    }

    if (action === 'pause' || action === 'resume') {
      const paused = action === 'pause';
      const next = {
        ...campaign,
        paused,
        archived: false,
        status: paused ? 'paused' : 'active',
        delivery: { ...(campaign.delivery || {}), status: paused ? 'Paused' : 'Running' },
        auditLog: audit(campaign, action, userId),
        updatedAt: Date.now()
      };
      await update(`campaigns/${id}`, next);
      const all = await get('campaigns') || {};
      const campaigns = Object.entries(all).map(([cid, c]) => normalize(c, cid)).filter(c => ownerOf(c) === userId && !c.archived);
      return res.json({ success: true, campaign: normalize(next, id), user: { ...user }, campaigns });
    }

    return res.status(400).json({ success: false, error: 'Unknown campaign action' });
  } catch (e) {
    console.error('[campaign-manager-action]', e);
    return res.status(500).json({ success: false, error: 'Campaign action failed' });
  }
}
