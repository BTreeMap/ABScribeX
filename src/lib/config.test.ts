import { describe, it, expect } from 'vitest';
import { Config } from './config';

describe('Config', () => {
    it('should have ActionClickedElement defined as a string', () => {
        expect(typeof Config.ActionClickedElement).toBe('string');
        expect(Config.ActionClickedElement).toBeTruthy();
    });

    it('should have Secret defined as a string', () => {
        expect(typeof Config.Secret).toBe('string');
        expect(Config.Secret).toBeTruthy();
    });

    it('should have Tag defined as a string', () => {
        expect(typeof Config.Tag).toBe('string');
        expect(Config.Tag).toBeTruthy();
    });

    // Optional: Test for specific values if they are truly constant and critical
    // However, this can make tests brittle if these IDs are expected to change (even if rarely)
    // it('ActionClickedElement should match expected value', () => {
    //   expect(Config.ActionClickedElement).toBe('5e997d48-f5c7-b4e5-c1c4-ff004e1930cd');
    // });
});
