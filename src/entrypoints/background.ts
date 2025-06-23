import { Config } from '@/lib/config';
import { generateRandomHexString } from '@/lib/generateRandomHexString';
import { getSettings } from '@/lib/settings';
import { sanitizeHTML, extractTextFromHTML } from '@/lib/sanitizer';

import { defineBackground } from 'wxt/utils/define-background';

interface ClickedElementData {
  tagName: string;
  id?: string;
  parentId?: string;
  classId: string;
  classList?: DOMTokenList; // In content script, this will be string[]
  innerHTML?: string;
  textContent?: string | null;
  src?: string;
  href?: string;
}

export default defineBackground(() => {
  console.log('ABScribe Background Service Worker Loaded.');

  let lastClickedElement: ClickedElementData | undefined = undefined;
  const mapTab = new Map<string, { tabId?: number; target?: ClickedElementData }>();

  chrome.runtime.onMessage.addListener((message: { action: string; element: ClickedElementData }, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    if (message.action === Config.ActionClickedElement) {
      lastClickedElement = message.element;
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

      // Use settings.editorUrl instead of hardcoded URL
      const popupUrl = new URL(settings.editorUrl);
      popupUrl.searchParams.set('secret', settings.activationKey);
      popupUrl.searchParams.set('key', key);
      popupUrl.searchParams.set('content', btoa(sanitizedContent || ''));

      chrome.windows.create({
        url: popupUrl.href,
        type: 'popup',
        width: 400,
        height: 600
      });
    }
  });

  chrome.runtime.onMessage.addListener(
    async (request: { message?: string; content?: string; key?: string }, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (request.message && request.message.startsWith(Config.Tag)) {
        try {
          const parsedData = JSON.parse(request.message.substring(Config.Tag.length));
          const { content, key } = parsedData;

          console.log("Background: Received message tagged for processing: ", { content, key });
          const value = mapTab.get(key);

          if (value && value.tabId && content !== undefined) {
            const { tabId, target } = value;
            if (!target) {
              console.warn("Background: No target element info found for key:", key);
              sendResponse({ status: "error", message: "Target element info missing." });
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
            // Clean up stored data and map entry
            await chrome.storage.local.remove(`popupData_${key}`);
            mapTab.delete(key);
            sendResponse({ status: "success", message: "Content updated." });
          } else {
            console.warn("Background: No tab/target info found for key, or content was undefined", { key, contentExists: content !== undefined });
            sendResponse({ status: "error", message: "Missing info for update." });
          }
        } catch (e: any) {
          console.error("Background: Error processing message:", e?.message || e);
          sendResponse({ status: "error", message: e?.message || "Unknown error" });
        }
      } else if (request.content && request.key) {
        // Handle direct content/key messages if needed (alternative to tagged messages)
        console.log("Background: Received direct content/key message (uncommon path)", request);
      }
      return true; // Indicate async response
    }
  );
});
