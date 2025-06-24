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

import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  console.log('ABScribe Background Service Worker Loaded.');

  let lastClickedElement: ClickedElementData | undefined = undefined;
  const mapTab = new Map<string, { tabId?: number; target?: ClickedElementData }>();

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    if (message.type === MessageTypes.CLICKED_ELEMENT) {
      const clickedMessage = message as ClickedElementMessage;
      lastClickedElement = clickedMessage.element;
      console.log('Background: Received clicked element:', lastClickedElement);
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
      console.log("ABScribe: Context menu clicked, preparing to open editor popup.");

      const settings = await getSettings();
      const key = generateIdentifier('popup-');
      console.log("ABScribe: Generated key for popup data:", key);

      mapTab.set(key, {
        tabId: tab?.id,
        target: lastClickedElement,
      });

      let content = lastClickedElement?.innerHTML || '';
      if (lastClickedElement?.tagName.toLowerCase() === 'textarea') {
        content = content.replace(/\n/g, '<br/>');
      }
      const sanitizedContent = await sanitizeHTML(content);

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
                   * Simple, framework-agnostic DOM update utility
                   * Works with React, Vue, Angular, Svelte by using native APIs and essential events
                   */

                  // Get native property setter to bypass framework wrappers
                  function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
                    const descriptor = Object.getOwnPropertyDescriptor(element, 'value') ||
                      Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');

                    if (descriptor && descriptor.set) {
                      // Use native setter to bypass React/framework wrappers
                      descriptor.set.call(element, value);
                    } else {
                      // Fallback to direct assignment
                      element.value = value;
                    }
                  }

                  // Trigger essential events that frameworks expect
                  function triggerChangeEvents(element: HTMLElement, inputValue?: string): void {
                    // Create and dispatch input event (modern standard)
                    const inputEvent = new InputEvent('input', {
                      bubbles: true,
                      cancelable: false,
                      inputType: 'insertText',
                      data: inputValue || null,
                      composed: true
                    });
                    element.dispatchEvent(inputEvent);

                    // Create and dispatch change event (traditional)
                    const changeEvent = new Event('change', {
                      bubbles: true,
                      cancelable: true
                    });
                    element.dispatchEvent(changeEvent);
                  }

                  // Update form inputs (input, textarea)
                  function updateFormInput(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
                    // Focus element to ensure it's active
                    element.focus();

                    // Set value using native setter
                    setNativeValue(element, value);

                    // Trigger events that frameworks listen for
                    triggerChangeEvents(element, value);

                    // Brief blur to commit the change
                    setTimeout(() => element.blur(), 10);
                  }

                  // Update contenteditable elements
                  function updateContentEditable(element: HTMLElement, content: string): void {
                    // Focus the element
                    element.focus();

                    // Update content
                    element.innerHTML = content;

                    // Place cursor at end of content
                    const selection = window.getSelection();
                    if (selection) {
                      const range = document.createRange();
                      range.selectNodeContents(element);
                      range.collapse(false); // Collapse to end
                      selection.removeAllRanges();
                      selection.addRange(range);
                    }

                    // Trigger change events
                    triggerChangeEvents(element);
                  }

                  // Main execution
                  try {
                    const elem = document.querySelector(`.${elementClassId}`) as HTMLElement;
                    if (!elem) {
                      console.warn("ABScribe: Target element not found with classId:", elementClassId);
                      return;
                    }

                    // Ensure element is visible
                    if (elem.style.display === 'none') {
                      elem.style.display = '';
                    }

                    const tagName = elementTagName.toLowerCase();

                    // Determine element type and update accordingly
                    if (tagName === 'textarea' || tagName === 'input') {
                      // Handle form inputs
                      updateFormInput(elem as HTMLInputElement | HTMLTextAreaElement, textContent);
                    } else if (elem.contentEditable === 'true' || elem.isContentEditable) {
                      // Handle contenteditable elements
                      updateContentEditable(elem, sanitizedHtmlContent);
                    } else {
                      // Handle other elements (divs, spans, etc.) - simple assignment
                      elem.innerHTML = sanitizedHtmlContent;
                      triggerChangeEvents(elem);
                    }

                    console.log("ABScribe: Content updated for element with classId:", elementClassId);

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
