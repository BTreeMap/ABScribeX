/**
 * Global type definitions for ABScribeX Chrome Extension
 */

declare global {
    interface Window {
        ABScribeX?: {
            version: string;
            diagnostics: {
                errors: any[];
                performance: any[];
                storage: number;
            };
        };
    }
}

// Export empty object to make this a module
export { };
