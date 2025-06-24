import {
  MessageTypes,
  RequestEditorWindowMessage,
  SyncContentMessage,
  ResponseMessage,
  ExtensionMessage,
  createMessage,
  ContentStorage,
  ContentWithMetadata
} from '@/lib/config';
import { getSettings } from '@/lib/settings';
import { sanitizeHTML } from '@/lib/sanitizer';
import { logError, withRetry } from '@/lib/errorHandler';

import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  console.log('ABScribe Background Service Worker Loaded.');

  // Enhanced tracking for active editor windows with originating tab information
  interface EditorWindowInfo {
    windowId: number;
    originTabId: number;
  }

  const activeEditorWindows = new Map<string, EditorWindowInfo>(); // editorId -> {windowId, originTabId}

  /**
   * Handle SYNC_CONTENT messages by sending them directly to the originating tab
   * using the tracked window information for efficiency
   */
  const handleSyncContentMessage = async (
    message: SyncContentMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> => {
    const { editorId } = message;
    console.log(`Background: Processing SYNC_CONTENT message for editorId: ${editorId}`);

    try {
      // Look up the editor window info to get the originating tab
      const editorInfo = activeEditorWindows.get(editorId);

      if (!editorInfo) {
        const errorResponse = createMessage<ResponseMessage>(MessageTypes.ERROR, {
          status: "error",
          message: `No active editor found for editorId: ${editorId}`
        });
        sendResponse(errorResponse);
        return;
      }

      try {
        // Send message directly to the originating tab - much more efficient than broadcasting
        const response = await chrome.tabs.sendMessage(editorInfo.originTabId, message);
        console.log(`Background: Received response from originating tab ${editorInfo.originTabId}:`, response);
        sendResponse(response);
      } catch (error) {
        console.error(`Background: Error sending to originating tab ${editorInfo.originTabId}:`, error);
        const errorResponse = createMessage<ResponseMessage>(MessageTypes.ERROR, {
          status: "error",
          message: `Failed to communicate with originating tab: ${error instanceof Error ? error.message : "Unknown error"}`
        });
        sendResponse(errorResponse);
      }
    } catch (error) {
      console.error(`Background: Error processing SYNC_CONTENT message:`, error);
      const errorResponse = createMessage<ResponseMessage>(MessageTypes.ERROR, {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error"
      });
      sendResponse(errorResponse);
    }
  };

  /**
   * Handle requests to open editor windows
   */
  const handleEditorWindowRequest = async (request: RequestEditorWindowMessage, sender: chrome.runtime.MessageSender): Promise<void> => {
    const { editorId, content } = request;

    console.log(`Background: Processing editor window request for editorId: ${editorId}`);

    // Check if there's already an active window for this editor ID
    const existingWindowInfo = activeEditorWindows.get(editorId);
    if (existingWindowInfo) {
      try {
        // Try to focus the existing window
        await chrome.windows.update(existingWindowInfo.windowId, { focused: true });
        console.log(`Background: Focused existing window ${existingWindowInfo.windowId} for editorId: ${editorId}`);
        return;
      } catch (error) {
        // Window might have been closed, remove from tracking
        activeEditorWindows.delete(editorId);
        console.log(`Background: Existing window ${existingWindowInfo.windowId} no longer exists, creating new one`);
      }
    }

    // Get settings for editor URL
    const settings = await withRetry(
      () => getSettings(),
      3,
      1000,
      'Background',
      'getSettings'
    );

    // Store content using the editorId as the key
    // Content is already ContentWithMetadata, ensure it's sanitized
    let sanitizedContent: ContentWithMetadata;
    if (content.isSanitized) {
      sanitizedContent = content;
    } else {
      sanitizedContent = await sanitizeHTML(content) as ContentWithMetadata;
    }
    await ContentStorage.storeContent(editorId, sanitizedContent);

    // Create editor URL with editorId instead of random key
    const popupUrl = new URL(settings.editorUrl);
    popupUrl.searchParams.set('secret', settings.activationKey);
    popupUrl.searchParams.set('key', editorId); // Use editorId as the key

    // Create new editor window
    const window = await chrome.windows.create({
      url: popupUrl.href,
      type: 'popup',
      width: 400,
      height: 600
    });

    if (window.id && sender.tab?.id) {
      // Track the new window with both window ID and originating tab ID
      activeEditorWindows.set(editorId, {
        windowId: window.id,
        originTabId: sender.tab.id
      });
      console.log(`Background: Created new editor window ${window.id} for editorId: ${editorId}, originating from tab ${sender.tab.id}`);

      // Clean up tracking when window is closed
      chrome.windows.onRemoved.addListener((windowId) => {
        if (windowId === window.id) {
          activeEditorWindows.delete(editorId);
          console.log(`Background: Window ${windowId} closed, removed editorId ${editorId} from tracking`);
        }
      });
    }
  };

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    try {
      if (message.type === MessageTypes.REQUEST_EDITOR_WINDOW) {
        const requestMessage = message as RequestEditorWindowMessage;
        handleEditorWindowRequest(requestMessage, sender)
          .then(() => {
            const successResponse = createMessage<ResponseMessage>(MessageTypes.SUCCESS, {
              status: "success",
              message: "Editor window request processed"
            });
            sendResponse(successResponse);
          })
          .catch((error: any) => {
            const errorResponse = createMessage<ResponseMessage>(MessageTypes.ERROR, {
              status: "error",
              message: error instanceof Error ? error.message : "Unknown error"
            });
            sendResponse(errorResponse);
          });
        return true; // Indicate async response
      } else if (message.type === MessageTypes.SYNC_CONTENT) {
        // Send SYNC_CONTENT messages directly to the originating tab using tracked window information
        handleSyncContentMessage(message as SyncContentMessage, sender, sendResponse);
        return true; // Indicate async response
      }
    } catch (error) {
      logError(error, {
        component: 'Background',
        operation: 'onMessage',
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

  // Context menu is still needed to trigger the page-helper flow
  chrome.contextMenus.onClicked.addListener(async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
    if (info.menuItemId === "abscribex-edit-ert2oljan") {
      console.log("ABScribe: Context menu clicked - page-helper will handle the element selection.");
      // The actual handling is now done by page-helper.content.ts
      // which will send a REQUEST_EDITOR_WINDOW message when an element is selected
    }
  });
});
