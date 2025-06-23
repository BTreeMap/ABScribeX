/**
 * Custom DOMPurify initialization for Chrome extension service workers
 * 
 * The isomorphic-dompurify package doesn't properly initialize JSDOM in 
 * Chrome extension service worker environments, so we handle it manually.
 */

import DOMPurifyBase from 'dompurify';
import { JSDOM } from 'jsdom';

let purifyInstance: any = null;

/**
 * Initialize DOMPurify with JSDOM for service worker environments
 */
function initializeDOMPurify(): any {
  if (purifyInstance) {
    return purifyInstance;
  }

  try {
    // Check if we're in a browser environment with window
    if (typeof window !== 'undefined' && window.document) {
      // Browser environment - use DOMPurify directly
      purifyInstance = DOMPurifyBase;
    } else {
      // Service worker or Node.js environment - initialize with JSDOM
      const { window } = new JSDOM('<!DOCTYPE html>');
      purifyInstance = DOMPurifyBase(window as any);
    }
    
    console.log('DOMPurify initialized successfully for environment:', typeof window !== 'undefined' ? 'browser' : 'service-worker');
    return purifyInstance;
  } catch (error) {
    console.error('Failed to initialize DOMPurify:', error);
    throw new Error(`DOMPurify initialization failed: ${error}`);
  }
}

/**
 * Sanitize HTML content safely in any environment
 */
export function sanitizeHTML(html: string): string {
  if (!html) return '';
  
  try {
    const purify = initializeDOMPurify();
    return purify.sanitize(html);
  } catch (error) {
    console.error('Failed to sanitize HTML:', error);
    // Fallback: basic HTML escaping if DOMPurify fails
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}

/**
 * Get the initialized DOMPurify instance
 */
export function getDOMPurify(): any {
  return initializeDOMPurify();
}
