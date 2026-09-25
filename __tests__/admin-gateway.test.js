import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const code = fs.readFileSync(path.resolve(process.cwd(), 'api/admin-gateway.js'), 'utf8');

// Strip out import and export logic for vm
let cleanCode = code.replace(/import .*? from .*?;/g, '');
cleanCode = cleanCode.replace(/export default async function handler.*/s, '');
cleanCode = `
const crypto = require('crypto');
${cleanCode}
// Expose functions for testing
const testExports = {
    sign,
    verifyAdminSession
};
testExports;
`;

test('admin-gateway.js functions', async (t) => {
    const context = { require, Buffer, process: { env: {} } };
    vm.createContext(context);
    const testExports = vm.runInContext(cleanCode, context);

    await t.test('sign and verifyAdminSession', () => {
        // Must contain sub='admin' and exp > Date.now() for verification to pass
        const data = { sub: 'admin', exp: Date.now() + 10000 };
        const payload = Buffer.from(JSON.stringify(data)).toString('base64url');
        const signature = testExports.sign(payload);

        const token = `${payload}.${signature}`;

        assert.ok(testExports.verifyAdminSession(token));

        // Invalid token
        assert.ok(!testExports.verifyAdminSession(`${payload}.invalidsignature`));
        assert.ok(!testExports.verifyAdminSession(`invalidpayload.${signature}`));
        assert.ok(!testExports.verifyAdminSession('badformat'));
        assert.ok(!testExports.verifyAdminSession(''));
    });
});
