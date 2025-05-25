import DOMPurify from 'dompurify';
import { Config } from '@/lib/config';
import { generateRandomHexString } from '@/lib/generateRandomHexString';

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

let lastClickedElement: ClickedElementData | null = null;
const mapTab = new Map<string, { tabId: number; target: ClickedElementData }>();

chrome.runtime.onMessage.addListener((message: { action: string; element: ClickedElementData }, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  if (message.action === Config.ActionClickedElement) {
    lastClickedElement = message.element;
  }
  return true; // Keep message channel open for async response if needed
});

const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html);
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "my-extension-edit",
    title: "Edit with ABScribe",
    contexts: ["editable"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
  if (info.menuItemId === "my-extension-edit" && tab?.id && lastClickedElement) {
    const key = generateRandomHexString();
    mapTab.set(key, {
      tabId: tab.id,
      target: lastClickedElement,
    });

    let content = lastClickedElement.innerHTML || '';
    if (lastClickedElement.tagName.toLowerCase() === 'textarea') {
      content = content.replace(/\n/g, '<br/>');
    }
    const sanitizedContent = sanitizeHTML(content);

    const popupUrl = new URL(chrome.runtime.getURL('popup/index.html')); // Correct path to WXT popup
    popupUrl.searchParams.set('secret', Config.Secret);
    popupUrl.searchParams.set('key', key);
    // Store content in local storage for the popup to retrieve
    await chrome.storage.local.set({ [`popupData_${key}`]: { content: btoa(sanitizedContent || '') } });

    chrome.windows.create({
      url: popupUrl.href,
      type: 'popup',
      width: 800, // Adjusted width for a potentially richer editor
      height: 600,
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
          await chrome.scripting.executeScript(
            {
              target: { tabId: tabId },
              args: [content, target.classId, target.tagName],
              func: (scriptContent: string, elementClassId: string, elementTagName: string) => {
                const textOnly = (html: string): string => {
                  const htmlWithLineBreaks = html.replace(/<br\s*\/?>/gi, '\r\n').replace(/<\/p>/gi, '</p>\r\n');
                  const div = document.createElement('div');
                  // IMPORTANT: Content here is from the popup, ensure it's sanitized before innerHTML
                  div.innerHTML = DOMPurify.sanitize(htmlWithLineBreaks);
                  return div.textContent || '';
                };

                const elem = document.querySelector(`.${elementClassId}`) as HTMLElement | HTMLTextAreaElement;
                if (elem) {
                  if (elementTagName.toLowerCase() === 'textarea') {
                    (elem as HTMLTextAreaElement).value = textOnly(scriptContent);
                  } else {
                    // Content from popup should be sanitized before injection
                    elem.innerHTML = DOMPurify.sanitize(scriptContent);
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

export default defineBackground(() => {
  console.log('ABScribe Background Service Worker Loaded.');
  // WXT specific background setup can go here if needed.
  // Most Chrome event listeners are fine at the top level.
});
