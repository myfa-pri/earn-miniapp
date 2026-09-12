import test from 'node:test';
import assert from 'node:assert';
import { sign, verifyAdminSession } from './admin-gateway.js';

test('verifyAdminSession testing', async (t) => {
  await t.test('valid token passes', () => {
    const payloadData = {
      sub: 'admin',
      exp: Date.now() + 100000 // expires in the future
    };
    const payloadStr = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
    const signature = sign(payloadStr);
    const token = `${payloadStr}.${signature}`;

    assert.strictEqual(verifyAdminSession(token), true);
  });

  await t.test('expired token fails', () => {
    const payloadData = {
      sub: 'admin',
      exp: Date.now() - 1000 // expired in the past
    };
    const payloadStr = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
    const signature = sign(payloadStr);
    const token = `${payloadStr}.${signature}`;

    assert.strictEqual(verifyAdminSession(token), false);
  });

  await t.test('wrong subject (sub) fails', () => {
    const payloadData = {
      sub: 'not_admin',
      exp: Date.now() + 100000
    };
    const payloadStr = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
    const signature = sign(payloadStr);
    const token = `${payloadStr}.${signature}`;

    assert.strictEqual(verifyAdminSession(token), false);
  });

  await t.test('invalid signature fails', () => {
    const payloadData = {
      sub: 'admin',
      exp: Date.now() + 100000
    };
    const payloadStr = Buffer.from(JSON.stringify(payloadData)).toString('base64url');
    const token = `${payloadStr}.invalidsignature123`;

    assert.strictEqual(verifyAdminSession(token), false);
  });

  await t.test('empty token fails', () => {
    assert.strictEqual(verifyAdminSession(''), false);
    assert.strictEqual(verifyAdminSession(null), false);
    assert.strictEqual(verifyAdminSession(undefined), false);
  });

  await t.test('malformed token fails', () => {
    assert.strictEqual(verifyAdminSession('justonestring'), false);
    assert.strictEqual(verifyAdminSession('.signatureonly'), false);
    assert.strictEqual(verifyAdminSession('payloadonly.'), false);
  });
});
