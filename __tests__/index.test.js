import test from 'node:test';
import assert from 'node:assert';
import path from 'path';

test('index.js exports app with GET and POST', async (t) => {
    // Dynamic import to parse module properly
    // This allows it to evaluate in Node ESM exactly as it does in prod

    // Setup a mock fetch globally to avoid breaking top level code
    global.fetch = async () => {};

    // We import the module directly
    const modulePath = path.resolve(process.cwd(), 'api/index.js');

    try {
        const index = await import(modulePath);

        // Ensure it exports app and check for fundamental express route handling characteristics
        assert.ok(index.default);
        assert.ok(typeof index.default.get === 'function');
        assert.ok(typeof index.default.post === 'function');
        assert.ok(typeof index.default.use === 'function');

    } catch(e) {
        assert.fail(e.message);
    }
});
