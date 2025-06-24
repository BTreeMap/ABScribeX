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
                   * Self-contained framework-compatible DOM update utility
                   * Works with React, Vue, Angular, Svelte and other virtual DOM frameworks
                   * All code is contained within this function since it runs in the target page context
                   */

                  // Detect framework presence on the page
                  function detectFramework(): string[] {
                    const frameworks: string[] = [];

                    // React detection
                    if ((window as any).React ||
                      document.querySelector('[data-reactroot]') ||
                      document.querySelector('[data-react-helmet]') ||
                      Object.keys(window).some(key => key.startsWith('__REACT'))) {
                      frameworks.push('react');
                    }

                    // Vue detection
                    if ((window as any).Vue ||
                      document.querySelector('[data-v-]') ||
                      document.querySelector('.v-')) {
                      frameworks.push('vue');
                    }

                    // Angular detection
                    if ((window as any).ng ||
                      document.querySelector('[ng-app]') ||
                      document.querySelector('[ng-version]') ||
                      document.querySelector('ng-component')) {
                      frameworks.push('angular');
                    }

                    // Svelte detection
                    if (document.querySelector('[class*="svelte-"]')) {
                      frameworks.push('svelte');
                    }

                    return frameworks;
                  }

                  // Get React fiber node for direct React updates
                  function getReactFiber(element: HTMLElement): any {
                    const keys = Object.keys(element);
                    const fiberKey = keys.find(key =>
                      key.startsWith('__reactFiber') ||
                      key.startsWith('__reactInternalInstance')
                    );
                    return fiberKey ? (element as any)[fiberKey] : null;
                  }

                  // Get Vue instance from element
                  function getVueInstance(element: HTMLElement): any {
                    return (element as any).__vue__ || (element as any).__vueParentComponent;
                  }

                  // Advanced event simulation for modern frameworks
                  function simulateUserInput(element: HTMLElement, value: string): void {
                    // Sequence of events that simulate real user interaction
                    const events = [
                      { type: 'focusin', bubbles: true },
                      { type: 'focus', bubbles: false },
                      { type: 'keydown', key: 'a', code: 'KeyA', bubbles: true },
                      { type: 'keypress', key: 'a', code: 'KeyA', bubbles: true },
                      { type: 'beforeinput', inputType: 'insertText', data: value, bubbles: true },
                      { type: 'input', inputType: 'insertText', data: value, bubbles: true },
                      { type: 'keyup', key: 'a', code: 'KeyA', bubbles: true },
                      { type: 'change', bubbles: true },
                      { type: 'blur', bubbles: false },
                      { type: 'focusout', bubbles: true }
                    ];

                    events.forEach((eventConfig, index) => {
                      setTimeout(() => {
                        let event: Event;

                        if (eventConfig.type.includes('key')) {
                          event = new KeyboardEvent(eventConfig.type, {
                            bubbles: eventConfig.bubbles,
                            cancelable: true,
                            key: (eventConfig as any).key,
                            code: (eventConfig as any).code,
                            composed: true
                          });
                        } else if (eventConfig.type.includes('input')) {
                          event = new InputEvent(eventConfig.type, {
                            bubbles: eventConfig.bubbles,
                            cancelable: eventConfig.type === 'beforeinput',
                            inputType: (eventConfig as any).inputType,
                            data: (eventConfig as any).data,
                            composed: true
                          });
                        } else if (eventConfig.type.includes('focus')) {
                          event = new FocusEvent(eventConfig.type, {
                            bubbles: eventConfig.bubbles,
                            cancelable: true
                          });
                        } else {
                          event = new Event(eventConfig.type, {
                            bubbles: eventConfig.bubbles,
                            cancelable: true
                          });
                        }

                        // Mark as trusted for framework recognition
                        Object.defineProperty(event, 'isTrusted', { value: true, writable: false });

                        element.dispatchEvent(event);
                      }, index * 10); // Small delays between events
                    });
                  }

                  // React-specific value update
                  function updateReactElement(element: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
                    try {
                      const fiber = getReactFiber(element);
                      if (!fiber) return false;

                      // Get the native setter bypassing React's wrapper
                      const descriptor = Object.getOwnPropertyDescriptor(element, 'value') ||
                        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');

                      if (descriptor && descriptor.set) {
                        descriptor.set.call(element, value);
                      } else {
                        element.value = value;
                      }

                      // Trigger React's internal state update
                      simulateUserInput(element, value);

                      // Force React to reconcile
                      if (fiber.memoizedProps && fiber.memoizedProps.onChange) {
                        const syntheticEvent = {
                          target: element,
                          currentTarget: element,
                          type: 'change',
                          bubbles: true,
                          preventDefault: () => { },
                          stopPropagation: () => { }
                        };
                        fiber.memoizedProps.onChange(syntheticEvent);
                      }

                      return true;
                    } catch (e) {
                      console.warn('React update failed:', e);
                      return false;
                    }
                  }

                  // Vue-specific value update
                  function updateVueElement(element: HTMLInputElement | HTMLTextAreaElement, value: string): boolean {
                    try {
                      const vueInstance = getVueInstance(element);
                      if (!vueInstance) return false;

                      // Update the element value
                      element.value = value;

                      // Trigger Vue's reactivity system
                      simulateUserInput(element, value);

                      // Force Vue to update if we have access to the component
                      if (vueInstance.$forceUpdate) {
                        vueInstance.$forceUpdate();
                      }

                      return true;
                    } catch (e) {
                      console.warn('Vue update failed:', e);
                      return false;
                    }
                  }

                  // Universal form element update with framework detection
                  function updateFormElement(element: HTMLInputElement | HTMLTextAreaElement, value: string): void {
                    const frameworks = detectFramework();
                    let success = false;

                    // Try framework-specific updates first
                    if (frameworks.includes('react')) {
                      success = updateReactElement(element, value);
                    }

                    if (!success && frameworks.includes('vue')) {
                      success = updateVueElement(element, value);
                    }

                    // Fallback to generic approach for Angular, Svelte, or unknown frameworks
                    if (!success) {
                      // Clear and set value using multiple approaches
                      element.focus();

                      // Method 1: Native property descriptor
                      const descriptor = Object.getOwnPropertyDescriptor(element, 'value') ||
                        Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');

                      if (descriptor && descriptor.set) {
                        descriptor.set.call(element, '');
                        descriptor.set.call(element, value);
                      } else {
                        element.value = '';
                        element.value = value;
                      }

                      // Method 2: Simulate complete user interaction
                      simulateUserInput(element, value);

                      // Method 3: Additional framework-agnostic events
                      ['input', 'change', 'blur'].forEach(eventType => {
                        const event = new Event(eventType, { bubbles: true, cancelable: true });
                        Object.defineProperty(event, 'isTrusted', { value: true, writable: false });
                        element.dispatchEvent(event);
                      });
                    }
                  }

                  // Content editable update with framework compatibility
                  function updateContentEditable(element: HTMLElement, content: string): void {
                    const frameworks = detectFramework();

                    // Store selection state
                    const selection = window.getSelection();
                    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

                    element.focus();

                    // For framework-heavy pages, try document.execCommand first (if available)
                    if (frameworks.length > 0 && (document as any).execCommand) {
                      try {
                        // Select all content
                        const selectAllRange = document.createRange();
                        selectAllRange.selectNodeContents(element);
                        selection?.removeAllRanges();
                        selection?.addRange(selectAllRange);

                        // Use execCommand for better framework compatibility
                        (document as any).execCommand('insertHTML', false, content);
                      } catch (e) {
                        // Fallback to direct manipulation
                        element.innerHTML = content;
                      }
                    } else {
                      // Direct manipulation for modern browsers
                      element.innerHTML = content;
                    }

                    // Restore or set cursor to end
                    if (range) {
                      try {
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                      } catch (e) {
                        const newRange = document.createRange();
                        newRange.selectNodeContents(element);
                        newRange.collapse(false);
                        selection?.removeAllRanges();
                        selection?.addRange(newRange);
                      }
                    }

                    // Comprehensive event sequence for contenteditable
                    const events = [
                      new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: content, composed: true }),
                      new InputEvent('input', { bubbles: true, cancelable: false, inputType: 'insertText', data: content, composed: true }),
                      new Event('change', { bubbles: true, cancelable: true }),
                      new CustomEvent('DOMContentChanged', { bubbles: true, detail: { element, content } })
                    ];

                    events.forEach(event => {
                      try {
                        Object.defineProperty(event, 'isTrusted', { value: true, writable: false });
                        element.dispatchEvent(event);
                      } catch (e) {
                        // Some events might not be supported in all browsers
                      }
                    });
                  }

                  // Main execution logic
                  try {
                    const elem = document.querySelector(`.${elementClassId}`) as HTMLElement;
                    if (!elem) {
                      console.warn("ABScribe: Target element not found with classId:", elementClassId);
                      return;
                    }

                    const frameworks = detectFramework();
                    console.log("ABScribe: Detected frameworks:", frameworks);

                    // Ensure element is visible and focusable
                    if (elem.style.display === 'none') {
                      elem.style.display = '';
                    }

                    const tagName = elementTagName.toLowerCase();
                    const isFormInput = tagName === 'textarea' ||
                      tagName === 'input' ||
                      (elem as HTMLInputElement).type === 'text' ||
                      (elem as HTMLInputElement).type === 'email' ||
                      (elem as HTMLInputElement).type === 'password' ||
                      (elem as HTMLInputElement).type === 'search' ||
                      (elem as HTMLInputElement).type === 'tel' ||
                      (elem as HTMLInputElement).type === 'url';

                    if (isFormInput) {
                      // Handle form elements with framework-aware updates
                      updateFormElement(elem as HTMLInputElement | HTMLTextAreaElement, textContent);
                    } else if (elem.contentEditable === 'true' || elem.isContentEditable) {
                      // Handle contenteditable elements
                      updateContentEditable(elem, sanitizedHtmlContent);
                    } else {
                      // Handle other elements (divs, spans, etc.)
                      elem.innerHTML = sanitizedHtmlContent;

                      // Basic change notification
                      const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                      Object.defineProperty(changeEvent, 'isTrusted', { value: true, writable: false });
                      elem.dispatchEvent(changeEvent);
                    }

                    // Final commit with delayed blur for framework processing
                    setTimeout(() => {
                      if (document.activeElement === elem) {
                        elem.blur();
                      }
                      console.log("ABScribe: Content updated for element with classId:", elementClassId);
                    }, 100);

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
