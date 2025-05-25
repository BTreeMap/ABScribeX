import DOMPurify from 'dompurify';
import { Config } from '@/lib/config';
import { generateRandomHexString } from '@/lib/generateRandomHexString';

import { defineContentScript } from 'wxt/utils/define-content-script';

interface ClickedElementDetails {
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

console.log('ABScribe: Capture clicked element script injected.');

document.addEventListener('contextmenu', (event) => {
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

    const classId = 'x' + generateRandomHexString();
    clickedElement.classList.add(classId);

    const elementDetails: ClickedElementDetails = {
        tagName: clickedElement.tagName,
        id: clickedElement.id || undefined,
        parentId: namedParent?.id || undefined,
        classId,
        classList: Array.from(clickedElement.classList),
        innerHTML: DOMPurify.sanitize(clickedElement.innerHTML),
        textContent: clickedElement.textContent,
        src: (clickedElement as HTMLImageElement | HTMLMediaElement).src || undefined,
        href: (clickedElement as HTMLAnchorElement).href || undefined,
    };

    chrome.runtime.sendMessage({
        action: Config.ActionClickedElement,
        element: elementDetails,
    }).catch((error: any) => {
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
