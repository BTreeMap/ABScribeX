/**
 * ABScribeX Page Helper - Consolidated script for all page-level functionality
 * This script provides global DOM utilities and handles element capture
 * Injected into every page to provide consistent functionality across the extension
 */

import { defineContentScript } from 'wxt/utils/define-content-script';
import { type DOMUpdateOptions, type ElementInfo } from '@/lib/domUtils';
import { generateIdentifier } from '@/lib/generateIdentifier';
import { type ContentWithMetadata } from '@/lib/config';
import { sanitizeHTML, extractTextFromHTML, createContentWithMetadata, isContentWithMetadata, type SanitizationOptions } from '@/lib/sanitizer';
import { stripStego } from '@/lib/stego';
import {
    MessageTypes,
    ClickedElementMessage,
    RequestEditorWindowMessage,
    SyncContentMessage,
    ClickedElementData,
    ResponseMessage,
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

        // Manage editor IDs that this page-helper is responsible for
        const managedEditorIds = new Set<string>();

        // Map of editor IDs to their corresponding elements
        const editorElementMap = new Map<string, HTMLElement>();

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

        const ABScribeX = window.ABScribeX!;

        // Populate the global DOM utilities object
        ABScribeX.dom = {
            // Element detection and information
            getElementInfo: pageHelpers.getElementInfo,
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
            sanitizeHTML: sanitizeHTML, // Expose the full overloaded API directly
            extractTextFromHTML: async (html: string) => {
                try {
                    return await extractTextFromHTML(html);
                } catch (error) {
                    console.error('ABScribe: Error extracting text:', error);
                    return html.replace(/<[^>]*>/g, '');
                }
            },

            // Content metadata helpers
            createContentWithMetadata,
            isContentWithMetadata
        };

        // Populate global utilities
        ABScribeX.utils = {
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


        console.log('ABScribe: Global Helper Functions Initialized', ABScribeX);

        // Listen for SYNC_CONTENT messages directed to this page
        chrome.runtime.onMessage.addListener(
            async (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
                if (message.type === MessageTypes.SYNC_CONTENT) {
                    const syncMessage = message as SyncContentMessage;
                    const { editorId, content } = syncMessage;

                    // Only process messages for editor IDs that this page manages
                    if (managedEditorIds.has(editorId)) {
                        try {
                            console.log(`ABScribe PageHelper: Processing SYNC_CONTENT for editorId: ${editorId}`);

                            const targetElement = editorElementMap.get(editorId);
                            if (!targetElement) {
                                console.warn(`ABScribe PageHelper: Target element not found for editorId: ${editorId}`);
                                const errorResponse = createMessage<ResponseMessage>(MessageTypes.ERROR, {
                                    status: "error",
                                    message: "Target element not found"
                                });
                                sendResponse(errorResponse);
                                return true;
                            }

                            // Ensure ABScribeX is available
                            if (!ABScribeX.dom) {
                                console.error('ABScribe PageHelper: Global DOM utilities not available');
                                const errorResponse = createMessage<ResponseMessage>(MessageTypes.ERROR, {
                                    status: "error",
                                    message: "DOM utilities not available"
                                });
                                sendResponse(errorResponse);
                                return true;
                            }

                            // Pre-sanitize content using the global sanitizer
                            // Content coming from background is already sanitized, so use it directly
                            const sanitizedContent = content.content; // Extract content string from ContentWithMetadata

                            // For textareas, we need to extract text content from HTML
                            const htmlWithLineBreaks = content.content.replace(/<br\s*\/?>/gi, '\r\n').replace(/<\/p>/gi, '</p>\r\n');
                            const textOnlyContent = await ABScribeX.dom.extractTextFromHTML(htmlWithLineBreaks);

                            // Use global DOM utilities to update the element
                            ABScribeX.dom.updateElement(targetElement, sanitizedContent, textOnlyContent);

                            console.log(`ABScribe PageHelper: Successfully updated element for editorId: ${editorId}`);

                            const successResponse = createMessage<ResponseMessage>(MessageTypes.SUCCESS, {
                                status: "success",
                                message: "Content updated successfully"
                            });
                            sendResponse(successResponse);

                        } catch (error) {
                            console.error(`ABScribe PageHelper: Error processing sync message for editorId ${editorId}:`, error);
                            const errorResponse = createMessage<ResponseMessage>(MessageTypes.ERROR, {
                                status: "error",
                                message: error instanceof Error ? error.message : "Unknown error"
                            });
                            sendResponse(errorResponse);
                        }
                    }
                    return true; // Indicate async response
                }
            }
        );

        // Wait for global DOM utilities to be available (for other scripts)
        const waitForABScribeX = () => {
            return pageHelpers.waitForGlobal<typeof ABScribeX>('ABScribeX');
        };

        // Helper function to find the highest editable element in the hierarchy
        const findHighestEditableElement = (element: HTMLElement): HTMLElement => {
            let current = element;
            let highestEditable = element;

            // Traverse up to find the highest editable element
            while (current.parentElement) {
                current = current.parentElement;
                if (ABScribeX.dom?.isEditable(current)) {
                    highestEditable = current;
                }
            }

            return highestEditable;
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
                    if (!ABScribeX.dom.isEditable(clickedElement)) {
                        console.log('ABScribe: Element is not editable, skipping.');
                        return;
                    }

                    // Find the highest editable element in the hierarchy
                    const targetElement = findHighestEditableElement(clickedElement);
                    console.log('ABScribe: Found target editable element:', targetElement.tagName);

                    // Check if this element already has an abscribex- editor ID
                    let editorId: string | null = null;
                    for (const className of targetElement.classList) {
                        if (className.startsWith('abscribex-')) {
                            editorId = className;
                            break;
                        }
                    }

                    // If no editor ID exists, create one
                    if (!editorId) {
                        editorId = ABScribeX.dom.generateElementId('abscribex-');
                        ABScribeX.dom.addElementClass(targetElement, editorId);
                        console.log('ABScribe: Assigned new editor ID:', editorId);
                    } else {
                        console.log('ABScribe: Using existing editor ID:', editorId);
                    }

                    // Register this editor ID with this page-helper
                    managedEditorIds.add(editorId);
                    editorElementMap.set(editorId, targetElement);

                    // Extract content from the target element and create ContentWithMetadata
                    let contentWithMetadata: ContentWithMetadata;
                    const elementType = targetElement.tagName.toLowerCase();

                    if (elementType === 'textarea') {
                        // For textarea, use the value property (already safe, no sanitization needed)
                        const rawContent = (targetElement as HTMLTextAreaElement).value || '';
                        contentWithMetadata = createContentWithMetadata(rawContent, elementType, true);
                    } else {
                        // For other elements, create unsanitized content first, then sanitize
                        const rawContent = targetElement.innerHTML || '';
                        const unsanitizedContent = createContentWithMetadata(rawContent, elementType, false);
                        // Use the direct sanitizeHTML function, not the global wrapper
                        contentWithMetadata = await sanitizeHTML(unsanitizedContent) as ContentWithMetadata;
                    }

                    // Send REQUEST_EDITOR_WINDOW message to background
                    const message = ABScribeX.utils.createMessage(MessageTypes.REQUEST_EDITOR_WINDOW, {
                        editorId,
                        content: contentWithMetadata  // Send the full ContentWithMetadata object
                    }) as RequestEditorWindowMessage;

                    console.log('ABScribe: Requesting editor window for editorId:', editorId);
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
            detail: { version: ABScribeX.version }
        }));
    }
});
