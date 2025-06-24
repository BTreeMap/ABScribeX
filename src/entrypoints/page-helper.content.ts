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
import { createPageHelpers } from '@/lib/pageHelpers';

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_start',
    world: 'MAIN',
    main() {
        console.log('ABScribe: Page helper initialized');

        // Create page helpers with proper browser context
        const pageHelpers = createPageHelpers();

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

        // Populate the global DOM utilities object
        window.ABScribeX.dom = {
            // Element detection and information
            getElementInfo,
            isEditable: pageHelpers.isEditable,
            findElementWithRetry: pageHelpers.findElementWithRetry,

            // Element manipulation (enhanced in-page versions)
            updateElement: pageHelpers.updateElement,
            updateFormInput: pageHelpers.updateFormInput,
            updateContentEditable: pageHelpers.updateContentEditable,

            // Event handling
            triggerFrameworkEvents: pageHelpers.triggerFrameworkEvents,
            setNativeValue: pageHelpers.setNativeValue,

            // Element identification and management
            generateElementId: generateIdentifier,
            addElementClass: pageHelpers.addElementClass,
            findABScribeElement: pageHelpers.findABScribeElement,

            // Performance and batching
            batchDOMUpdates: pageHelpers.batchDOMUpdates,
            flushDOMBatch: pageHelpers.flushDOMBatch,

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
            sleep: pageHelpers.sleep,
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

        console.log('ABScribe: Global Helper Functions Initialized', window.ABScribeX);

        // Wait for global DOM utilities to be available (for other scripts)
        const waitForABScribeX = () => {
            return pageHelpers.waitForGlobal<typeof window.ABScribeX>('ABScribeX');
        };

        // Context menu handler for element capture
        const handleContextMenu = withPerformanceMonitoring(
            async (event: MouseEvent) => {
                try {
                    // Ensure global utilities are available
                    await waitForABScribeX();

                    const clickedElement = event.target as HTMLElement;
                    if (!clickedElement || typeof clickedElement.tagName !== 'string') return;

                    const ABScribeX = window.ABScribeX!;

                    // Use global DOM utility to check if element is editable
                    if (!ABScribeX.dom.isEditable(clickedElement)) {
                        console.log('ABScribe: Element is not editable, skipping.');
                        return;
                    }

                    // Generate unique class ID using global utility
                    const classId = ABScribeX.dom.generateElementId('abscribex-');
                    ABScribeX.dom.addElementClass(clickedElement, classId);

                    // Find the highest priority class ID by traversing up the DOM hierarchy
                    let finalClassId = classId; // Will be the class ID we use for the element data
                    let targetElement = clickedElement; // Element to extract data from

                    // Use global utility to find existing ABScribe element
                    const parentElement = clickedElement.parentElement;
                    if (parentElement) {
                        const existingABScribeElement = ABScribeX.dom.findABScribeElement(parentElement);
                        if (existingABScribeElement) {
                            finalClassId = existingABScribeElement.classId;
                            targetElement = existingABScribeElement.element;
                            console.log('ABScribe: Found higher priority ABScribe element in hierarchy. Using existing element with class:', finalClassId, 'Target element:', targetElement.tagName);
                        }
                    }

                    // Find the named parent using helper function
                    const namedParent = pageHelpers.findNamedParent(targetElement);

                    const elementDetails: ClickedElementData = {
                        tagName: targetElement.tagName,
                        id: targetElement.id || undefined,
                        parentId: namedParent?.id || undefined,
                        classId: finalClassId,
                        actualClickedElementClassId: classId,
                        classList: Array.from(targetElement.classList),
                        // Sanitize HTML content using the global sanitizer
                        innerHTML: await ABScribeX.dom.sanitizeHTML(targetElement.innerHTML),
                        textContent: targetElement.textContent,
                        value: (targetElement as HTMLInputElement | HTMLTextAreaElement).value || undefined,
                        src: (targetElement as HTMLImageElement | HTMLMediaElement).src || undefined,
                        href: (targetElement as HTMLAnchorElement).href || undefined,
                    };

                    const message = ABScribeX.utils.createMessage(MessageTypes.CLICKED_ELEMENT, {
                        element: elementDetails,
                    }) as ClickedElementMessage;

                    console.log('ABScribe: Sending clicked element to background:', elementDetails);

                    await ABScribeX.utils.sendMessage(message);
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
