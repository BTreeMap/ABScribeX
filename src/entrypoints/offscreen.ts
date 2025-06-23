import DOMPurify from 'dompurify';

console.log('ABScribe: Offscreen document loaded for DOM operations');

interface SanitizationRequest {
    id: string;
    html: string;
    options?: any;
}

interface SanitizationResponse {
    id: string;
    sanitizedHtml: string;
    error?: string;
}

interface TextExtractionRequest {
    id: string;
    html: string;
}

interface TextExtractionResponse {
    id: string;
    textContent: string;
    error?: string;
}

// Handle messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SANITIZE_HTML') {
        handleSanitization(message as SanitizationRequest)
            .then(sendResponse)
            .catch(error => {
                sendResponse({
                    id: message.id,
                    sanitizedHtml: '',
                    error: error.message
                });
            });
        return true; // Keep the message channel open for async response
    }

    if (message.type === 'EXTRACT_TEXT') {
        handleTextExtraction(message as TextExtractionRequest)
            .then(sendResponse)
            .catch(error => {
                sendResponse({
                    id: message.id,
                    textContent: '',
                    error: error.message
                });
            });
        return true; // Keep the message channel open for async response
    }

    if (message.type === 'PING_OFFSCREEN') {
        sendResponse({ status: 'ready' });
        return false;
    }
});

async function handleSanitization(request: SanitizationRequest): Promise<SanitizationResponse> {
    try {
        const sanitizedHtml = DOMPurify.sanitize(request.html, request.options) as unknown as string;
        return {
            id: request.id,
            sanitizedHtml
        };
    } catch (error: any) {
        return {
            id: request.id,
            sanitizedHtml: '',
            error: error.message
        };
    }
}

async function handleTextExtraction(request: TextExtractionRequest): Promise<TextExtractionResponse> {
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

        return {
            id: request.id,
            textContent
        };
    } catch (error: any) {
        return {
            id: request.id,
            textContent: '',
            error: error.message
        };
    }
}
