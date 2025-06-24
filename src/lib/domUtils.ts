/**
 * Optimized DOM manipulation utilities for ABScribeX
 * Framework-agnostic approach with batched operations and performance optimization
 * Now supports dependency injection of browser context for better testability and isolation
 */

import { logError, withPerformanceMonitoring, logPerformance } from '@/lib/errorHandler';

export interface DOMUpdateOptions {
    focusAfterUpdate?: boolean;
    triggerEvents?: boolean;
    preserveSelection?: boolean;
    batchUpdates?: boolean;
    setCursorAtEnd?: boolean; // Controls cursor positioning in contentEditable elements - defaults to false for better UX
}

export interface ElementInfo {
    element: HTMLElement;
    tagName: string;
    isEditable: boolean;
    isContentEditable: boolean;
    isFormInput: boolean;
}

/**
 * Browser context interface for dependency injection
 */
export interface BrowserContext {
    document: Document;
    window: Window;
}

/**
 * Factory function to create DOM utilities with injected browser context
 */
export function createDOMUtils(context?: BrowserContext) {
    // Capture browser context once using closure
    const doc = context?.document || (typeof document !== 'undefined' ? document : null);
    const win = context?.window || (typeof window !== 'undefined' ? window : null);

    if (!doc || !win) {
        throw new Error('DOM utilities can only be created in browser context');
    }

    // Pre-capture native setters for performance optimization
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

    /**
     * Batch DOM operations for better performance
     */
    class DOMBatch {
        private operations: (() => void)[] = [];
        private scheduled = false;

        add(operation: () => void): void {
            this.operations.push(operation);
            this.schedule();
        }

        private schedule(): void {
            if (!this.scheduled) {
                this.scheduled = true;
                win!.requestAnimationFrame(() => {
                    this.flush();
                });
            }
        }

        private flush(): void {
            const startTime = win!.performance.now();

            // Execute all operations in a single frame
            this.operations.forEach(op => {
                try {
                    op();
                } catch (error) {
                    logError(error, { component: 'DOMBatch', operation: 'flush' });
                }
            });

            logPerformance('DOMBatch', 'flush', win!.performance.now() - startTime);

            this.operations = [];
            this.scheduled = false;
        }

        public flushImmediate(): void {
            this.flush();
        }
    }

    const domBatch = new DOMBatch();

    /**
     * Get comprehensive element information
     */
    const getElementInfo = (element: HTMLElement): ElementInfo => {
        const tagName = element.tagName.toLowerCase();
        const isFormInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
        const isContentEditable = element.contentEditable === 'true' || element.isContentEditable;
        const isEditable = isFormInput || isContentEditable;

        return {
            element,
            tagName,
            isEditable,
            isContentEditable,
            isFormInput
        };
    };

    /**
     * Set value using native setter to bypass framework wrappers
     */
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
            logError(error, { component: 'DOMUtils', operation: 'setNativeValue' });
            element.value = value; // Ultimate fallback
        }
    };

    /**
     * Trigger comprehensive change events for framework compatibility
     */
    const triggerFrameworkEvents = (element: HTMLElement, inputValue?: string): void => {
        const events = [
            // Modern input event (React, Vue 3+)
            new InputEvent('input', {
                bubbles: true,
                cancelable: false,
                inputType: 'insertText',
                data: inputValue || null,
                composed: true
            }),

            // Traditional change event (all frameworks)
            new Event('change', {
                bubbles: true,
                cancelable: true
            }),

            // Blur event for validation triggers
            new FocusEvent('blur', {
                bubbles: true,
                cancelable: true
            })
        ];

        events.forEach(event => {
            try {
                element.dispatchEvent(event);
            } catch (error) {
                logError(error, {
                    component: 'DOMUtils',
                    operation: 'triggerFrameworkEvents',
                    metadata: { eventType: event.type }
                });
            }
        });
    };

    /**
     * Set cursor position at the end of a contentEditable element
     */
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

    /**
     * Optimized form input update
     */
    const updateFormInput = withPerformanceMonitoring(
        (element: HTMLInputElement | HTMLTextAreaElement, value: string, options: DOMUpdateOptions = {}): void => {
            const {
                focusAfterUpdate = true,
                triggerEvents = true,
                batchUpdates = true
            } = options;

            const operation = () => {
                try {
                    // Focus element to ensure it's active (if requested)
                    if (focusAfterUpdate) {
                        element.focus();
                    }

                    // Set value using native setter to bypass React/framework wrappers
                    setNativeValue(element, value);

                    // Trigger events that frameworks listen for
                    if (triggerEvents) {
                        triggerFrameworkEvents(element, value);
                    }

                } catch (error) {
                    logError(error, {
                        component: 'DOMUtils',
                        operation: 'updateFormInput',
                        metadata: { tagName: element.tagName, valueLength: value.length }
                    });
                }
            };

            if (batchUpdates) {
                domBatch.add(operation);
            } else {
                operation();
            }
        },
        'DOMUtils',
        'updateFormInput'
    );

    /**
     * Optimized content editable update with selection preservation
     */
    const updateContentEditable = withPerformanceMonitoring(
        (element: HTMLElement, content: string, options: DOMUpdateOptions = {}): void => {
            const {
                focusAfterUpdate = true,
                triggerEvents = true,
                preserveSelection = false,
                batchUpdates = true,
                setCursorAtEnd: shouldSetCursor = false
            } = options;

            const operation = () => {
                try {
                    // Store current selection if preserving
                    let savedSelection: Range | null = null;
                    if (preserveSelection && doc.activeElement === element) {
                        const selection = win.getSelection();
                        if (selection && selection.rangeCount > 0) {
                            savedSelection = selection.getRangeAt(0).cloneRange();
                        }
                    }

                    // Focus the element if requested
                    if (focusAfterUpdate) {
                        element.focus();
                    }

                    // Update content
                    element.innerHTML = content;

                    // Handle cursor positioning
                    if (shouldSetCursor || preserveSelection) {
                        const selection = win.getSelection();
                        if (selection) {
                            if (savedSelection && preserveSelection) {
                                try {
                                    selection.removeAllRanges();
                                    selection.addRange(savedSelection);
                                } catch (error) {
                                    // Fallback to end of content if restore fails
                                    setCursorAtEnd(element);
                                }
                            } else if (shouldSetCursor) {
                                setCursorAtEnd(element);
                            }
                        }
                    }

                    // Trigger change events
                    if (triggerEvents) {
                        triggerFrameworkEvents(element);
                    }

                } catch (error) {
                    logError(error, {
                        component: 'DOMUtils',
                        operation: 'updateContentEditable',
                        metadata: { tagName: element.tagName, contentLength: content.length }
                    });
                }
            };

            if (batchUpdates) {
                domBatch.add(operation);
            } else {
                operation();
            }
        },
        'DOMUtils',
        'updateContentEditable'
    );

    /**
     * Generic element update with automatic type detection
     */
    const updateElement = withPerformanceMonitoring(
        (element: HTMLElement, content: string, textContent?: string, options: DOMUpdateOptions = {}): void => {
            const elementInfo = getElementInfo(element);

            // Ensure element is visible
            if (element.style.display === 'none') {
                element.style.display = '';
            }

            if (elementInfo.isFormInput) {
                // Handle form inputs (input, textarea, select)
                const inputElement = element as HTMLInputElement | HTMLTextAreaElement;
                updateFormInput(inputElement, textContent || content, options);
            } else if (elementInfo.isContentEditable) {
                // Handle contenteditable elements
                updateContentEditable(element, content, options);
            } else {
                // Handle other elements (divs, spans, etc.)
                const operation = () => {
                    try {
                        element.innerHTML = content;
                        if (options.triggerEvents !== false) {
                            triggerFrameworkEvents(element);
                        }
                    } catch (error) {
                        logError(error, {
                            component: 'DOMUtils',
                            operation: 'updateElement',
                            metadata: { tagName: element.tagName, contentLength: content.length }
                        });
                    }
                };

                if (options.batchUpdates !== false) {
                    domBatch.add(operation);
                } else {
                    operation();
                }
            }
        },
        'DOMUtils',
        'updateElement'
    );

    /**
     * Find element with retry mechanism for dynamic content
     */
    const findElementWithRetry = async (
        selector: string,
        maxAttempts: number = 5,
        delay: number = 100
    ): Promise<HTMLElement | null> => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const element = doc.querySelector(selector) as HTMLElement;
            if (element) {
                return element;
            }

            if (attempt < maxAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        logError(new Error(`Element not found after ${maxAttempts} attempts`), {
            component: 'DOMUtils',
            operation: 'findElementWithRetry',
            metadata: { selector, maxAttempts }
        });

        return null;
    };

    /**
     * Batch multiple DOM updates for optimal performance
     */
    const batchDOMUpdates = (updates: (() => void)[]): void => {
        updates.forEach(update => domBatch.add(update));
    };

    /**
     * Force immediate execution of batched operations
     */
    const flushDOMBatch = (): void => {
        domBatch.flushImmediate();
    };

    // Return object with all DOM utilities having captured context via closure
    return {
        // Core utilities
        getElementInfo,
        setNativeValue,
        triggerFrameworkEvents,
        setCursorAtEnd,

        // Update functions
        updateElement,
        updateFormInput,
        updateContentEditable,

        // Utilities
        findElementWithRetry,
        batchDOMUpdates,
        flushDOMBatch
    };
}
