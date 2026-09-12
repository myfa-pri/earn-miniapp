const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');

test('AdStudioPRODeep.normalizeUrl', async (t) => {
    // Setup the sandbox and load the script
    const sandbox = { window: {}, document: { addEventListener: () => {} }, URL: URL };
    const script = fs.readFileSync('api/ad-studio-pro.js', 'utf8');
    vm.createContext(sandbox);
    vm.runInContext(script, sandbox);

    const normalizeUrl = sandbox.window.AdStudioPRODeep.normalizeUrl;

    await t.test('should allow valid http and https URLs', () => {
        assert.strictEqual(normalizeUrl('http://example.com'), 'http://example.com/');
        assert.strictEqual(normalizeUrl('https://example.com'), 'https://example.com/');
    });

    await t.test('should trim whitespace', () => {
        assert.strictEqual(normalizeUrl('  https://example.com  '), 'https://example.com/');
        assert.strictEqual(normalizeUrl('\nhttps://example.com\t'), 'https://example.com/');
    });

    await t.test('should return empty string for non-http/https protocols', () => {
        assert.strictEqual(normalizeUrl('ftp://example.com'), '');
        assert.strictEqual(normalizeUrl('javascript:alert(1)'), '');
        assert.strictEqual(normalizeUrl('file:///etc/passwd'), '');
        assert.strictEqual(normalizeUrl('ws://example.com'), '');
    });

    await t.test('should return empty string for invalid URLs', () => {
        assert.strictEqual(normalizeUrl('not-a-url'), '');
        assert.strictEqual(normalizeUrl('://bad-url'), '');
        assert.strictEqual(normalizeUrl('example.com'), ''); // Missing protocol
    });

    await t.test('should return empty string for null, undefined, and empty strings', () => {
        assert.strictEqual(normalizeUrl(null), '');
        assert.strictEqual(normalizeUrl(undefined), '');
        assert.strictEqual(normalizeUrl(''), '');
        assert.strictEqual(normalizeUrl('   '), '');
    });

    await t.test('should handle complex but valid URLs', () => {
        const complexUrl = 'https://user:pass@sub.example.com:8080/path/to/page?query=string#hash';
        assert.strictEqual(normalizeUrl(complexUrl), complexUrl);
    });
});
