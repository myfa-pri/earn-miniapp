import test from 'node:test';
import assert from 'node:assert';
import { cleanCode } from './claim-promo.js';

test('cleanCode', async (t) => {
  await t.test('handles basic string', () => {
    assert.strictEqual(cleanCode('test'), 'TEST');
  });

  await t.test('handles uppercase string', () => {
    assert.strictEqual(cleanCode('TEST'), 'TEST');
  });

  await t.test('handles spaces', () => {
    assert.strictEqual(cleanCode('  test  '), 'TEST');
  });

  await t.test('handles null', () => {
    assert.strictEqual(cleanCode(null), '');
  });

  await t.test('handles undefined', () => {
    assert.strictEqual(cleanCode(undefined), '');
  });

  await t.test('handles empty string', () => {
    assert.strictEqual(cleanCode(''), '');
  });

  await t.test('handles numbers', () => {
    assert.strictEqual(cleanCode(123), '123');
  });
});
