/**
 * Centralized message types for Chrome extension communication
 */
export const MessageTypes = {
    // Content script to background messages
    CLICKED_ELEMENT: 'klagjuvn54uh6ibtrpm0bo6fsgn68vgdl',
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
 * Content sync message from content script to background
 */
export interface SyncContentMessage extends BaseMessage {
    type: typeof MessageTypes.SYNC_CONTENT;
    content: string;
    key: string;
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
    classList: string[];
    innerHTML: string;
    textContent: string | null;
    src?: string;
    href?: string;
}

/**
 * Union type for all possible messages
 */
export type ExtensionMessage =
    | ClickedElementMessage
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
