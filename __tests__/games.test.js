import test from 'node:test';
import assert from 'node:assert';
import path from 'path';

test('games.js exports an express router', async (t) => {
    // Setup global fetch to avoid top-level or routing invocation errors
    global.fetch = async () => {};

    const modulePath = path.resolve(process.cwd(), 'api/games.js');

    try {
        const games = await import(modulePath);

        // Assert it exports the router object correctly
        assert.ok(games.default);
        assert.ok(typeof games.default.get === 'function' || typeof games.default.post === 'function');
        assert.ok(typeof games.default.use === 'function');
    } catch(e) {
        assert.fail(e.message);
    }
});
