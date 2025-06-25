/**
 * ABScribeX Page Helper - Consolidated script for all page-level functionality
 * This script provides global DOM utilities and handles element capture
 * Injected into every page to provide consistent functionality across the extension
 */

import { defineContentScript } from 'wxt/utils/define-content-script';
import { generateIdentifier } from '@/lib/generateIdentifier';
import { sanitizeHTML, extractTextFromHTML, createContentWithMetadata, isContentWithMetadata } from '@/lib/sanitizer';
import { stripStego } from '@/lib/stego';
import {
  MessageTypes,
  RequestEditorWindowMessage,
  // ContextMenuClickedMessage,
  SyncContentMessage,
  ResponseMessage,
  createMessage,
  sendMessage
} from '@/lib/config';
import { logError, withPerformanceMonitoring } from '@/lib/errorHandler';
import { createPageHelpers } from '@/lib/pageHelpers';
import { extractContent } from '@/lib/utils';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
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

    // Track the last right-clicked element for context menu
    let lastRightClickedElement: HTMLElement | null = null;

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

    // Track right-clicked elements for context menu
    document.addEventListener('contextmenu', (event: MouseEvent) => {
      const clickedElement = event.target as HTMLElement;
      if (clickedElement) {
        // Just track the clicked element, defer editability checks to handleElementCapture
        lastRightClickedElement = clickedElement;
        console.log('ABScribe: Tracked right-clicked element:', clickedElement.tagName);
      } else {
        console.log('ABScribe: Right-clicked element is null or undefined');
        lastRightClickedElement = null;
      }
    }, true);

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener(
      async (message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        // Handle context menu clicked message from background
        if (message.type === MessageTypes.CONTEXT_MENU_CLICKED) {
          // const contextMenuMessage = message as ContextMenuClickedMessage;
          console.log('ABScribe: Context menu clicked message received, starting element capture');

          // Use the tracked right-clicked element if available
          if (lastRightClickedElement) {
            console.log('ABScribe: Using tracked right-clicked element:', lastRightClickedElement.tagName);
            handleElementCapture(lastRightClickedElement).catch(error => {
              logError(error, {
                component: 'PageHelper',
                operation: 'contextMenuMessageHandler',
                metadata: { element: lastRightClickedElement?.tagName }
              });
            });
          } else {
            console.log('ABScribe: No tracked right-clicked element found');
          }
          return; // No response needed for this message
        }

        // Handle sync content messages
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
        if (ABScribeX.dom.isEditable(current)) {
          highestEditable = current;
        }
      }

      return highestEditable;
    };

    // Element capture handler for when context menu is clicked
    const handleElementCapture = withPerformanceMonitoring(
      async (targetElement: HTMLElement) => {
        try {
          // Ensure global utilities are available
          await waitForABScribeX();

          // Use the provided target element directly
          console.log('ABScribe: Processing target element:', targetElement.tagName);

          // First check if the element or any parent is editable
          if (!ABScribeX.dom.isEditable(targetElement)) {
            // Try to find an editable parent
            let current = targetElement.parentElement;
            let foundEditable = false;

            while (current && current !== document.body) {
              if (ABScribeX.dom.isEditable(current)) {
                targetElement = current;
                foundEditable = true;
                break;
              }
              current = current.parentElement;
            }

            if (!foundEditable) {
              console.log('ABScribe: No editable element found in hierarchy');
              return;
            }
            console.log('ABScribe: Found editable parent element:', targetElement);
          }

          // Find the highest editable element in the hierarchy
          targetElement = findHighestEditableElement(targetElement);
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
          const elementType = targetElement.tagName.toLowerCase();
          const rawContent = extractContent(targetElement);
          const contentWithMetadata = await ABScribeX.dom.sanitizeHTML(createContentWithMetadata(rawContent, elementType));

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
            operation: 'handleElementCapture',
            metadata: {
              url: window.location.href,
              elementTag: targetElement?.tagName
            }
          });
        }
      },
      'PageHelper',
      'elementCaptureHandler'
    );

    console.log('ABScribe: Global DOM utilities and element capture initialized successfully');

    // Dispatch a custom event to signal that ABScribeX is ready
    window.dispatchEvent(new CustomEvent('ABScribeXReady', {
      detail: { version: ABScribeX.version }
    }));
  }
});
