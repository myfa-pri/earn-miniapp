import { test, describe } from 'node:test';
import assert from 'node:assert';

global.window = {};
global.document = {
  addEventListener: () => {}
};

await import('../api/ad-studio-pro.js');

const safeInteger = global.window.AdStudioPRODeep.safeInteger;

describe('safeInteger', () => {
    test('returns exact integer for valid number inputs', () => {
        assert.strictEqual(safeInteger(5), 5);
        assert.strictEqual(safeInteger(-10), -10);
        assert.strictEqual(safeInteger(0), 0);
    });

    test('parses integer strings correctly', () => {
        assert.strictEqual(safeInteger('42'), 42);
        assert.strictEqual(safeInteger('-42'), -42);
    });

    test('handles floats by flooring them', () => {
        assert.strictEqual(safeInteger(5.9), 5);
        assert.strictEqual(safeInteger(5.1), 5);
        assert.strictEqual(safeInteger(-5.1), -6); // Math.floor(-5.1) is -6
        assert.strictEqual(safeInteger('3.14'), 3);
    });

    test('returns fallback for undefined', () => {
        assert.strictEqual(safeInteger(undefined), 0);
        assert.strictEqual(safeInteger(undefined, 42), 42);
    });

    test('handles null correctly (Number(null) === 0)', () => {
        assert.strictEqual(safeInteger(null), 0);
        assert.strictEqual(safeInteger(null, 100), 0);
    });

    test('returns fallback for NaN and invalid strings', () => {
        assert.strictEqual(safeInteger(NaN), 0);
        assert.strictEqual(safeInteger(NaN, 10), 10);
        assert.strictEqual(safeInteger('abc'), 0);
        assert.strictEqual(safeInteger('abc', -1), -1);
        assert.strictEqual(safeInteger({}), 0);
        assert.strictEqual(safeInteger({}, 5), 5);
    });

    test('returns fallback for Infinity and -Infinity', () => {
        assert.strictEqual(safeInteger(Infinity), 0);
        assert.strictEqual(safeInteger(Infinity, 99), 99);
        assert.strictEqual(safeInteger(-Infinity), 0);
        assert.strictEqual(safeInteger(-Infinity, -99), -99);
    });
});
