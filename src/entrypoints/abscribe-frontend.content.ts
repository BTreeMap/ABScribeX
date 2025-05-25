import DOMPurify from 'dompurify';
import { Config } from '@/lib/config';
import { encode, decode, stripStego, extractStego } from '@/lib/stego';

console.log('ABScribe: abscribe-frontend logic loaded (content script context).');

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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

const sync = (content: string, key: string): void => {
    const sanitizedContent = DOMPurify.sanitize(content);
    chrome.runtime.sendMessage({
        message: Config.Tag + JSON.stringify({
            content: sanitizedContent,
            key,
        }),
    }).then((response: any) => {
        console.log("ABScribe: Received response from background: ", response?.status, response?.message);
    }).catch((error: any) => {
        console.warn("ABScribe: Error sending message to background from abscribe-frontend:", error);
    });
};

const initializeEditorInteraction = async () => {
    const url = new URL(location.href);
    if (url.searchParams.get('secret') !== Config.Secret) {
        return;
    }
    const key = url.searchParams.get('key');
    if (!key) {
        return;
    }
    console.log('ABScribe: Secret and key matched, abscribe-frontend.content.ts activating for editor interaction.');

    let initialContent = '<p>Loading content...</p>';
    const storageKey = `popupData_${key}`;
    try {
        const data = await chrome.storage.local.get(storageKey);
        if (data[storageKey] && data[storageKey].content) {
            initialContent = atob(data[storageKey].content);
        } else {
            console.warn(`ABScribe: Content not found in local storage for key ${storageKey}. Falling back to URL if present.`);
            const contentB64 = url.searchParams.get('content');
            if (contentB64) {
                initialContent = atob(contentB64);
            } else {
                initialContent = '<p>Error: No content found.</p>';
            }
        }
    } catch (e) {
        console.error('ABScribe: Failed to decode base64 content.', e);
        initialContent = '<p>Error decoding content.</p>';
    }

    const sanitizedInitialContent = DOMPurify.sanitize(initialContent);
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
        setInterval(() => {
            const currentHTML = (editorTarget as HTMLTextAreaElement).value !== undefined ?
                (editorTarget as HTMLTextAreaElement).value :
                editorTarget.innerHTML;
            const baseContent = stripStego(currentHTML);
            const stegoData = extractStego(currentHTML) || { oid: '' };
            sync(DOMPurify.sanitize(baseContent) + encode(JSON.stringify(stegoData)), key);
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
        if (url.searchParams.get('secret') === Config.Secret && url.searchParams.get('key')) {
            initializeEditorInteraction();
        }
    },
});
