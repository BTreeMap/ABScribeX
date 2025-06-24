/**
 * Centralized message types for Chrome extension communication
 */
export const MessageTypes = {
    // Content script to background messages
    CLICKED_ELEMENT: 'klagjuvn54uh6ibtrpm0bo6fsgn68vgdl',
    REQUEST_EDITOR_WINDOW: 'kr9n1dmuahhflff8dia8sn1kuj2p4f4kt',

    // Direct page-helper to abscribe-frontend communication
    SYNC_CONTENT: 'kkv54gn4p049hgucu8ouenjlm8bgdm1b1',

    // Service worker to offscreen document messages
    SANITIZE_HTML: 'kdcept35l383b0ghrg0b14kr8huq1c43a',
    EXTRACT_TEXT: 'k8h8sqp73psd7fivnklvpl3i65s5qb6e2',
    PING_OFFSCREEN: 'ks5aae0o5ck3b2phohebenr36j9sodcml',

    // Response types
    SUCCESS: 'k5rmqq7keoairttogvcj85sa6p57dunvc',
    ERROR: 'ktpsfphjd2q6n4m82dt5fpooapi9j2tkn',
} as const;

/**
 * Rich content type that tracks content state, element context, and sanitization options
 * Can contain either sanitized or unsanitized content - check isSanitized flag
 */
export interface ContentWithMetadata {
    content: string;
    elementType?: string;
    isSanitized: boolean;
    originalLength?: number;
    sanitizedAt?: number;
    dompurifyOptions?: any;
}

/**
 * Base interface for all extension messages
 */
export interface BaseMessage {
    type: string;
    id?: string;
    timestamp?: number;
}

/**
 * Clicked element message from content script to background
 */
export interface ClickedElementMessage extends BaseMessage {
    type: typeof MessageTypes.CLICKED_ELEMENT;
    element: ClickedElementData;
}

/**
 * Request editor window message from page-helper to background
 */
export interface RequestEditorWindowMessage extends BaseMessage {
    type: typeof MessageTypes.REQUEST_EDITOR_WINDOW;
    editorId: string;
    content: ContentWithMetadata;
}

/**
 * Content sync message - direct communication between content scripts
 */
export interface SyncContentMessage extends BaseMessage {
    type: typeof MessageTypes.SYNC_CONTENT;
    content: ContentWithMetadata;
    editorId: string; // Changed from 'key' to 'editorId' 
}

/**
 * HTML sanitization message to offscreen document
 */
export interface SanitizeHTMLMessage extends BaseMessage {
    type: typeof MessageTypes.SANITIZE_HTML;
    html: string;
    options?: any;
}

/**
 * Text extraction message to offscreen document
 */
export interface ExtractTextMessage extends BaseMessage {
    type: typeof MessageTypes.EXTRACT_TEXT;
    html: string;
}

/**
 * Ping message to offscreen document
 */
export interface PingOffscreenMessage extends BaseMessage {
    type: typeof MessageTypes.PING_OFFSCREEN;
}

/**
 * Generic response message
 */
export interface ResponseMessage extends BaseMessage {
    type: typeof MessageTypes.SUCCESS | typeof MessageTypes.ERROR;
    status: 'success' | 'error';
    message?: string;
    data?: any;
}

/**
 * Sanitization response message
 */
export interface SanitizationResponse extends BaseMessage {
    type: typeof MessageTypes.SUCCESS | typeof MessageTypes.ERROR;
    sanitizedHtml?: string;
    error?: string;
}

/**
 * Text extraction response message
 */
export interface TextExtractionResponse extends BaseMessage {
    type: typeof MessageTypes.SUCCESS | typeof MessageTypes.ERROR;
    textContent?: string;
    error?: string;
}

/**
 * Clicked element data structure
 */
export interface ClickedElementData {
    tagName: string;
    id?: string;
    parentId?: string;
    classId: string;
    actualClickedElementClassId: string;
    classList: string[];
    innerHTML: string;
    textContent: string | null;
    value?: string;
    src?: string;
    href?: string;
}

/**
 * Union type for all possible messages
 */
export type ExtensionMessage =
    | ClickedElementMessage
    | RequestEditorWindowMessage
    | SyncContentMessage
    | SanitizeHTMLMessage
    | ExtractTextMessage
    | PingOffscreenMessage
    | ResponseMessage
    | SanitizationResponse
    | TextExtractionResponse;

/**
 * Utility function to create a message with proper serialization
 */
export function createMessage<T extends BaseMessage>(
    type: T['type'],
    data: Omit<T, 'type' | 'timestamp'>
): T {
    return {
        type,
        timestamp: Date.now(),
        ...data,
    } as T;
}

/**
 * Utility function to send a message with proper error handling
 */
export async function sendMessage<T extends BaseMessage, R = any>(
    message: T
): Promise<R> {
    try {
        const response = await chrome.runtime.sendMessage(message);
        return response;
    } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
    }
}

/**
 * Utility function for direct content script to content script communication
 * Uses chrome.tabs.sendMessage to communicate between content scripts
 */
export async function sendMessageToTab<T extends BaseMessage, R = any>(
    tabId: number,
    message: T
): Promise<R> {
    try {
        const response = await chrome.tabs.sendMessage(tabId, message);
        return response;
    } catch (error) {
        console.error('Failed to send message to tab:', error);
        throw error;
    }
}

/**
 * Storage interface for typed storage instances
 */
export interface StorageInstance<T = string> {
    contentKey: (key: string) => string;
    storeContent: (key: string, content: T) => Promise<void>;
    getContent: (key: string) => Promise<T | null>;
    removeContent: (key: string) => Promise<void>;
    clearAllContent: () => Promise<void>;
}

/**
 * Storage factory function to create storage instances with different prefixes
 */
export function createStorage<T = string>(prefix: string): StorageInstance<T> {
    return {
        /**
         * Generate storage key for content data
         */
        contentKey: (key: string): string => `${prefix}_${key}`,

        /**
         * Store content in chrome.storage.local
         */
        storeContent: async (key: string, content: T): Promise<void> => {
            const storageKey = `${prefix}_${key}`;
            await chrome.storage.local.set({ [storageKey]: { content, timestamp: Date.now() } });
            console.log(`Storage[${prefix}]: Stored content for key ${key} as ${storageKey}`);
        },

        /**
         * Retrieve content from chrome.storage.local
         */
        getContent: async (key: string): Promise<T | null> => {
            const storageKey = `${prefix}_${key}`;
            const data = await chrome.storage.local.get(storageKey);

            if (data[storageKey] && data[storageKey].timestamp) {
                console.log(`Storage[${prefix}]: Retrieved content for key ${key} from ${storageKey}`);
                return data[storageKey].content;
            }

            console.warn(`Storage[${prefix}]: No content found for key ${key} (${storageKey})`);
            return null;
        },

        /**
         * Remove content from chrome.storage.local
         */
        removeContent: async (key: string): Promise<void> => {
            const storageKey = `${prefix}_${key}`;
            await chrome.storage.local.remove(storageKey);
            console.log(`Storage[${prefix}]: Removed content for key ${key} (${storageKey})`);
        },

        /**
         * Clear all content storage for this prefix (for debugging/cleanup)
         */
        clearAllContent: async (): Promise<void> => {
            const allData = await chrome.storage.local.get();
            const contentKeys = Object.keys(allData).filter(key => key.startsWith(`${prefix}_`));
            if (contentKeys.length > 0) {
                await chrome.storage.local.remove(contentKeys);
                console.log(`Storage[${prefix}]: Cleared ${contentKeys.length} content entries`);
            }
        }
    };
}

/**
 * Default storage instance for content data
 */
export const ContentStorage = createStorage<ContentWithMetadata>('e9hfahco3');
