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
import { generateRandomHexString } from '@/lib/generateRandomHexString';
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
      const key = generateRandomHexString();
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
                  const elem = document.querySelector(`.${elementClassId}`) as HTMLElement | HTMLTextAreaElement;
                  if (elem) {
                    if (elementTagName.toLowerCase() === 'textarea') {
                      (elem as HTMLTextAreaElement).value = textContent;
                    } else {
                      // Content is already sanitized in background script
                      elem.innerHTML = sanitizedHtmlContent;
                    }
                  } else {
                    console.warn("Background script: Target element not found on page with classId:", elementClassId);
                  }
                },
              }
            );
            console.log("Background: Content modification script executed.");
            // Clean up stored data and map entry using ContentStorage utility
            await ContentStorage.removeContent(key);
            mapTab.delete(key);

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
