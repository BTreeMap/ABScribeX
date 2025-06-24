/**
 * Global type definitions for ABScribeX Chrome Extension
 */

import type { DOMUpdateOptions, ElementInfo } from '@/lib/domUtils';

declare global {
    interface Window {
        ABScribeX?: {
            version: string;
            diagnostics: {
                errors: any[];
                performance: any[];
                storage: number;
            };
            dom: {
                // Element detection and information
                getElementInfo: (element: HTMLElement) => ElementInfo;
                isEditable: (element: HTMLElement) => boolean;
                findElementWithRetry: (selector: string, maxAttempts?: number, delay?: number) => Promise<HTMLElement | null>;
                
                // Element manipulation
                updateElement: (element: HTMLElement, content: string, textContent?: string, options?: DOMUpdateOptions) => void;
                updateFormInput: (element: HTMLInputElement | HTMLTextAreaElement, value: string, options?: DOMUpdateOptions) => void;
                updateContentEditable: (element: HTMLElement, content: string, options?: DOMUpdateOptions) => void;
                
                // Element identification and management
                generateElementId: (prefix?: string) => string;
                addElementClass: (element: HTMLElement, classId: string) => void;
                findABScribeElement: (startElement: HTMLElement) => { element: HTMLElement; classId: string } | null;
                
                // Performance and batching
                batchDOMUpdates: (updates: (() => void)[]) => void;
                flushDOMBatch: () => void;
                
                // Utility functions
                stripStego: (html: string) => string;
                sanitizeHTML: (html: string, options?: any) => Promise<string>;
                extractTextFromHTML: (html: string) => Promise<string>;
            };
            utils: {
                generateIdentifier: (prefix?: string) => string;
                sleep: (ms: number) => Promise<void>;
                createMessage: (type: string, data: any) => any;
                sendMessage: (message: any) => Promise<any>;
            };
        };
    }
}

// Export empty object to make this a module
export { };
