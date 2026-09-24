import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import handler from '../api/drop.js';

test('drop.js handler', async (t) => {
    await t.test('injects back button and css successfully', () => {
        const mockHtml = `
<html><head></head><body>
<p id="noChancesMsg" style="color:var(--color-magenta); display:none;">No chances left today! Complete tasks to earn more.</p>
</body></html>
`;
        const originalReadFileSync = fs.readFileSync;
        fs.readFileSync = () => mockHtml;

        let statusSet, contentTypeSet, pragmaSet, cacheControlSet;
        let responseBody = '';

        const mockRes = {
            setHeader: (key, val) => {
                if (key === 'Content-Type') contentTypeSet = val;
                if (key === 'Pragma') pragmaSet = val;
                if (key === 'Cache-Control') cacheControlSet = val;
            },
            status: (code) => { statusSet = code; return mockRes; },
            send: (body) => { responseBody = body; }
        };

        const mockReq = {};

        try {
            handler(mockReq, mockRes);
            assert.strictEqual(statusSet, 200);
            assert.strictEqual(contentTypeSet, 'text/html; charset=utf-8');
            assert.ok(responseBody.includes('dropOverlayBackBtn'));
            assert.ok(responseBody.includes('<style id="drop-navigation-fix">'));
        } finally {
            fs.readFileSync = originalReadFileSync;
        }
    });

    await t.test('handles file not found gracefully', () => {
        const originalReadFileSync = fs.readFileSync;
        fs.readFileSync = () => { throw new Error('File not found'); };

        let statusSet;
        let responseBody = '';

        const mockRes = {
            setHeader: () => {},
            status: (code) => { statusSet = code; return mockRes; },
            send: (body) => { responseBody = body; }
        };

        try {
            handler({}, mockRes);
            assert.strictEqual(statusSet, 500);
            assert.strictEqual(responseBody, 'Unable to load Drop Game');
        } finally {
            fs.readFileSync = originalReadFileSync;
        }
    });
});
