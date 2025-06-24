/**
 * Global DOM utilities initialization for ABScribeX
 * This script injects the comprehensive DOM utilities into the window.ABScribeX object
 * making them available to all other injected scripts without direct imports
 */

import { defineContentScript } from 'wxt/utils/define-content-script';
import {
    getElementInfo,
    updateElement,
    updateFormInput,
    updateContentEditable,
    findElementWithRetry,
    batchDOMUpdates,
    flushDOMBatch,
    type DOMUpdateOptions,
    type ElementInfo
} from '@/lib/domUtils';
import { generateIdentifier } from '@/lib/generateIdentifier';
import { sanitizeHTML, extractTextFromHTML } from '@/lib/sanitizer';
import { stripStego } from '@/lib/stego';
import { createMessage, sendMessage } from '@/lib/config';
import { logError, withPerformanceMonitoring } from '@/lib/errorHandler';

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_start',
    world: 'MAIN',
    main() {
        console.log('ABScribe: Initializing global DOM utilities');

        // Ensure ABScribeX global object exists
        if (!window.ABScribeX) {
            window.ABScribeX = {
                version: '1.0.0',
                diagnostics: {
                    errors: [],
                    performance: [],
                    storage: 0
                },
                dom: {} as any,
                utils: {} as any
            };
        }

        // Internal helper functions (not exposed globally)
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
                    console.error('ABScribe: Error triggering framework event:', error);
                }
            });
        }

        function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
            // Get native property descriptor for bypassing framework wrappers
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

        function isEditable(element: HTMLElement): boolean {
            const tagName = element.tagName.toLowerCase();
            const isFormInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
            const isContentEditable = element.contentEditable === 'true' || element.isContentEditable;
            return isFormInput || isContentEditable;
        }

        function addElementClass(element: HTMLElement, classId: string): void {
            if (!element.classList.contains(classId)) {
                element.classList.add(classId);
            }
        }

        function findABScribeElement(startElement: HTMLElement): { element: HTMLElement; classId: string } | null {
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
        }

        // Simplified in-page DOM utilities (synchronous versions for global access)
        function updateElementInPage(element: HTMLElement, content: string, textContent?: string, options: DOMUpdateOptions = {}): void {
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

                // Set cursor at end
                const selection = window.getSelection();
                if (selection) {
                    const range = document.createRange();
                    range.selectNodeContents(element);
                    range.collapse(false);
                    selection.removeAllRanges();
                    selection.addRange(range);
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
        }

        function updateFormInputInPage(element: HTMLInputElement | HTMLTextAreaElement, value: string, options: DOMUpdateOptions = {}): void {
            if (options.focusAfterUpdate !== false) {
                element.focus();
            }

            setNativeValue(element, value);

            if (options.triggerEvents !== false) {
                triggerFrameworkEvents(element, value);
            }
        }

        function updateContentEditableInPage(element: HTMLElement, content: string, options: DOMUpdateOptions = {}): void {
            if (options.focusAfterUpdate !== false) {
                element.focus();
            }

            element.innerHTML = content;

            // Set cursor at end
            const selection = window.getSelection();
            if (selection) {
                const range = document.createRange();
                range.selectNodeContents(element);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }

            if (options.triggerEvents !== false) {
                triggerFrameworkEvents(element);
            }
        }

        async function findElementWithRetryInPage(selector: string, maxAttempts: number = 5, delay: number = 100): Promise<HTMLElement | null> {
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const element = document.querySelector(selector) as HTMLElement;
                if (element) {
                    return element;
                }

                if (attempt < maxAttempts - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            return null;
        }

        // Simple batching for in-page operations
        const domOperations: (() => void)[] = [];
        let batchScheduled = false;

        function scheduleBatch(): void {
            if (!batchScheduled) {
                batchScheduled = true;
                requestAnimationFrame(() => {
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
        }

        function batchDOMUpdatesInPage(updates: (() => void)[]): void {
            domOperations.push(...updates);
            scheduleBatch();
        }

        function flushDOMBatchInPage(): void {
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
        }

        // Sleep utility
        function sleep(ms: number): Promise<void> {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // Populate the global DOM utilities
        window.ABScribeX.dom = {
            // Element detection and information
            getElementInfo,
            isEditable,
            findElementWithRetry: findElementWithRetryInPage,

            // Element manipulation (in-page versions)
            updateElement: updateElementInPage,
            updateFormInput: updateFormInputInPage,
            updateContentEditable: updateContentEditableInPage,

            // Event handling
            triggerFrameworkEvents,
            setNativeValue,

            // Element identification and management
            generateElementId: generateIdentifier,
            addElementClass,
            findABScribeElement,

            // Performance and batching
            batchDOMUpdates: batchDOMUpdatesInPage,
            flushDOMBatch: flushDOMBatchInPage,

            // Utility functions (these return promises but are available)
            stripStego,
            sanitizeHTML: async (html: string, options?: any) => {
                try {
                    return await sanitizeHTML(html, options);
                } catch (error) {
                    console.error('ABScribe: Error sanitizing HTML:', error);
                    return html.replace(/<[^>]*>/g, '');
                }
            },
            extractTextFromHTML: async (html: string) => {
                try {
                    return await extractTextFromHTML(html);
                } catch (error) {
                    console.error('ABScribe: Error extracting text:', error);
                    return html.replace(/<[^>]*>/g, '');
                }
            }
        };

        // Populate global utilities
        window.ABScribeX.utils = {
            generateIdentifier,
            sleep,
            createMessage: (type: string, data: any) => createMessage(type as any, data),
            sendMessage: async (message: any) => {
                try {
                    return await sendMessage(message);
                } catch (error) {
                    console.error('ABScribe: Error sending message:', error);
                    return null;
                }
            }
        };

        console.log('ABScribe: Global DOM utilities initialized successfully');

        // Dispatch a custom event to signal that ABScribeX is ready
        window.dispatchEvent(new CustomEvent('ABScribeXReady', {
            detail: { version: window.ABScribeX.version }
        }));
    }
});
