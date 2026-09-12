import test, { mock, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';

let dbState = {};

global.fetch = mock.fn(async (url, options = {}) => {
  const baseUrl = 'https://besh-81e22-default-rtdb.firebaseio.com/';
  if (!url.startsWith(baseUrl)) return { ok: false, status: 404, statusText: 'Not Found' };

  // We expect URLs like https://besh-81e22-default-rtdb.firebaseio.com/promos.json
  let path = url.slice(baseUrl.length);
  if (path.endsWith('.json')) path = path.slice(0, -5);

  const method = options.method || 'GET';
  const parts = path.split('/').filter(Boolean).map((p) => decodeURIComponent(p));

  if (method === 'GET') {
    let current = dbState;
    for (const p of parts) {
      if (current !== null && current !== undefined && typeof current === 'object' && p in current) {
        current = current[p];
      } else {
        // Firebase returns null for missing paths instead of 404
        current = null;
        break;
      }
    }
    return { ok: true, status: 200, json: async () => { return current; } };
  } else if (method === 'PATCH') {
    const last = parts.pop();
    let current = dbState;
    for (const p of parts) {
      if (!(p in current) || typeof current[p] !== 'object') current[p] = {};
      current = current[p];
    }
    const data = options.body ? JSON.parse(options.body) : {};
    if (typeof current[last] === 'object' && current[last] !== null) {
       current[last] = { ...current[last], ...data };
    } else {
       current[last] = data;
    }
    return { ok: true, status: 200, json: async () => { return current[last]; } };
  }
  return { ok: false, status: 400, statusText: 'Bad Request' };
});

mock.module('node-fetch', {
  default: global.fetch
});

const { default: handler } = await import('../api/claim-promo.js');

function createRes() {
  const res = {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    }
  };
  return res;
}

describe('claim-promo.js', () => {
  beforeEach(() => {
    dbState = {
      users: {
        'user1': { points: 100, claimedPromos: [] },
        'user2': { points: 50, claimedPromos: ['USED'] }
      },
      promos: {
        'VALID1': { code: 'VALID1', reward: 50, maxUses: 10, uses: 0 },
        'USED': { code: 'USED', reward: 10, maxUses: 10, uses: 1 },
        'LIMIT': { code: 'LIMIT', reward: 100, maxUses: 1, uses: 1 },
        'ZERO': { code: 'ZERO', reward: 0, maxUses: 10, uses: 0 }
      }
    };
  });

  it('handles OPTIONS request', async () => {
    const req = { method: 'OPTIONS' };
    const res = createRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 204);
  });

  it('rejects non-POST methods', async () => {
    const req = { method: 'GET' };
    const res = createRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 405);
    assert.deepStrictEqual(res.body, { success: false, error: 'Method not allowed' });
  });

  it('rejects missing user or code', async () => {
    const req1 = { method: 'POST', body: { code: 'VALID1' } };
    const res1 = createRes();
    await handler(req1, res1);
    assert.strictEqual(res1.statusCode, 400);
    assert.deepStrictEqual(res1.body, { success: false, error: 'Missing user or promo code' });

    const req2 = { method: 'POST', body: { userId: 'user1' } };
    const res2 = createRes();
    await handler(req2, res2);
    assert.strictEqual(res2.statusCode, 400);
    assert.deepStrictEqual(res2.body, { success: false, error: 'Missing user or promo code' });
  });

  it('rejects if user not found', async () => {
    const req = { method: 'POST', body: { userId: 'nobody', code: 'VALID1' } };
    const res = createRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.deepStrictEqual(res.body, { success: false, error: 'User not found' });
  });

  it('rejects if promo not found', async () => {
    const req = { method: 'POST', body: { userId: 'user1', code: 'INVALID' } };
    const res = createRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 404);
    assert.deepStrictEqual(res.body, { success: false, error: 'Invalid Code' });
  });

  it('rejects if promo limit reached', async () => {
    const req = { method: 'POST', body: { userId: 'user1', code: 'LIMIT' } };
    const res = createRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.body, { success: false, error: 'Limit Reached' });
  });

  it('rejects if promo already claimed by user', async () => {
    const req = { method: 'POST', body: { userId: 'user2', code: 'USED' } };
    const res = createRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.body, { success: false, error: 'Already Claimed' });
  });

  it('rejects if promo reward is invalid', async () => {
    const req = { method: 'POST', body: { userId: 'user1', code: 'ZERO' } };
    const res = createRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(res.body, { success: false, error: 'Promo reward is invalid' });
  });

  it('successfully claims promo and updates state', async () => {
    const req = { method: 'POST', body: { userId: 'user1', code: 'VALID1' } };
    const res = createRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.reward, 50);
    assert.strictEqual(res.body.newBal, 150);
    assert.strictEqual(res.body.uses, 1);

    assert.strictEqual(dbState.users['user1'].points, 150);
    assert.ok(dbState.users['user1'].claimedPromos.includes('VALID1'));
    assert.strictEqual(dbState.promos['VALID1'].uses, 1);
  });

  it('successfully claims promo finding by iteration when not directly found', async () => {
    // The codebase uses iteration to handle case-insensitive key matching
    dbState.promos['valid2'] = { reward: 100, maxUses: 5, uses: 0 };

    const req = { method: 'POST', body: { userId: 'user1', code: 'VALID2' } };
    const res = createRes();
    await handler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.reward, 100);
    assert.strictEqual(res.body.newBal, 200);

    assert.strictEqual(dbState.promos['valid2'].uses, 1);
  });
});
