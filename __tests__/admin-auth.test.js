import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const code = fs.readFileSync(path.resolve(process.cwd(), 'api/admin-auth.js'), 'utf8');

// Strip out import and export logic for vm
let cleanCode = code.replace(/import .*? from .*?;/g, '');
cleanCode = cleanCode.replace(/export default async function handler.*/s, '');
cleanCode = `
const crypto = require('crypto');
${cleanCode}
verifyToken(tokenVar);
`;

function testVerify(tokenStr) {
    const context = { require, tokenVar: tokenStr, Buffer, process: { env: {} } };
    vm.createContext(context);
    return vm.runInContext(cleanCode, context);
}

test('verifyToken tests', async (t) => {
    // Generate valid token
    const crypto = require('crypto');
    const SESSION_KEY = 'myfa-admin-session-v1-2026';
    const ADMIN_USERNAME = 'admin';
    const sign = (val) => crypto.createHmac('sha256', SESSION_KEY).update(val).digest('base64url');

    await t.test('valid token', () => {
        const payload = Buffer.from(JSON.stringify({ sub: ADMIN_USERNAME, exp: Date.now() + 10000 }), 'utf8').toString('base64url');
        const validToken = `${payload}.${sign(payload)}`;
        assert.strictEqual(testVerify(validToken), true);
    });

    await t.test('invalid signature', () => {
        const payload = Buffer.from(JSON.stringify({ sub: ADMIN_USERNAME, exp: Date.now() + 10000 }), 'utf8').toString('base64url');
        const invalidToken = `${payload}.invalidsignature`;
        assert.strictEqual(testVerify(invalidToken), false);
    });

    await t.test('expired token', () => {
        const payload = Buffer.from(JSON.stringify({ sub: ADMIN_USERNAME, exp: Date.now() - 10000 }), 'utf8').toString('base64url');
        const expiredToken = `${payload}.${sign(payload)}`;
        assert.strictEqual(testVerify(expiredToken), false);
    });

    await t.test('malformed token', () => {
        assert.strictEqual(testVerify('malformed'), false);
        assert.strictEqual(testVerify(''), false);
        assert.strictEqual(testVerify(null), false);
        assert.strictEqual(testVerify(undefined), false);
    });

    await t.test('wrong username', () => {
        const payload = Buffer.from(JSON.stringify({ sub: 'hacker', exp: Date.now() + 10000 }), 'utf8').toString('base64url');
        const wrongUserToken = `${payload}.${sign(payload)}`;
        assert.strictEqual(testVerify(wrongUserToken), false);
    });
});
