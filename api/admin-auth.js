import crypto from 'crypto';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';
const SESSION_KEY = 'myfa-admin-session-v1-2026';
const TTL_MS = 12 * 60 * 60 * 1000;

function sign(value) {
  return crypto.createHmac('sha256', SESSION_KEY).update(value).digest('base64url');
}

function issueToken(username) {
  const payload = Buffer.from(JSON.stringify({ sub: username, exp: Date.now() + TTL_MS }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  try {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload)))) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data?.sub === ADMIN_USERNAME && Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { action = 'login', username, password, token } = req.body || {};
  if (action === 'verify') return res.json({ success: verifyToken(token) });

  if (action !== 'login') return res.status(400).json({ success: false, error: 'Unsupported auth action' });
  if (String(username || '') !== ADMIN_USERNAME || String(password || '') !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const adminToken = issueToken(ADMIN_USERNAME);
  return res.json({ success: true, token: adminToken, expiresIn: TTL_MS });
}
