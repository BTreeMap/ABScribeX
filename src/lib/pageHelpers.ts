/**
 * ABScribeX Page Helper Functions
 * This module contains helper functions for page-level DOM manipulation and framework event handling
 * Uses closure pattern to capture browser context once during initialization for optimal performance
 * 
 * Key Performance Optimizations:
 * - Browser context (document, window) captured once via closure - no runtime checks
 * - Native value setters pre-captured for React compatibility 
 * - No static method overhead - functions are created with bound context
 * - Batched DOM operations use captured requestAnimationFrame reference
 * - All functions operate with zero overhead context access
 */

import { getElementInfo, type DOMUpdateOptions } from '@/lib/domUtils';

/**
 * Browser context interface for dependency injection
 */
export interface BrowserContext {
    document: Document;
    window: Window;
}

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

    // Pre-capture native setters for performance optimization
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

    // All functions below have access to doc, win, and native setters via closure
    // No more runtime checks needed!

    const triggerFrameworkEvents = (element: HTMLElement, inputValue?: string): void => {
        const events = [
            new InputEvent('input', {
                bubbles: true,
                cancelable: false,
                inputType: 'insertText',
                data: inputValue || null,
                composed: true
            }),
            new Event('change', {
                bubbles: true,
                cancelable: true
            }),
            new FocusEvent('blur', {
                bubbles: true,
                cancelable: true
            })
        ];

        events.forEach(event => {
            try {
                element.dispatchEvent(event);
            } catch (error) {
                console.error('ABScribe: Error triggering framework event:', error);
            }
        });
    };

    const setNativeValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
        try {
            if (element instanceof HTMLInputElement && nativeInputValueSetter) {
                nativeInputValueSetter.call(element, value);
            } else if (element instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
                nativeTextAreaValueSetter.call(element, value);
            } else {
                // Fallback method
                let descriptor = Object.getOwnPropertyDescriptor(element, 'value');
                if (!descriptor || !descriptor.set) {
                    descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
                }
                if (descriptor && descriptor.set) {
                    descriptor.set.call(element, value);
                } else {
                    element.value = value;
                }
            }
        } catch (error) {
            console.error('ABScribe: Error setting native value:', error);
            element.value = value; // Ultimate fallback
        }
    };

    const isEditable = (element: HTMLElement): boolean => {
        const elementInfo = getElementInfo(element);
        return elementInfo.isEditable;
    };

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

    const setCursorAtEnd = (element: HTMLElement): void => {
        const selection = win.getSelection();
        if (selection) {
            const range = doc.createRange();
            range.selectNodeContents(element);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    };

    const updateElement = (element: HTMLElement, content: string, textContent?: string, options: DOMUpdateOptions = {}): void => {
        const elementInfo = getElementInfo(element);

        // Ensure element is visible
        if (element.style.display === 'none') {
            element.style.display = '';
        }

        if (elementInfo.isFormInput) {
            const inputElement = element as HTMLInputElement | HTMLTextAreaElement;

            if (options.focusAfterUpdate !== false) {
                inputElement.focus();
            }

            setNativeValue(inputElement, textContent || content);

            if (options.triggerEvents !== false) {
                triggerFrameworkEvents(inputElement, textContent || content);
            }
        } else if (elementInfo.isContentEditable) {
            if (options.focusAfterUpdate !== false) {
                element.focus();
            }

            element.innerHTML = content;
            
            // Only set cursor at end if explicitly requested (defaults to false for better UX)
            if (options.setCursorAtEnd === true) {
                setCursorAtEnd(element);
            }

            if (options.triggerEvents !== false) {
                triggerFrameworkEvents(element);
            }
        } else {
            element.innerHTML = content;
            if (options.triggerEvents !== false) {
                triggerFrameworkEvents(element);
            }
        }
    };

    const updateFormInput = (element: HTMLInputElement | HTMLTextAreaElement, value: string, options: DOMUpdateOptions = {}): void => {
        if (options.focusAfterUpdate !== false) {
            element.focus();
        }

        setNativeValue(element, value);

        if (options.triggerEvents !== false) {
            triggerFrameworkEvents(element, value);
        }
    };

    const updateContentEditable = (element: HTMLElement, content: string, options: DOMUpdateOptions = {}): void => {
        if (options.focusAfterUpdate !== false) {
            element.focus();
        }

        element.innerHTML = content;
        
        // Only set cursor at end if explicitly requested (defaults to false for better UX)
        if (options.setCursorAtEnd === true) {
            setCursorAtEnd(element);
        }

        if (options.triggerEvents !== false) {
            triggerFrameworkEvents(element);
        }
    };

    const findElementWithRetry = async (selector: string, maxAttempts: number = 5, delay: number = 100): Promise<HTMLElement | null> => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const element = doc.querySelector(selector) as HTMLElement;
            if (element) {
                return element;
            }

            if (attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        return null;
    };

    // Batching with closure-captured requestAnimationFrame
    let domOperations: (() => void)[] = [];
    let batchScheduled = false;

    const scheduleBatch = (): void => {
        if (!batchScheduled) {
            batchScheduled = true;
            win.requestAnimationFrame(() => {
                const ops = [...domOperations];
                domOperations.length = 0;
                batchScheduled = false;

                ops.forEach(op => {
                    try {
                        op();
                    } catch (error) {
                        console.error('ABScribe: Error in batched DOM operation:', error);
                    }
                });
            });
        }
    };

    const batchDOMUpdates = (updates: (() => void)[]): void => {
        domOperations.push(...updates);
        scheduleBatch();
    };

    const flushDOMBatch = (): void => {
        if (domOperations.length > 0) {
            const ops = [...domOperations];
            domOperations.length = 0;
            batchScheduled = false;

            ops.forEach(op => {
                try {
                    op();
                } catch (error) {
                    console.error('ABScribe: Error in flushed DOM operation:', error);
                }
            });
        }
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

    // Return object with all functions having captured context via closure
    return {
        // Framework event handling
        triggerFrameworkEvents,
        setNativeValue,

        // Element management
        isEditable,
        addElementClass,
        findABScribeElement,
        findNamedParent,

        // DOM manipulation
        updateElement,
        updateFormInput,
        updateContentEditable,
        findElementWithRetry,

        // Batching
        batchDOMUpdates,
        flushDOMBatch,

        // Utilities
        sleep,
        waitForGlobal
    };
}

// Default export for convenience
export default createPageHelpers;
