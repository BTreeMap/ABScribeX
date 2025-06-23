/**
 * HTML sanitization utility for Chrome extension contexts
 * 
 * Automatically detects the environment and uses:
 * - DOMPurify directly in browser/content script contexts
 * - Offscreen document API for service worker contexts
 */

import DOMPurify from 'dompurify';

// Global state management
let offscreenDocumentReady = false;
let pendingRequests = new Map<string, { resolve: Function; reject: Function }>();
let requestCounter = 0;

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
        const response = await chrome.runtime.sendMessage({
            type: 'PING_OFFSCREEN'
        });

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

    const requestId = `sanitize_${++requestCounter}`;

    return new Promise((resolve, reject) => {
        pendingRequests.set(requestId, { resolve, reject });

        chrome.runtime.sendMessage({
            type: 'SANITIZE_HTML',
            id: requestId,
            html,
            options
        }).then(response => {
            pendingRequests.delete(requestId);
            if (response.error) {
                reject(new Error(response.error));
            } else {
                resolve(response.sanitizedHtml);
            }
        }).catch(error => {
            pendingRequests.delete(requestId);
            reject(error);
        });
    });
}

/**
 * Extract text content from HTML using offscreen document
 */
async function extractTextInOffscreen(html: string): Promise<string> {
    await ensureOffscreenDocument();

    const requestId = `extract_${++requestCounter}`;

    return new Promise((resolve, reject) => {
        pendingRequests.set(requestId, { resolve, reject });

        chrome.runtime.sendMessage({
            type: 'EXTRACT_TEXT',
            id: requestId,
            html
        }).then(response => {
            pendingRequests.delete(requestId);
            if (response.error) {
                reject(new Error(response.error));
            } else {
                resolve(response.textContent);
            }
        }).catch(error => {
            pendingRequests.delete(requestId);
            reject(error);
        });
    });
}

/**
 * Sanitize HTML content safely in any environment
 */
export async function sanitizeHTML(html: string, options?: any): Promise<string> {
    if (!html) return '';

    try {
        if (hasDOMAccess()) {
            // Browser/content script environment - use DOMPurify directly
            return DOMPurify.sanitize(html, options) as unknown as string;
        } else if (isServiceWorker()) {
            // Service worker environment - use offscreen document
            return await sanitizeInOffscreen(html, options);
        } else {
            // Fallback environment - basic HTML escaping
            throw new Error('Unsupported environment for HTML sanitization');
        }
    } catch (error) {
        console.error('Failed to sanitize HTML:', error);
        // Fallback: basic HTML escaping if sanitization fails
        return html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }
}

/**
 * Extract text content from HTML safely in any environment
 */
export async function extractTextFromHTML(html: string): Promise<string> {
    if (!html) return '';

    try {
        if (hasDOMAccess()) {
            // Browser/content script environment - use DOM directly
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = DOMPurify.sanitize(html) as unknown as string;
            const textContent = tempDiv.textContent || tempDiv.innerText || '';
            tempDiv.remove();
            return textContent;
        } else if (isServiceWorker()) {
            // Service worker environment - use offscreen document
            return await extractTextInOffscreen(html);
        } else {
            // Fallback - basic text extraction
            return html.replace(/<[^>]*>/g, '');
        }
    } catch (error) {
        console.error('Failed to extract text from HTML:', error);
        // Fallback: basic tag stripping
        return html.replace(/<[^>]*>/g, '');
    }
}

/**
 * Get the DOMPurify instance (only available in DOM contexts)
 * @deprecated Use sanitizeHTML instead for cross-environment compatibility
 */
export function getDOMPurify(): typeof DOMPurify | null {
    if (hasDOMAccess()) {
        return DOMPurify;
    }
    console.warn('DOMPurify not available in service worker context. Use sanitizeHTML instead.');
    return null;
}
