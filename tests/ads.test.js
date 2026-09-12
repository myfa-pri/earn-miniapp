import assert from 'assert';
import crypto from 'crypto';
import { readToken, makeToken } from '../api/ads.js';

function runTests() {
  console.log("Running readToken tests...");

  // 1. Missing or empty token
  assert.strictEqual(readToken(null), null, "Should return null for null token");
  assert.strictEqual(readToken(undefined), null, "Should return null for undefined token");
  assert.strictEqual(readToken(''), null, "Should return null for empty token");

  // 2. Token without dot
  assert.strictEqual(readToken('invalidtokenformat'), null, "Should return null for token without dot");

  // 3. Invalid signature
  const validData = { userId: "user123", network: "myfa" };
  const validTokenStr = makeToken(validData);
  const [validPayload, validSig] = validTokenStr.split('.');

  const tokenWithInvalidSig = `${validPayload}.invalidSignature123`;
  assert.strictEqual(readToken(tokenWithInvalidSig), null, "Should return null for invalid signature");

  // 4. Malformed JSON payload
  const malformedPayload = Buffer.from('{"userId":"user123", missingQuotes: }').toString('base64url');

  // to get valid signature we need REWARD_SECRET
  const REWARD_SECRET = process.env.ADS_REWARD_SECRET || 'MYFA-ADS-REWARD-ENGINE-2026';
  const malformedSig = crypto.createHmac('sha256', REWARD_SECRET).update(malformedPayload).digest('hex');
  const tokenWithMalformedJson = `${malformedPayload}.${malformedSig}`;
  assert.strictEqual(readToken(tokenWithMalformedJson), null, "Should return null for malformed JSON payload");

  // 5. Valid token
  const decoded = readToken(validTokenStr);
  assert.notStrictEqual(decoded, null, "Should return object for valid token");
  assert.strictEqual(decoded.userId, "user123", "Should correctly decode valid token");

  console.log("All readToken tests passed!");
}

runTests();
