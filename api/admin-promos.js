const DB_URL = 'https://besh-81e22-default-rtdb.firebaseio.com';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'Yichu123';

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
const set = (path, value) => db(path, 'PUT', value);
const update = (path, value) => db(path, 'PATCH', value);

function cleanCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const body = req.body || {};
    if (body.secret !== ADMIN_SECRET) return res.status(403).json({ success: false, error: 'Auth failed' });

    if (body.action !== 'create') return res.status(400).json({ success: false, error: 'Unsupported promo action' });

    const input = body.promo || {};
    const code = cleanCode(input.code);
    const reward = Math.floor(Number(input.reward || 0));
    const maxUses = Math.floor(Number(input.maxUses ?? input.limit ?? 0));

    if (!code || code.length < 2 || code.length > 64) return res.status(400).json({ success: false, error: 'Enter a valid promo code' });
    if (reward <= 0) return res.status(400).json({ success: false, error: 'Reward must be greater than zero' });
    if (maxUses <= 0) return res.status(400).json({ success: false, error: 'Usage limit must be greater than zero' });

    const promos = await get('promos') || {};
    const existing = Object.keys(promos).find(key => cleanCode(key) === code);
    if (existing) return res.status(409).json({ success: false, error: 'Promo code already exists' });

    const promo = {
      code,
      reward,
      maxUses,
      uses: 0,
      createdAt: Date.now()
    };

    await set(`promos/${code}`, promo);
    await update('stats', { lastPromoCreatedAt: Date.now() });

    return res.status(200).json({ success: true, promo });
  } catch (e) {
    console.error('[admin-promos.js]', e);
    return res.status(500).json({ success: false, error: 'Promo creation failed' });
  }
}
