import crypto from 'crypto';

const TTL_MS = 12 * 60 * 60 * 1000;

function getConfig() {
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const SESSION_KEY = process.env.ADMIN_SESSION_KEY;

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD || !SESSION_KEY) {
    throw new Error('FATAL: Admin credentials and session key must be configured securely without defaults');
  }

  return { ADMIN_USERNAME, ADMIN_PASSWORD, SESSION_KEY };
}

function sign(value, sessionKey) {
  return crypto.createHmac('sha256', sessionKey).update(value).digest('base64url');
}

function issueToken(username, sessionKey) {
  const payload = Buffer.from(JSON.stringify({ sub: username, exp: Date.now() + TTL_MS }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload, sessionKey)}`;
}

function verifyToken(token, adminUsername, sessionKey) {
  try {
    const [payload, signature] = String(token || '').split('.');
    if (!payload || !signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload, sessionKey)))) return false;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data?.sub === adminUsername && Number(data.exp) > Date.now();
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

  let config;
  try {
    config = getConfig();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: 'Internal Server Error: Missing Configuration' });
  }

  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { action = 'login', username, password, token } = req.body || {};
  if (action === 'verify') return res.json({ success: verifyToken(token, config.ADMIN_USERNAME, config.SESSION_KEY) });

  if (action !== 'login') return res.status(400).json({ success: false, error: 'Unsupported auth action' });
  if (String(username || '') !== config.ADMIN_USERNAME || String(password || '') !== config.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const adminToken = issueToken(config.ADMIN_USERNAME, config.SESSION_KEY);
  return res.json({ success: true, token: adminToken, expiresIn: TTL_MS });
}
