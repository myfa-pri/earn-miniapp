import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const code = fs.readFileSync(path.resolve(process.cwd(), 'api/admin-promos.js'), 'utf8');

// Strip exports
let cleanCodeStr = code.replace(/export default async function handler.*/s, '');

function testCleanCode(value) {
    const context = { value, result: null, process: { env: {} } };
    vm.createContext(context);
    vm.runInContext(cleanCodeStr + '\nresult = cleanCode(value);', context);
    return context.result;
}

test('cleanCode tests', async (t) => {
    await t.test('trims whitespace', () => {
        assert.strictEqual(testCleanCode('  TEST  '), 'TEST');
    });
    await t.test('uppercases', () => {
        assert.strictEqual(testCleanCode('test'), 'TEST');
    });
    await t.test('removes invalid characters', () => {
        assert.strictEqual(testCleanCode('TE@ST!123_-%'), 'TEST123_-');
    });
    await t.test('handles null/undefined/empty', () => {
        assert.strictEqual(testCleanCode(null), '');
        assert.strictEqual(testCleanCode(undefined), '');
        assert.strictEqual(testCleanCode(''), '');
    });
});
