import { describe, it, expect } from 'vitest';
import { generateRandomHexString } from './generateRandomHexString';

describe('generateRandomHexString', () => {
    it('should return a string', () => {
        expect(typeof generateRandomHexString()).toBe('string');
    });

    it('should return a string of length 16', () => {
        expect(generateRandomHexString()).toHaveLength(16);
    });

    it('should return a hexadecimal string', () => {
        const hexString = generateRandomHexString();
        expect(/^[0-9a-f]{16}$/i.test(hexString)).toBe(true);
    });

    it('should return different strings on subsequent calls', () => {
        const str1 = generateRandomHexString();
        const str2 = generateRandomHexString();
        expect(str1).not.toBe(str2);
    });

    // Mock crypto.getRandomValues to test specific byte arrays if needed
    // For now, we trust the underlying crypto.getRandomValues to be random enough
});
