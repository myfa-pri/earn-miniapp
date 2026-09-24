import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const code = fs.readFileSync(path.resolve(process.cwd(), 'api/ads.js'), 'utf8');
let cleanCodeStr = code.replace(/import .*? from .*?;/g, '').replace(/export default async function handler.*/s, '');
cleanCodeStr = `
const crypto = require('crypto');
${cleanCodeStr}
`;

function runInSandbox(expression) {
    const context = { require, result: null, Buffer, process: { env: {} } };
    vm.createContext(context);
    vm.runInContext(cleanCodeStr + '\nresult = (' + expression + ');', context);
    return context.result;
}

test('safeNumber tests', async (t) => {
    await t.test('valid number', () => {
        assert.strictEqual(runInSandbox('safeNumber(42)'), 42);
        assert.strictEqual(runInSandbox('safeNumber(-3.14)'), -3.14);
    });
    await t.test('string number', () => {
        assert.strictEqual(runInSandbox('safeNumber("100")'), 100);
        assert.strictEqual(runInSandbox('safeNumber("-50.5")'), -50.5);
    });
    await t.test('invalid inputs (fallback to 0)', () => {
        assert.strictEqual(runInSandbox('safeNumber("abc")'), 0);
        assert.strictEqual(runInSandbox('safeNumber(NaN)'), 0);
        assert.strictEqual(runInSandbox('safeNumber(Infinity)'), 0);
        assert.strictEqual(runInSandbox('safeNumber(-Infinity)'), 0);
        assert.strictEqual(runInSandbox('safeNumber(null)'), 0);
        assert.strictEqual(runInSandbox('safeNumber(undefined)'), 0);
    });
    await t.test('custom fallback', () => {
        assert.strictEqual(runInSandbox('safeNumber(NaN, 10)'), 10);
        assert.strictEqual(runInSandbox('safeNumber("abc", -1)'), -1);
    });
});

test('makeToken and readToken tests', async (t) => {
    await t.test('valid token loop', () => {
        const token = runInSandbox('makeToken({ test: 123 })');
        assert.ok(typeof token === 'string' && token.includes('.'));
        const decoded = runInSandbox(`readToken("${token}")`);
        assert.deepEqual(decoded, { test: 123 });
    });

    await t.test('malformed payload', () => {
        assert.strictEqual(runInSandbox('readToken("not.a.token")'), null);
        assert.strictEqual(runInSandbox('readToken("no_dots_here")'), null);
        assert.strictEqual(runInSandbox('readToken("")'), null);
        assert.strictEqual(runInSandbox('readToken(null)'), null);
        assert.strictEqual(runInSandbox('readToken(undefined)'), null);
    });

    await t.test('invalid signature', () => {
        const token = runInSandbox('makeToken({ test: 123 })');
        const [payload, sig] = token.split('.');
        const tamperedToken = `${payload}.invalid${sig}`;
        assert.strictEqual(runInSandbox(`readToken("${tamperedToken}")`), null);
    });

    await t.test('invalid base64 payload', () => {
        // Create a valid signature for an invalid base64 payload string
        const payload = 'not_base64!';
        const sig = runInSandbox(`sign("${payload}")`);
        assert.strictEqual(runInSandbox(`readToken("${payload}.${sig}")`), null);
    });
});
