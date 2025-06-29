/**
 * HTML sanitization utility for Chrome extension contexts
 * 
 * Automatically detects the environment and uses:
 * - DOMPurify directly in browser/content script contexts
 * - Offscreen document API for service worker contexts
 */

import DOMPurify from 'dompurify';
import { type Config } from 'dompurify';
import {
    MessageTypes,
    createMessage,
    sendMessage,
    SanitizeHTMLMessage,
    ExtractTextMessage,
    PingOffscreenMessage,
    SanitizationResponse,
    TextExtractionResponse,
    ContentWithMetadata,
} from '@/lib/config';
import { generateIdentifier } from '@/lib/generateIdentifier';
import { logError, withPerformanceMonitoring, withRetry, safeAsync } from '@/lib/errorHandler';
import { isEditableFormElementTag } from '@/lib/utils';

// Global state management
let offscreenDocumentReady = false;

/**
 * Check if we're in a service worker environment
 */
function isServiceWorker(): boolean {
    return typeof window === 'undefined' && typeof importScripts !== 'undefined';
}

/**
 * Check if we're in a browser environment with DOM access
 */
function hasDOMAccess(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Create and ensure offscreen document is ready
 */
async function ensureOffscreenDocument(): Promise<void> {
    if (offscreenDocumentReady) {
        return;
    }

    try {
        // Check if offscreen document already exists
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
        });

        if (existingContexts.length === 0) {
            // Create new offscreen document
            await chrome.offscreen.createDocument({
                url: chrome.runtime.getURL('offscreen.html'),
                reasons: ['DOM_SCRAPING'],
                justification: 'HTML sanitization using DOMPurify in service worker context'
            });
        }

        // Verify the document is ready
        const pingMessage = createMessage<PingOffscreenMessage>(MessageTypes.PING_OFFSCREEN, {});
        const response = await sendMessage(pingMessage);

        if (response?.status === 'ready') {
            offscreenDocumentReady = true;
        } else {
            throw new Error('Offscreen document failed to initialize');
        }
    } catch (error) {
        console.error('Failed to create or verify offscreen document:', error);
        throw error;
    }
}

/**
 * Send sanitization request to offscreen document
 */
async function sanitizeInOffscreen(html: string, options?: any): Promise<string> {
    await ensureOffscreenDocument();

    const requestId = generateIdentifier('sanitize-');
    const message = createMessage<SanitizeHTMLMessage>(MessageTypes.SANITIZE_HTML, {
        id: requestId,
        html,
        options
    });

    const response = await sendMessage<SanitizeHTMLMessage, SanitizationResponse>(message);

    if (response.error) {
        throw new Error(response.error);
    }

    return response.sanitizedHtml || '';
}

/**
 * Extract text content from HTML using offscreen document
 */
async function extractTextInOffscreen(html: string): Promise<string> {
    await ensureOffscreenDocument();

    const requestId = generateIdentifier('extract-');
    const message = createMessage<ExtractTextMessage>(MessageTypes.EXTRACT_TEXT, {
        id: requestId,
        html
    });

    const response = await sendMessage<ExtractTextMessage, TextExtractionResponse>(message);

    if (response.error) {
        throw new Error(response.error);
    }

    return response.textContent || '';
}

/**
 * Sanitization options for different element types
 */
export interface SanitizationOptions {
    elementType?: string;
    dompurifyOptions?: Config;
}

/**
 * Create a ContentWithMetadata object
 */
export function createContentWithMetadata(
    content: string,
    elementType?: string,
    isSanitized: boolean = false,
    dompurifyOptions?: any
): ContentWithMetadata {
    return {
        content,
        elementType,
        isSanitized,
        originalLength: content.length,
        sanitizedAt: isSanitized ? Date.now() : undefined,
        dompurifyOptions
    };
}

/**
 * Type guard to check if input is ContentWithMetadata
 */
export function isContentWithMetadata(input: any): input is ContentWithMetadata {
    return input && typeof input === 'object' &&
        'content' in input && 'isSanitized' in input;
}

/**
 * Core sanitization function that performs the actual sanitization work
 */
const performSanitization = withPerformanceMonitoring(
    async (html: string, elementType?: string, dompurifyOptions?: any): Promise<string> => {
        if (!html) return '';

        // For textarea elements, don't apply DOMPurify as it will destroy content
        if (isEditableFormElementTag(elementType)) {
            // For textarea, just do basic escaping to prevent XSS
            return html
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\n/g, '<br />'); // Preserve newlines as <br> tags
        }

        return safeAsync(
            async () => {
                if (hasDOMAccess()) {
                    // Browser/content script environment - use DOMPurify directly
                    return DOMPurify.sanitize(html, dompurifyOptions) as unknown as string;
                } else if (isServiceWorker()) {
                    // Service worker environment - use offscreen document with retry
                    return await withRetry(
                        () => sanitizeInOffscreen(html, dompurifyOptions),
                        3,
                        1000,
                        'Sanitizer',
                        'sanitizeInOffscreen'
                    );
                } else {
                    // Fallback environment - basic HTML escaping
                    throw new Error('Unsupported environment for HTML sanitization');
                }
            },
            // Fallback: basic HTML escaping if sanitization fails
            html
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;'),
            {
                component: 'Sanitizer',
                operation: 'performSanitization',
                metadata: {
                    htmlLength: html.length,
                    elementType
                }
            }
        );
    },
    'Sanitizer',
    'performSanitization'
);

/**
 * Smart sanitization function that handles both string and ContentWithMetadata inputs
 * Returns the same type as input (string -> string, ContentWithMetadata -> ContentWithMetadata)
 */
export async function sanitizeHTML(input: string, options?: SanitizationOptions): Promise<string>;
export async function sanitizeHTML(input: ContentWithMetadata, options?: SanitizationOptions): Promise<ContentWithMetadata>;
export async function sanitizeHTML(
    input: string | ContentWithMetadata,
    options?: SanitizationOptions
): Promise<string | ContentWithMetadata> {
    // Handle ContentWithMetadata input
    if (isContentWithMetadata(input)) {
        // If already sanitized, return as-is
        if (input.isSanitized) {
            return input;
        }

        const elementType = input.elementType || options?.elementType || 'div'; // Default to 'div' if not specified
        const dompurifyOptions = input.dompurifyOptions || options?.dompurifyOptions;
        // Sanitize and return updated ContentWithMetadata
        const sanitizedContent = await performSanitization(
            input.content,
            elementType,
            dompurifyOptions,
        );

        return {
            ...input,
            content: sanitizedContent,
            elementType,
            dompurifyOptions,
            isSanitized: true,
            sanitizedAt: Date.now()
        };
    }

    // Handle string input
    return performSanitization(input, options?.elementType, options?.dompurifyOptions);
}

/**
 * Extract text content from HTML safely in any environment
 */
export const extractTextFromHTML = withPerformanceMonitoring(
    async (html: string): Promise<string> => {
        if (!html) return '';

        return safeAsync(
            async () => {
                if (hasDOMAccess()) {
                    // Browser/content script environment - use DOM directly
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = DOMPurify.sanitize(html) as unknown as string;
                    const textContent = tempDiv.textContent || tempDiv.innerText || '';
                    tempDiv.remove();
                    return textContent;
                } else if (isServiceWorker()) {
                    // Service worker environment - use offscreen document with retry
                    return await withRetry(
                        () => extractTextInOffscreen(html),
                        3,
                        1000,
                        'Sanitizer',
                        'extractTextInOffscreen'
                    );
                } else {
                    // Fallback - basic text extraction
                    return html.replace(/<[^>]*>/g, '');
                }
            },
            // Fallback: basic tag stripping
            html.replace(/<[^>]*>/g, ''),
            {
                component: 'Sanitizer',
                operation: 'extractTextFromHTML',
                metadata: { htmlLength: html.length }
            }
        );
    },
    'Sanitizer',
    'extractTextFromHTML'
);

/**
 * DOMPurify configuration optimized for ABScribeX's content processing needs
 * - Preserves essential HTML structure for content analysis
 * - Removes potentially dangerous attributes while maintaining readability
 * - Configured for safe display in extension UI components
 */
export const ABSCRIBEX_SANITIZATION_CONFIG: SanitizationOptions = {
    dompurifyOptions: {
        USE_PROFILES: { html: true },
        FORBID_ATTR: ['style']
    }
};