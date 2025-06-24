/**
 * ABScribeX Page Helper - Consolidated script for all page-level functionality
 * This script provides global DOM utilities and handles element capture
 * Injected into every page to provide consistent functionality across the extension
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
import {
    MessageTypes,
    ClickedElementMessage,
    ClickedElementData,
    createMessage,
    sendMessage
} from '@/lib/config';
import { logError, withPerformanceMonitoring } from '@/lib/errorHandler';

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_start',
    world: 'MAIN',
    main() {
        console.log('ABScribe: Page helper initialized');

        // Initialize global ABScribeX object if it doesn't exist
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

        // Helper functions for element identification and management
        function isEditable(element: HTMLElement): boolean {
            const elementInfo = getElementInfo(element);
            return elementInfo.isEditable;
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

        // Note: Framework event handling is now handled internally by domUtils.ts

        // Utility function for async operations
        function sleep(ms: number): Promise<void> {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        // Populate the global DOM utilities object
        window.ABScribeX.dom = {
            // Core DOM utilities (reusing from domUtils.ts)
            getElementInfo,
            updateElement,
            updateFormInput,
            updateContentEditable,
            findElementWithRetry,
            batchDOMUpdates,
            flushDOMBatch,

            // Element detection and management
            isEditable,
            addElementClass,
            findABScribeElement,

            // Element identification
            generateElementId: generateIdentifier,

            // Content processing utilities
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

        // Wait for global DOM utilities to be available (for other scripts)
        const waitForABScribeX = () => {
            return new Promise<void>((resolve) => {
                if (window.ABScribeX?.dom) {
                    resolve();
                    return;
                }

                const checkGlobal = () => {
                    if (window.ABScribeX?.dom) {
                        resolve();
                    } else {
                        setTimeout(checkGlobal, 10);
                    }
                };

                // Listen for the ready event
                window.addEventListener('ABScribeXReady', () => resolve(), { once: true });

                // Also poll as fallback
                checkGlobal();
            });
        };

        // Context menu handler for element capture
        const handleContextMenu = withPerformanceMonitoring(
            async (event: MouseEvent) => {
                try {
                    // Ensure global utilities are available
                    await waitForABScribeX();

                    const clickedElement = event.target as HTMLElement;
                    if (!clickedElement || typeof clickedElement.tagName !== 'string') return;

                    // Use global DOM utility to check if element is editable
                    if (!window.ABScribeX!.dom.isEditable(clickedElement)) {
                        console.log('ABScribe: Element is not editable, skipping.');
                        return;
                    }

                    // Generate unique class ID using global utility
                    const classId = window.ABScribeX!.dom.generateElementId('abscribex-');
                    window.ABScribeX!.dom.addElementClass(clickedElement, classId);

                    // Find the highest priority class ID by traversing up the DOM hierarchy
                    let finalClassId = classId; // Will be the class ID we use for the element data
                    let targetElement = clickedElement; // Element to extract data from

                    // Use global utility to find existing ABScribe element
                    const parentElement = clickedElement.parentElement;
                    if (parentElement) {
                        const existingABScribeElement = window.ABScribeX!.dom.findABScribeElement(parentElement);
                        if (existingABScribeElement) {
                            finalClassId = existingABScribeElement.classId;
                            targetElement = existingABScribeElement.element;
                            console.log('ABScribe: Found higher priority ABScribe element in hierarchy. Using existing element with class:', finalClassId, 'Target element:', targetElement.tagName);
                        }
                    }

                    let namedParent: HTMLElement | null = targetElement;
                    while (namedParent && !namedParent.id) {
                        if (namedParent.parentElement && namedParent.parentElement !== namedParent) {
                            namedParent = namedParent.parentElement;
                        } else {
                            namedParent = null;
                            break;
                        }
                    }

                    const elementDetails: ClickedElementData = {
                        tagName: targetElement.tagName,
                        id: targetElement.id || undefined,
                        parentId: namedParent?.id || undefined,
                        classId: finalClassId,
                        actualClickedElementClassId: classId,
                        classList: Array.from(targetElement.classList),
                        // Sanitize HTML content using the global sanitizer
                        innerHTML: await window.ABScribeX!.dom.sanitizeHTML(targetElement.innerHTML),
                        textContent: targetElement.textContent,
                        value: (targetElement as HTMLInputElement | HTMLTextAreaElement).value || undefined,
                        src: (targetElement as HTMLImageElement | HTMLMediaElement).src || undefined,
                        href: (targetElement as HTMLAnchorElement).href || undefined,
                    };

                    const message = window.ABScribeX!.utils.createMessage(MessageTypes.CLICKED_ELEMENT, {
                        element: elementDetails,
                    }) as ClickedElementMessage;

                    console.log('ABScribe: Sending clicked element to background:', elementDetails);

                    await window.ABScribeX!.utils.sendMessage(message);
                } catch (error) {
                    logError(error, {
                        component: 'PageHelper',
                        operation: 'handleContextMenu',
                        metadata: {
                            targetTagName: (event.target as HTMLElement)?.tagName,
                            url: window.location.href
                        }
                    });
                }
            },
            'PageHelper',
            'contextMenuHandler'
        );

        // Set up event listeners
        document.addEventListener('contextmenu', handleContextMenu, true);

        console.log('ABScribe: Global DOM utilities and element capture initialized successfully');

        // Dispatch a custom event to signal that ABScribeX is ready
        window.dispatchEvent(new CustomEvent('ABScribeXReady', {
            detail: { version: window.ABScribeX.version }
        }));
    }
});
