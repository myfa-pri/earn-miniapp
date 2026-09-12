import { jest } from '@jest/globals';
import { nativeTelegramCheck } from '../api/index.js';

describe('nativeTelegramCheck', () => {
    let originalFetch;

    beforeAll(() => {
        // According to the reviewer and issue rationale, we MUST mock global fetch.
        // If the code uses global fetch (or if Node.js natively provides it and node-fetch isn't overriding it globally),
        // we mock global.fetch here.
        originalFetch = global.fetch;
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    afterEach(() => {
        jest.clearAllMocks();
        global.fetch = originalFetch; // Reset to original before each mock to avoid state leakage
    });

    it('should return success: true when user is a member', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            json: jest.fn().mockResolvedValueOnce({
                ok: true,
                result: { status: 'member' }
            })
        });

        const result = await nativeTelegramCheck('channelId', 'userId');
        expect(result).toEqual({ success: true, status: 'member' });
    });

    it('should return success: false and status: error on network failure (promise rejection)', async () => {
        global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network offline'));

        const result = await nativeTelegramCheck('channel1', 'user1');
        expect(result).toEqual({ success: false, status: 'error' });
    });

    it('should return success: false and status: error when response.json() throws', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            json: jest.fn().mockRejectedValueOnce(new Error('Invalid JSON from 500 error'))
        });

        const result = await nativeTelegramCheck('channel1', 'user1');
        expect(result).toEqual({ success: false, status: 'error' });
    });

    it('should return success: false and proper status when API returns ok: false', async () => {
        global.fetch = jest.fn().mockResolvedValueOnce({
            json: jest.fn().mockResolvedValueOnce({
                ok: false,
                result: { status: 'bad request' }
            })
        });

        const result = await nativeTelegramCheck('channel1', 'user1');
        expect(result).toEqual({ success: false, status: 'error' });
    });
});
