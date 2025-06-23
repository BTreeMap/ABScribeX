import { defineContentScript } from 'wxt/utils/define-content-script';

import {
    MessageTypes,
    SyncContentMessage,
    createMessage,
    sendMessage,
    ContentStorage
} from '@/lib/config';
import { sanitizeHTML } from '@/lib/sanitizer';
import { encode, decode, stripStego, extractStego } from '@/lib/stego';
import { getSettings } from '@/lib/settings';

console.log('ABScribe: abscribe-frontend logic loaded (content script context).');

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// HTML tag allowlist filtering (from legacy implementation)
const allowedTags = new Set(['div', 'p', 'span', 'br']);

/**
 * Checks if a tag name is in the allowlist
 */
const isValidTag = (tagName: string): boolean => {
    return allowedTags.has(tagName.toLowerCase());
};

/**
 * Recursively filters HTML nodes to only allow specific tags
 */
const filterNodes = (node: Element): void => {
    const childNodes = Array.from(node.children);
    for (const child of childNodes) {
        if (!isValidTag(child.tagName)) {
            node.removeChild(child);
        } else {
            filterNodes(child);
        }
    }
};

/**
 * Filters HTML content to only allow specific tags
 */
const filterHTML = async (htmlContent: string): Promise<string> => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = await sanitizeHTML(htmlContent);
    filterNodes(tempDiv);
    return tempDiv.innerHTML;
};

const trigger = (keyword: string): void => {
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
        if (button.textContent?.toLowerCase().startsWith(keyword)) {
            button.click();
            console.log(`ABScribe: Clicked button with keyword '${keyword}'.`);
            return;
        }
    }
    console.log(`ABScribe: No button found with keyword '${keyword}'.`);
};

const sync = async (content: string, key: string): Promise<void> => {
    const sanitizedContent = await sanitizeHTML(content);

    const message = createMessage<SyncContentMessage>(MessageTypes.SYNC_CONTENT, {
        content: sanitizedContent,
        key,
    });

    try {
        const response = await sendMessage(message);
        console.log("ABScribe: Received response from background: ", response?.status, response?.message);
    } catch (error: any) {
        console.warn("ABScribe: Error sending message to background from abscribe-frontend:", error);
    }
};

const initializeEditorInteraction = async () => {
    const url = new URL(location.href);
    const settings = await getSettings();
    if (url.searchParams.get('secret') !== settings.activationKey) {
        return;
    }
    const key = url.searchParams.get('key');
    if (!key) {
        return;
    }
    console.log('ABScribe: Secret and key matched, abscribe-frontend.content.ts activating for editor interaction.');

    let initialContent = '<p>Loading content...</p>';
    try {
        // Use the centralized ContentStorage utility to get content
        const storedContent = await ContentStorage.getContent(key);
        if (storedContent) {
            initialContent = storedContent;
        } else {
            console.warn(`ABScribe: Content not found in local ContentStorage for key ${key}.`);
            initialContent = '<p>Error: No content found.</p>';
        }
    } catch (e) {
        console.error('ABScribe: Failed to retrieve content from ContentStorage.', e);
        initialContent = '<p>Error retrieving content.</p>';
    }

    const sanitizedInitialContent = await filterHTML(initialContent);
    let editorTarget: HTMLElement | null = document.getElementById('editor-container');

    if (!editorTarget) {
        trigger('try');
        await sleep(1000);
        let attempts = 0;
        while (attempts < 10) {
            const iframe = document.querySelector('iframe[id^="tiny-"]') as HTMLIFrameElement | null;
            if (iframe?.contentWindow?.document) {
                try {
                    editorTarget = iframe.contentWindow.document.querySelector('#tinymce') as HTMLElement;
                    if (editorTarget) {
                        console.log("ABScribe: Found TinyMCE instance in iframe.");
                        break;
                    }
                } catch (e) { /* Cross-origin or access issues */ }
            }
            await sleep(500);
            attempts++;
        }
    }

    if (!editorTarget) {
        console.error('ABScribe: No suitable editor target element found (#editor-container or TinyMCE). Creating a fallback textarea.');
        const fallbackTextarea = document.createElement('textarea');
        fallbackTextarea.style.width = '95%';
        fallbackTextarea.style.height = '300px';
        fallbackTextarea.value = stripStego(sanitizedInitialContent);
        document.body.appendChild(fallbackTextarea);
        editorTarget = fallbackTextarea;
    } else {
        editorTarget.innerHTML = sanitizedInitialContent + encode(JSON.stringify({ oid: '' }));
    }

    if (editorTarget) {
        setInterval(async () => {
            const currentHTML = (editorTarget as HTMLTextAreaElement).value !== undefined ?
                (editorTarget as HTMLTextAreaElement).value :
                editorTarget.innerHTML;
            const baseContent = stripStego(currentHTML);
            const stegoData = extractStego(currentHTML) || { oid: '' };
            const filteredContent = await filterHTML(baseContent);
            await sync(filteredContent + encode(JSON.stringify(stegoData)), key);
        }, 750);
        console.log('ABScribe: Editor sync interval started for target:', editorTarget.tagName);
    }
};

export default defineContentScript({
    matches: [
        '*://*.railway.app/*'
    ],
    main() {
        console.log('ABScribe: abscribe-frontend.content.ts main() called.');
        const url = new URL(location.href);
        // Use async function to get settings
        (async () => {
            const settings = await getSettings();
            console.log('ABScribe: abscribe-frontend.content.ts settings loaded:', settings);
            if (url.searchParams.get('secret') === settings.activationKey && url.searchParams.get('key')) {
                initializeEditorInteraction();
            }
        })();
    },
});
