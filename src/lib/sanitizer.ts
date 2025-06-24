/**
 * HTML sanitization utility for Chrome extension contexts
 * 
 * Automatically detects the environment and uses:
 * - DOMPurify directly in browser/content script contexts
 * - Offscreen document API for service worker contexts
 */

import DOMPurify from 'dompurify';
import {
    MessageTypes,
    createMessage,
    sendMessage,
    SanitizeHTMLMessage,
    ExtractTextMessage,
    PingOffscreenMessage,
    SanitizationResponse,
    TextExtractionResponse
} from '@/lib/config';
import { generateIdentifier } from '@/lib/generateIdentifier';
import { logError, withPerformanceMonitoring, withRetry, safeAsync } from '@/lib/errorHandler';

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
 * Sanitize HTML content safely in any environment
 */
export const sanitizeHTML = withPerformanceMonitoring(
    async (html: string, options?: any): Promise<string> => {
        if (!html) return '';

        return safeAsync(
            async () => {
                if (hasDOMAccess()) {
                    // Browser/content script environment - use DOMPurify directly
                    return DOMPurify.sanitize(html, options) as unknown as string;
                } else if (isServiceWorker()) {
                    // Service worker environment - use offscreen document with retry
                    return await withRetry(
                        () => sanitizeInOffscreen(html, options),
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
                operation: 'sanitizeHTML',
                metadata: { htmlLength: html.length, hasOptions: !!options }
            }
        );
    },
    'Sanitizer',
    'sanitizeHTML'
);

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
