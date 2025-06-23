import { describe, it, expect } from 'vitest';
import { generateIdentifier } from './generateIdentifier';

describe('generateIdentifier', () => {
    it('should return a string', () => {
        expect(typeof generateIdentifier()).toBe('string');
    });

    it('should return a string of length 32 (base32 from 20 bytes)', () => {
        expect(generateIdentifier()).toHaveLength(32);
    });

    it('should return a base32 string (lowercase letters and digits 2-7)', () => {
        const base32String = generateIdentifier();
        expect(/^[a-z2-7]{32}$/.test(base32String)).toBe(true);
    });

    it('should return different strings on subsequent calls', () => {
        const str1 = generateIdentifier();
        const str2 = generateIdentifier();
        expect(str1).not.toBe(str2);
    });

    it('should include prefix when provided', () => {
        const prefix = 'test_';
        const result = generateIdentifier(prefix);
        expect(result).toMatch(/^test_[a-z2-7]{32}$/);
        expect(result.length).toBe(prefix.length + 32);
    });

    it('should work with empty prefix', () => {
        const result = generateIdentifier('');
        expect(result).toMatch(/^[a-z2-7]{32}$/);
        expect(result.length).toBe(32);
    });

    it('should only contain valid base32 characters', () => {
        const result = generateIdentifier();
        const validChars = 'abcdefghijklmnopqrstuvwxyz234567';
        for (const char of result) {
            expect(validChars.includes(char)).toBe(true);
        }
    });
});
