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

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_start',
    main() {
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

            // Find the highest priority class ID by traversing up the DOM hierarchy
            let highestPriorityClassId = classId;
            let currentElement: HTMLElement | null = clickedElement;

            while (currentElement) {
                const abscribeClasses = Array.from(currentElement.classList)
                    .filter(className => className.startsWith('abscribex-'));

                if (abscribeClasses.length > 0) {
                    highestPriorityClassId = abscribeClasses[0];
                }

                currentElement = currentElement.parentElement;
            }

            // Sanitize HTML content using the cross-environment sanitizer
            const sanitizedInnerHTML = await sanitizeHTML(clickedElement.innerHTML);

            const elementDetails: ClickedElementData = {
                tagName: clickedElement.tagName,
                id: clickedElement.id || undefined,
                parentId: namedParent?.id || undefined,
                classId,
                highestPriorityClassId,
                classList: Array.from(clickedElement.classList),
                innerHTML: sanitizedInnerHTML,
                textContent: clickedElement.textContent,
                value: (clickedElement as HTMLInputElement | HTMLTextAreaElement).value || undefined,
                src: (clickedElement as HTMLImageElement | HTMLMediaElement).src || undefined,
                href: (clickedElement as HTMLAnchorElement).href || undefined,
            };

            const message = createMessage<ClickedElementMessage>(MessageTypes.CLICKED_ELEMENT, {
                element: elementDetails,
            });

            console.log('ABScribe: Sending clicked element to background:', elementDetails);

            sendMessage(message).catch((error: any) => {
                console.warn('ABScribe: Error sending clicked element to background:', error);
            });
        }, true);
    },
});
