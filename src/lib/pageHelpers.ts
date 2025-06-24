/**
 * ABScribeX Page Helper Functions
 * This module consolidates all page-level helper functions and delegates DOM operations to domUtils
 * Uses closure pattern with proper context injection for optimal performance
 * 
 * Architecture: domUtils (DOM operations) -> pageHelpers (consolidation + page-specific logic) -> page-helper.content.ts
 * 
 * Key Improvements in This Refactor:
 * - Eliminated code duplication between domUtils and pageHelpers
 * - domUtils is now the single source of truth for all DOM operations
 * - pageHelpers focuses on ABScribe-specific logic and utility functions
 * - Proper context injection ensures no reliance on global variables
 * - Clean separation of concerns with delegation pattern
 * 
 * Performance Optimizations:
 * - Browser context captured once via closure - no runtime checks
 * - DOM operations delegated to context-aware domUtils factory
 * - ABScribe-specific helpers (element finding, class management) layered on top
 * - Utilities (sleep, global waiting) provided at this level
 */

import { createDOMUtils, type DOMUpdateOptions, type BrowserContext } from '@/lib/domUtils';

/**
 * Factory function to create context-aware helper instances using closure pattern
 * This captures the browser context once during initialization for optimal performance
 */
export function createPageHelpers(context?: BrowserContext) {
    // Capture browser context once using closure - no more runtime checks!
    const doc = context?.document || (typeof document !== 'undefined' ? document : null);
    const win = context?.window || (typeof window !== 'undefined' ? window : null);

    if (!doc || !win) {
        throw new Error('Page helpers can only be created in browser context');
    }

    // Create DOM utilities with the captured context
    const domUtils = createDOMUtils({ document: doc, window: win });

    // ABScribe-specific helper functions that build on top of domUtils

    const addElementClass = (element: HTMLElement, classId: string): void => {
        if (!element.classList.contains(classId)) {
            element.classList.add(classId);
        }
    };

    const findABScribeElement = (startElement: HTMLElement): { element: HTMLElement; classId: string } | null => {
        let currentElement: HTMLElement | null = startElement;

        while (currentElement) {
            const abscribeClasses = Array.from(currentElement.classList)
                .filter(className => className.startsWith('abscribex-'));

            if (abscribeClasses.length > 0) {
                return {
                    element: currentElement,
                    classId: abscribeClasses[0]
                };
            }

            currentElement = currentElement.parentElement;
        }

        return null;
    };

    const findNamedParent = (element: HTMLElement): HTMLElement | null => {
        let namedParent: HTMLElement | null = element;
        while (namedParent && !namedParent.id) {
            if (namedParent.parentElement && namedParent.parentElement !== namedParent) {
                namedParent = namedParent.parentElement;
            } else {
                namedParent = null;
                break;
            }
        }
        return namedParent;
    };

    const sleep = (ms: number): Promise<void> => {
        return new Promise(resolve => setTimeout(resolve, ms));
    };

    const waitForGlobal = <T>(globalName: string, checkInterval: number = 10): Promise<T> => {
        return new Promise<T>((resolve) => {
            const globalObj = (win as any)[globalName];
            if (globalObj) {
                resolve(globalObj);
                return;
            }

            const checkGlobal = () => {
                const globalObj = (win as any)[globalName];
                if (globalObj) {
                    resolve(globalObj);
                } else {
                    setTimeout(checkGlobal, checkInterval);
                }
            };

            // Listen for custom ready events
            const eventName = `${globalName}Ready`;
            win.addEventListener(eventName, () => resolve((win as any)[globalName]), { once: true });

            // Also poll as fallback
            checkGlobal();
        });
    };

    // Return consolidated helpers that combine domUtils functionality with ABScribe-specific logic
    return {
        // Delegate core DOM operations to domUtils (single source of truth)
        getElementInfo: domUtils.getElementInfo,
        updateElement: domUtils.updateElement,
        updateFormInput: domUtils.updateFormInput,
        updateContentEditable: domUtils.updateContentEditable,
        findElementWithRetry: domUtils.findElementWithRetry,
        batchDOMUpdates: domUtils.batchDOMUpdates,
        flushDOMBatch: domUtils.flushDOMBatch,

        // Framework event handling (delegated to domUtils)
        triggerFrameworkEvents: domUtils.triggerFrameworkEvents,
        setNativeValue: domUtils.setNativeValue,

        // ABScribe-specific element management
        addElementClass,
        findABScribeElement,
        findNamedParent,

        // Page-level utilities
        sleep,
        waitForGlobal,

        // Convenience method for checking if element is editable
        isEditable: (element: HTMLElement) => domUtils.getElementInfo(element).isEditable
    };
}

// Default export for convenience
export default createPageHelpers;
