/**
 * Global type definitions for ABScribeX Chrome Extension
 */

import type { DOMUpdateOptions, ElementInfo } from '@/lib/domUtils';
import type { ContentWithMetadata, SanitizationOptions } from '@/lib/sanitizer';

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

                // Event handling
                triggerFrameworkEvents: (element: HTMLElement, inputValue?: string) => void;
                setNativeValue: (element: HTMLInputElement | HTMLTextAreaElement, value: string) => void;

                // Element identification and management
                generateElementId: (prefix?: string) => string;
                addElementClass: (element: HTMLElement, classId: string) => void;
                findABScribeElement: (startElement: HTMLElement) => { element: HTMLElement; classId: string } | null;

                // Performance and batching
                batchDOMUpdates: (updates: (() => void)[]) => void;
                flushDOMBatch: () => void;

                // Utility functions
                stripStego: (html: string) => string;
                sanitizeHTML: {
                    (input: string, options?: SanitizationOptions): Promise<string>;
                    (input: ContentWithMetadata, options?: SanitizationOptions): Promise<ContentWithMetadata>;
                };
                extractTextFromHTML: (html: string) => Promise<string>;

                // Content metadata helpers
                createContentWithMetadata: (content: string, elementType?: string, isSanitized?: boolean, dompurifyOptions?: any) => ContentWithMetadata;
                isContentWithMetadata: (input: any) => input is ContentWithMetadata;
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
