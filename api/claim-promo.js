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

export function cleanCode(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizePromo(promo) {
  if (!promo || typeof promo !== 'object') return null;
  return {
    code: cleanCode(promo.code),
    reward: Number(promo.reward || 0),
    maxUses: Number(promo.maxUses ?? promo.limit ?? 0),
    uses: Number(promo.uses || 0)
  };
}

async function findPromo(rawCode) {
  const wanted = cleanCode(rawCode);
  if (!wanted) return null;

  const direct = await get(`promos/${encodeURIComponent(wanted)}`).catch(() => null);
  if (direct) return { key: wanted, promo: normalizePromo({ ...direct, code: wanted }) };

  const all = await get('promos').catch(() => ({})) || {};
  for (const [key, value] of Object.entries(all)) {
    const normalized = normalizePromo({ ...value, code: key });
    if (normalized && normalized.code === wanted) return { key, promo: normalized };
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const userId = String(body.userId || '');
    const wantedCode = cleanCode(body.code);
    if (!userId || !wantedCode) return res.status(400).json({ success: false, error: 'Missing user or promo code' });

    const user = await get(`users/${userId}`);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const found = await findPromo(wantedCode);
    if (!found || !found.promo) return res.status(404).json({ success: false, error: 'Invalid Code' });

    const promo = found.promo;
    const maxUses = promo.maxUses > 0 ? promo.maxUses : 999999999;
    if (promo.uses >= maxUses) return res.status(400).json({ success: false, error: 'Limit Reached' });

    const claimed = Array.isArray(user.claimedPromos) ? user.claimedPromos : [];
    const alreadyClaimed = claimed.some(code => cleanCode(code) === wantedCode);
    if (alreadyClaimed) return res.status(400).json({ success: false, error: 'Already Claimed' });

    const reward = Math.max(0, Math.floor(promo.reward));
    if (reward <= 0) return res.status(400).json({ success: false, error: 'Promo reward is invalid' });

    const newPoints = Number(user.points || 0) + reward;
    const nextClaimed = [...claimed, wantedCode];

    await update(`users/${userId}`, {
      points: newPoints,
      claimedPromos: nextClaimed,
      logs: [...(Array.isArray(user.logs) ? user.logs : []).slice(-29), `[${new Date().toISOString()}] Redeemed promo code ${wantedCode} (+${reward} Gems)`]
    });

    await update(`promos/${found.key}`, { uses: promo.uses + 1 });

    return res.status(200).json({ success: true, code: wantedCode, reward, newBal: newPoints, uses: promo.uses + 1, maxUses });
  } catch (e) {
    console.error('[claim-promo.js]', e);
    return res.status(500).json({ success: false, error: 'Promo redemption failed' });
  }
}
