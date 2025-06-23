import DOMPurify from 'dompurify';
import {
    MessageTypes,
    SanitizeHTMLMessage,
    ExtractTextMessage,
    PingOffscreenMessage,
    SanitizationResponse,
    TextExtractionResponse,
    createMessage
} from '@/lib/config';

console.log('ABScribe: Offscreen document loaded for DOM operations');

// Handle messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MessageTypes.SANITIZE_HTML) {
        handleSanitization(message as SanitizeHTMLMessage)
            .then(sendResponse)
            .catch(error => {
                const errorResponse = createMessage<SanitizationResponse>(MessageTypes.ERROR, {
                    id: message.id,
                    sanitizedHtml: '',
                    error: error.message
                });
                sendResponse(errorResponse);
            });
        return true; // Keep the message channel open for async response
    }

    if (message.type === MessageTypes.EXTRACT_TEXT) {
        handleTextExtraction(message as ExtractTextMessage)
            .then(sendResponse)
            .catch(error => {
                const errorResponse = createMessage<TextExtractionResponse>(MessageTypes.ERROR, {
                    id: message.id,
                    textContent: '',
                    error: error.message
                });
                sendResponse(errorResponse);
            });
        return true; // Keep the message channel open for async response
    }

    if (message.type === MessageTypes.PING_OFFSCREEN) {
        sendResponse({ status: 'ready' });
        return false;
    }
});

async function handleSanitization(request: SanitizeHTMLMessage): Promise<SanitizationResponse> {
    try {
        const sanitizedHtml = DOMPurify.sanitize(request.html, request.options) as unknown as string;
        return createMessage<SanitizationResponse>(MessageTypes.SUCCESS, {
            id: request.id!,
            sanitizedHtml
        });
    } catch (error: any) {
        return createMessage<SanitizationResponse>(MessageTypes.ERROR, {
            id: request.id!,
            sanitizedHtml: '',
            error: error.message
        });
    }
}

async function handleTextExtraction(request: ExtractTextMessage): Promise<TextExtractionResponse> {
    try {
        // Create a temporary container for text extraction
        const container = document.getElementById('sanitization-container');
        if (!container) {
            throw new Error('Sanitization container not found');
        }

        // Sanitize first, then extract text
        const sanitizedHtml = DOMPurify.sanitize(request.html) as unknown as string;
        container.innerHTML = sanitizedHtml;
        const textContent = container.textContent || container.innerText || '';

        // Clean up
        container.innerHTML = '';

        return createMessage<TextExtractionResponse>(MessageTypes.SUCCESS, {
            id: request.id!,
            textContent
        });
    } catch (error: any) {
        return createMessage<TextExtractionResponse>(MessageTypes.ERROR, {
            id: request.id!,
            textContent: '',
            error: error.message
        });
    }
}
