import '../api/ad-studio-pro.js';

describe('AdStudioPRODeep.clamp', () => {
    let clamp;

    beforeAll(() => {
        clamp = window.AdStudioPRODeep.clamp;
    });

    test('should return minimum if value is not a finite number', () => {
        expect(clamp(NaN, 5, 10)).toBe(5);
        expect(clamp(Infinity, 5, 10)).toBe(5);
        expect(clamp(-Infinity, 5, 10)).toBe(5);
        expect(clamp('invalid', 5, 10)).toBe(5);
        expect(clamp({}, 5, 10)).toBe(5);
        expect(clamp(undefined, 5, 10)).toBe(5);
    });

    test('should return minimum if value is less than minimum', () => {
        expect(clamp(3, 5, 10)).toBe(5);
        expect(clamp(-10, -5, 0)).toBe(-5);
        expect(clamp('3', 5, 10)).toBe(5); // Testing string number
    });

    test('should return maximum if value is greater than maximum', () => {
        expect(clamp(15, 5, 10)).toBe(10);
        expect(clamp(5, -5, 0)).toBe(0);
        expect(clamp('15', 5, 10)).toBe(10); // Testing string number
    });

    test('should return the value if it is between minimum and maximum', () => {
        expect(clamp(7, 5, 10)).toBe(7);
        expect(clamp(-2, -5, 0)).toBe(-2);
        expect(clamp('7', 5, 10)).toBe(7); // Testing string number
    });

    test('should handle edge cases where value equals minimum or maximum', () => {
        expect(clamp(5, 5, 10)).toBe(5);
        expect(clamp(10, 5, 10)).toBe(10);
    });
});
