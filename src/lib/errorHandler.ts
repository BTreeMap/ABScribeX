/**
 * Centralized error handling and performance monitoring for ABScribeX
 */

export interface ErrorContext {
    operation: string;
    component: string;
    metadata?: Record<string, any>;
    timestamp?: number;
}

export interface PerformanceLog {
    operation: string;
    duration: number;
    timestamp: number;
    component: string;
}

/**
 * Enhanced error logging with context
 */
export function logError(error: Error | unknown, context: ErrorContext): void {
    const errorData = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        context: {
            ...context,
            timestamp: context.timestamp || Date.now(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
            url: typeof window !== 'undefined' ? window.location?.href : 'unknown'
        }
    };

    console.error(`ABScribeX Error [${context.component}:${context.operation}]:`, errorData);

    // Store error for debugging (non-blocking)
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['errorLogs'], (result) => {
            const logs = result.errorLogs || [];
            logs.push(errorData);

            // Keep only last 50 errors to prevent storage bloat
            if (logs.length > 50) {
                logs.splice(0, logs.length - 50);
            }

            chrome.storage.local.set({ errorLogs: logs });
        });
    }
}

/**
 * Performance monitoring decorator
 */
export function withPerformanceMonitoring<T extends (...args: any[]) => any>(
    fn: T,
    component: string,
    operation: string
): T {
    return ((...args: Parameters<T>) => {
        const startTime = performance.now();

        try {
            const result = fn(...args);

            // Handle async functions
            if (result instanceof Promise) {
                return result
                    .then((value) => {
                        logPerformance(component, operation, performance.now() - startTime);
                        return value;
                    })
                    .catch((error) => {
                        logError(error, { component, operation });
                        throw error;
                    });
            }

            // Handle sync functions
            logPerformance(component, operation, performance.now() - startTime);
            return result;
        } catch (error) {
            logError(error, { component, operation });
            throw error;
        }
    }) as T;
}

/**
 * Log performance metrics
 */
export function logPerformance(component: string, operation: string, duration: number): void {
    const perfLog: PerformanceLog = {
        component,
        operation,
        duration,
        timestamp: Date.now()
    };

    // Log slow operations (>100ms)
    if (duration > 100) {
        console.warn(`ABScribeX Slow Operation [${component}:${operation}]: ${duration.toFixed(2)}ms`);
    }

    // Store performance data (non-blocking)
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['performanceLogs'], (result) => {
            const logs = result.performanceLogs || [];
            logs.push(perfLog);

            // Keep only last 100 performance logs
            if (logs.length > 100) {
                logs.splice(0, logs.length - 100);
            }

            chrome.storage.local.set({ performanceLogs: logs });
        });
    }
}

/**
 * Retry mechanism with exponential backoff
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    component: string = 'unknown',
    operationName: string = 'unknown'
): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;

            if (attempt === maxRetries) {
                logError(lastError, {
                    component,
                    operation: operationName,
                    metadata: { attempts: attempt + 1, maxRetries }
                });
                throw lastError;
            }

            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(`ABScribeX Retry [${component}:${operationName}] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms`);

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError!;
}

/**
 * Safe async operation wrapper
 */
export async function safeAsync<T>(
    operation: () => Promise<T>,
    fallback: T,
    context: ErrorContext
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        logError(error, context);
        return fallback;
    }
}

/**
 * Get diagnostic information
 */
export async function getDiagnosticInfo(): Promise<{
    errorLogs: any[];
    performanceLogs: PerformanceLog[];
    storageUsage: number;
}> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
        return { errorLogs: [], performanceLogs: [], storageUsage: 0 };
    }

    return new Promise((resolve) => {
        chrome.storage.local.get(['errorLogs', 'performanceLogs'], (result) => {
            chrome.storage.local.getBytesInUse((bytesInUse) => {
                resolve({
                    errorLogs: result.errorLogs || [],
                    performanceLogs: result.performanceLogs || [],
                    storageUsage: bytesInUse
                });
            });
        });
    });
}
