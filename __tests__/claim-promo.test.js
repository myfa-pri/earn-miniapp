import test from 'node:test';
import assert from 'node:assert';
import path from 'path';

test('claim-promo.js exports an async handler function', async (t) => {
    // Setup global fetch to avoid top-level or routing invocation errors
    global.fetch = async () => ({ ok: true, json: async () => ({}) });

    const modulePath = path.resolve(process.cwd(), 'api/claim-promo.js');

    try {
        const claimPromo = await import(modulePath);

        // Assert it exports the default handler function
        assert.ok(claimPromo.default);
        assert.strictEqual(typeof claimPromo.default, 'function');

        // Mock request and response to verify it behaves correctly on bad input
        const req = { method: 'POST', body: { userId: '', code: '' }, headers: {} };
        let statusCode = 200;
        let responseJson = null;

        const res = {
            setHeader: () => {},
            status: (code) => {
                statusCode = code;
                return res;
            },
            json: (data) => {
                responseJson = data;
                return res;
            }
        };

        await claimPromo.default(req, res);

        // Because method is POST, if body args are missing it returns 400
        assert.strictEqual(statusCode, 400);
        assert.ok(responseJson.error);

    } catch(e) {
        assert.fail(e.message);
    }
});
