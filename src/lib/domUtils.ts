/**
 * Optimized DOM manipulation utilities for ABScribeX
 * Framework-agnostic approach with batched operations and performance optimization
 */

import { logError, withPerformanceMonitoring, logPerformance } from '@/lib/errorHandler';

export interface DOMUpdateOptions {
    focusAfterUpdate?: boolean;
    triggerEvents?: boolean;
    preserveSelection?: boolean;
    batchUpdates?: boolean;
}

export interface ElementInfo {
    element: HTMLElement;
    tagName: string;
    isEditable: boolean;
    isContentEditable: boolean;
    isFormInput: boolean;
}

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
            requestAnimationFrame(() => {
                this.flush();
            });
        }
    }

    private flush(): void {
        const startTime = performance.now();

        // Execute all operations in a single frame
        this.operations.forEach(op => {
            try {
                op();
            } catch (error) {
                logError(error, { component: 'DOMBatch', operation: 'flush' });
            }
        });

        logPerformance('DOMBatch', 'flush', performance.now() - startTime);

        this.operations = [];
        this.scheduled = false;
    }
}

const domBatch = new DOMBatch();

/**
 * Get comprehensive element information
 */
export function getElementInfo(element: HTMLElement): ElementInfo {
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
}

/**
 * Get native property descriptor for bypassing framework wrappers
 */
function getNativeValueSetter(element: HTMLInputElement | HTMLTextAreaElement): PropertyDescriptor | undefined {
    // Check for React's value descriptor first
    let descriptor = Object.getOwnPropertyDescriptor(element, 'value');

    if (!descriptor || !descriptor.set) {
        // Fallback to prototype chain
        descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
    }

    return descriptor && descriptor.set ? descriptor : undefined;
}

/**
 * Set value using native setter to bypass framework wrappers
 */
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    const descriptor = getNativeValueSetter(element);

    if (descriptor && descriptor.set) {
        descriptor.set.call(element, value);
    } else {
        // Fallback to direct assignment
        element.value = value;
    }
}

/**
 * Trigger comprehensive change events for framework compatibility
 */
function triggerFrameworkEvents(element: HTMLElement, inputValue?: string): void {
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
}

/**
 * Optimized form input update
 */
export const updateFormInput = withPerformanceMonitoring(
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
export const updateContentEditable = withPerformanceMonitoring(
    (element: HTMLElement, content: string, options: DOMUpdateOptions = {}): void => {
        const {
            focusAfterUpdate = true,
            triggerEvents = true,
            preserveSelection = false,
            batchUpdates = true
        } = options;

        const operation = () => {
            try {
                // Store current selection if preserving
                let savedSelection: Range | null = null;
                if (preserveSelection && document.activeElement === element) {
                    const selection = window.getSelection();
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

                // Restore or set selection
                const selection = window.getSelection();
                if (selection) {
                    if (savedSelection && preserveSelection) {
                        try {
                            selection.removeAllRanges();
                            selection.addRange(savedSelection);
                        } catch (error) {
                            // Fallback to end of content if restore fails
                            const range = document.createRange();
                            range.selectNodeContents(element);
                            range.collapse(false);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                    } else {
                        // Place cursor at end of content
                        const range = document.createRange();
                        range.selectNodeContents(element);
                        range.collapse(false);
                        selection.removeAllRanges();
                        selection.addRange(range);
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
export const updateElement = withPerformanceMonitoring(
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
export async function findElementWithRetry(
    selector: string,
    maxAttempts: number = 5,
    delay: number = 100
): Promise<HTMLElement | null> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const element = document.querySelector(selector) as HTMLElement;
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
}

/**
 * Batch multiple DOM updates for optimal performance
 */
export function batchDOMUpdates(updates: (() => void)[]): void {
    updates.forEach(update => domBatch.add(update));
}

/**
 * Force immediate execution of batched operations
 */
export function flushDOMBatch(): void {
    (domBatch as any).flush();
}
