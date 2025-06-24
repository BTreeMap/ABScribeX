import {
  MessageTypes,
  ClickedElementMessage,
  SyncContentMessage,
  ResponseMessage,
  ClickedElementData,
  ExtensionMessage,
  createMessage,
  ContentStorage
} from '@/lib/config';
import { generateIdentifier } from '@/lib/generateIdentifier';
import { getSettings } from '@/lib/settings';
import { sanitizeHTML, extractTextFromHTML } from '@/lib/sanitizer';
import { logError, withPerformanceMonitoring, withRetry } from '@/lib/errorHandler';

import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  console.log('ABScribe Background Service Worker Loaded.');

  let lastClickedElement: ClickedElementData | undefined = undefined;
  const mapTab = new Map<string, { tabId?: number; target?: ClickedElementData }>();

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    try {
      if (message.type === MessageTypes.CLICKED_ELEMENT) {
        const clickedMessage = message as ClickedElementMessage;
        lastClickedElement = clickedMessage.element;
        console.log('Background: Received clicked element:', lastClickedElement);
      }
    } catch (error) {
      logError(error, {
        component: 'Background',
        operation: 'onMessage_CLICKED_ELEMENT',
        metadata: { messageType: message.type }
      });
    }
    return true; // Keep message channel open for async response if needed
  });

  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "abscribex-edit-ert2oljan",
      title: "Edit with ABScribe",
      contexts: ["editable"]
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
    if (info.menuItemId === "abscribex-edit-ert2oljan") {
      try {
        console.log("ABScribe: Context menu clicked, preparing to open editor popup.");

        const settings = await withRetry(
          () => getSettings(),
          3,
          1000,
          'Background',
          'getSettings'
        );

        const key = generateIdentifier('popup-');
        console.log("ABScribe: Generated key for popup data:", key);

        mapTab.set(key, {
          tabId: tab?.id,
          target: lastClickedElement,
        });

        let content = lastClickedElement?.innerHTML || '';
        let sanitizedContent: string;

        if (lastClickedElement?.tagName.toLowerCase() === 'textarea') {
          // For textarea, use the value property directly without HTML sanitization
          content = lastClickedElement.value || '';
          sanitizedContent = content.replace(/\n/g, '<br/>');
        } else {
          sanitizedContent = await sanitizeHTML(content);
        }
        console.log("ABScribe: Sanitized content for popup, content length:", sanitizedContent.length);

        // Store content in chrome.ContentStorage.local instead of URL params
        await ContentStorage.storeContent(key, sanitizedContent);

        // Use settings.editorUrl without deprecated base64 content param
        const popupUrl = new URL(settings.editorUrl);
        popupUrl.searchParams.set('secret', settings.activationKey);
        popupUrl.searchParams.set('key', key);

        chrome.windows.create({
          url: popupUrl.href,
          type: 'popup',
          width: 400,
          height: 600
        });
      } catch (error) {
        logError(error, {
          component: 'Background',
          operation: 'contextMenuClicked',
          metadata: { menuItemId: info.menuItemId }
        });
      }
    }
  });

  chrome.runtime.onMessage.addListener(
    async (request: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (request.type === MessageTypes.SYNC_CONTENT) {
        const syncMessage = request as SyncContentMessage;

        try {
          const { content, key } = syncMessage;

          console.log("Background: Received sync content message: ", { content, key });
          const value = mapTab.get(key);
          console.log("Background: Retrieved mapTab entry for key:", key, value);

          if (value && value.tabId && content !== undefined) {
            const { tabId, target } = value;
            if (!target) {
              console.warn("Background: No target element info found for key:", key);
              const errorResponse = createMessage<ResponseMessage>(MessageTypes.ERROR, {
                status: "error",
                message: "Target element info missing."
              });
              sendResponse(errorResponse);
              return true; // Indicate async response
            }
            // Pre-sanitize content in background script using offscreen API
            const sanitizedContent = await sanitizeHTML(content);

            // For textareas, we need to extract text content from HTML
            const htmlWithLineBreaks = content.replace(/<br\s*\/?>/gi, '\r\n').replace(/<\/p>/gi, '</p>\r\n');
            const textOnlyContent = await extractTextFromHTML(htmlWithLineBreaks);

            await chrome.scripting.executeScript(
              {
                target: { tabId: tabId },
                args: [sanitizedContent, textOnlyContent, target.classId, target.tagName],
                func: (sanitizedHtmlContent: string, textContent: string, elementClassId: string, elementTagName: string) => {
                  /**
                   * Enhanced DOM update utility using ABScribeX global DOM utils
                   */
                  try {
                    const elem = document.querySelector(`.${elementClassId}`) as HTMLElement;
                    if (!elem) {
                      console.warn("ABScribe: Target element not found with classId:", elementClassId);
                      return;
                    }

                    // Use global ABScribeX DOM utilities (should always be available via page-helper)
                    if (window.ABScribeX?.dom?.updateElement) {
                      // Use the global DOM utilities from page-helper
                      window.ABScribeX.dom.updateElement(elem, sanitizedHtmlContent, textContent);
                      console.log("ABScribe: Content updated using global DOM utilities for element with classId:", elementClassId);
                    } else {
                      console.error("ABScribe: Global DOM utilities not available - page-helper may not be loaded");
                    }

                  } catch (error) {
                    console.error("ABScribe: Error updating element:", error);
                  }
                },
              }
            );
            console.log("Background: Content modification script executed.");
            // Clean up stored data and map entry using ContentStorage utility
            // await ContentStorage.removeContent(key);
            // mapTab.delete(key);

            const successResponse = createMessage<ResponseMessage>(MessageTypes.SUCCESS, {
              status: "success",
              message: "Content updated."
            });
            sendResponse(successResponse);
          } else {
            console.warn("Background: No tab/target info found for key, or content was undefined", { key, contentExists: content !== undefined });
            const errorResponse = createMessage<ResponseMessage>(MessageTypes.ERROR, {
              status: "error",
              message: "Missing info for update."
            });
            sendResponse(errorResponse);
          }
        } catch (e: any) {
          console.error("Background: Error processing message:", e?.message || e);
          const errorResponse = createMessage<ResponseMessage>(MessageTypes.ERROR, {
            status: "error",
            message: e?.message || "Unknown error"
          });
          sendResponse(errorResponse);
        }
      }
      return true; // Indicate async response
    }
  );
});
