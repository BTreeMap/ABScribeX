import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logError, withPerformanceMonitoring, withRetry, getDiagnosticInfo } from './errorHandler';

// Mock chrome storage API
const mockChromeStorage = {
    local: {
        get: vi.fn(),
        set: vi.fn(),
        getBytesInUse: vi.fn()
    }
};

// @ts-ignore
global.chrome = {
    storage: mockChromeStorage
};

describe('ErrorHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockChromeStorage.local.get.mockImplementation((keys, callback) => {
            callback({});
        });
        mockChromeStorage.local.set.mockImplementation((data, callback) => {
            if (callback) callback();
        });
        mockChromeStorage.local.getBytesInUse.mockImplementation((callback) => {
            callback(1024);
        });
    });

    describe('logError', () => {
        it('should log error with context', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            const error = new Error('Test error');
            const context = {
                component: 'TestComponent',
                operation: 'testOperation',
                metadata: { key: 'value' }
            };

            logError(error, context);

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('ABScribeX Error [TestComponent:testOperation]:'),
                expect.objectContaining({
                    message: 'Test error',
                    context: expect.objectContaining({
                        component: 'TestComponent',
                        operation: 'testOperation',
                        metadata: { key: 'value' }
                    })
                })
            );

            consoleSpy.mockRestore();
        });
    });

    describe('withPerformanceMonitoring', () => {
        it('should wrap sync function with performance monitoring', () => {
            const originalFn = vi.fn((x: number) => x * 2);
            const wrappedFn = withPerformanceMonitoring(originalFn, 'TestComponent', 'syncOperation');

            const result = wrappedFn(5);

            expect(result).toBe(10);
            expect(originalFn).toHaveBeenCalledWith(5);
        });

        it('should wrap async function with performance monitoring', async () => {
            const originalFn = vi.fn(async (x: number) => x * 2);
            const wrappedFn = withPerformanceMonitoring(originalFn, 'TestComponent', 'asyncOperation');

            const result = await wrappedFn(5);

            expect(result).toBe(10);
            expect(originalFn).toHaveBeenCalledWith(5);
        });

        it('should handle errors in wrapped functions', async () => {
            const error = new Error('Test error');
            const originalFn = vi.fn(async () => {
                throw error;
            });
            const wrappedFn = withPerformanceMonitoring(originalFn, 'TestComponent', 'errorOperation');

            await expect(wrappedFn()).rejects.toThrow('Test error');
        });
    });

    describe('withRetry', () => {
        it('should retry failed operations', async () => {
            let attempts = 0;
            const operation = vi.fn(async () => {
                attempts++;
                if (attempts < 3) {
                    throw new Error('Temporary failure');
                }
                return 'success';
            });

            const result = await withRetry(operation, 3, 10, 'TestComponent', 'retryOperation');

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(3);
        });

        it('should fail after max retries', async () => {
            const operation = vi.fn(async () => {
                throw new Error('Persistent failure');
            });

            await expect(
                withRetry(operation, 2, 10, 'TestComponent', 'failingOperation')
            ).rejects.toThrow('Persistent failure');

            expect(operation).toHaveBeenCalledTimes(3); // initial + 2 retries
        });
    });

    describe('getDiagnosticInfo', () => {
        it('should return diagnostic information', async () => {
            mockChromeStorage.local.get.mockImplementation((keys, callback) => {
                callback({
                    errorLogs: [{ message: 'test error' }],
                    performanceLogs: [{ operation: 'test', duration: 100 }]
                });
            });

            const info = await getDiagnosticInfo();

            expect(info).toEqual({
                errorLogs: [{ message: 'test error' }],
                performanceLogs: [{ operation: 'test', duration: 100 }],
                storageUsage: 1024
            });
        });

        it('should handle missing chrome API gracefully', async () => {
            // @ts-ignore
            global.chrome = undefined;

            const info = await getDiagnosticInfo();

            expect(info).toEqual({
                errorLogs: [],
                performanceLogs: [],
                storageUsage: 0
            });

            // Restore chrome mock
            // @ts-ignore
            global.chrome = { storage: mockChromeStorage };
        });
    });
});
