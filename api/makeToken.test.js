import { makeToken, readToken } from './ads.js';
import crypto from 'crypto';

const REWARD_SECRET = process.env.ADS_REWARD_SECRET || 'MYFA-ADS-REWARD-ENGINE-2026';

let passed = 0;
let total = 0;

function assert(condition, message) {
    total++;
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    } else {
        passed++;
        console.log(`✅ PASSED: ${message}`);
    }
}

console.log("Starting makeToken tests...\n");

// Test 1: Should output a valid string
const data = { userId: "user123", network: "myfa" };
const token = makeToken(data);
assert(typeof token === 'string', 'makeToken should return a string');

// Test 2: Should have payload and signature separated by dot
assert(token.includes('.'), 'makeToken output should contain a dot separator');

// Test 3: Payload should be valid base64url encoded JSON
const [payloadStr, signatureStr] = token.split('.');
const decodedDataStr = Buffer.from(payloadStr, 'base64url').toString('utf8');
let decodedData;
try {
    decodedData = JSON.parse(decodedDataStr);
    assert(true, 'Payload should be parseable JSON');
} catch (e) {
    assert(false, 'Payload should be parseable JSON');
}
assert(decodedData.userId === data.userId && decodedData.network === data.network, 'Decoded payload should match input data');

// Test 4: Signature should be a valid SHA-256 HMAC
const expectedSignature = crypto.createHmac('sha256', REWARD_SECRET).update(payloadStr).digest('hex');
assert(signatureStr === expectedSignature, 'Signature should match expected HMAC with REWARD_SECRET');

// Test 5: Determinism
const token2 = makeToken(data);
assert(token === token2, 'makeToken should be deterministic for the same input');

// Test 6: Works with readToken
const parsed = readToken(token);
assert(parsed !== null && parsed.userId === data.userId && parsed.network === data.network, 'readToken should successfully parse and verify token');

// Test 7: Handles empty objects
const emptyToken = makeToken({});
const emptyParsed = readToken(emptyToken);
assert(emptyParsed !== null && Object.keys(emptyParsed).length === 0, 'Should correctly encode and decode an empty object');

console.log(`\nAll ${passed}/${total} tests passed successfully!`);
