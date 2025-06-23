import {
    MessageTypes,
    ClickedElementMessage,
    ClickedElementData,
    createMessage,
    sendMessage
} from '@/lib/config';
import { sanitizeHTML } from '@/lib/sanitizer';
import { generateIdentifier } from '@/lib/generateIdentifier';

import { defineContentScript } from 'wxt/utils/define-content-script';

console.log('ABScribe: Capture clicked element script injected.');

document.addEventListener('contextmenu', async (event) => {
    const clickedElement = event.target as HTMLElement;
    if (!clickedElement || typeof clickedElement.tagName !== 'string') return;

    let namedParent: HTMLElement | null = clickedElement;
    while (namedParent && !namedParent.id) {
        if (namedParent.parentElement && namedParent.parentElement !== namedParent) {
            namedParent = namedParent.parentElement;
        } else {
            namedParent = null;
            break;
        }
    }

    const classId = generateIdentifier('abscribex-');
    clickedElement.classList.add(classId);

    // Sanitize HTML content using the cross-environment sanitizer
    const sanitizedInnerHTML = await sanitizeHTML(clickedElement.innerHTML);

    const elementDetails: ClickedElementData = {
        tagName: clickedElement.tagName,
        id: clickedElement.id || undefined,
        parentId: namedParent?.id || undefined,
        classId,
        classList: Array.from(clickedElement.classList),
        innerHTML: sanitizedInnerHTML,
        textContent: clickedElement.textContent,
        src: (clickedElement as HTMLImageElement | HTMLMediaElement).src || undefined,
        href: (clickedElement as HTMLAnchorElement).href || undefined,
    };

    const message = createMessage<ClickedElementMessage>(MessageTypes.CLICKED_ELEMENT, {
        element: elementDetails,
    });

    sendMessage(message).catch((error: any) => {
        console.warn('ABScribe: Error sending clicked element to background:', error);
    });
}, true);

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_start',
    main() {
        // console.log('ABScribe: capture-clicked-element.content.ts main() executed.');
    },
});
