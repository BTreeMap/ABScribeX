import {
    MessageTypes,
    ClickedElementMessage,
    ClickedElementData,
    createMessage,
    sendMessage
} from '@/lib/config';
import { sanitizeHTML } from '@/lib/sanitizer';
import { generateIdentifier } from '@/lib/generateIdentifier';
import { logError, withPerformanceMonitoring } from '@/lib/errorHandler';

import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_start',
    main() {
        console.log('ABScribe: Capture clicked element script injected.');

        const handleContextMenu = withPerformanceMonitoring(
            async (event: MouseEvent) => {
                try {
                    const clickedElement = event.target as HTMLElement;
                    if (!clickedElement || typeof clickedElement.tagName !== 'string') return;

                    // Check if the element is editable (contenteditable, input, or textarea)
                    const isEditable = clickedElement.isContentEditable ||
                        clickedElement.tagName.toLowerCase() === 'input' ||
                        clickedElement.tagName.toLowerCase() === 'textarea';

                    if (!isEditable) {
                        console.log('ABScribe: Element is not editable, skipping.');
                        return;
                    }

                    const classId = generateIdentifier('abscribex-');
                    clickedElement.classList.add(classId);

                    // Find the highest priority class ID by traversing up the DOM hierarchy
                    let finalClassId = classId; // Will be the class ID we use for the element data
                    let currentElement: HTMLElement | null = clickedElement;
                    let targetElement = clickedElement; // Element to extract data from

                    while (currentElement) {
                        const abscribeClasses = Array.from(currentElement.classList)
                            .filter(className => className.startsWith('abscribex-'));

                        if (abscribeClasses.length > 0 && currentElement !== clickedElement) {
                            finalClassId = abscribeClasses[0];
                            targetElement = currentElement;
                            break;
                        }

                        currentElement = currentElement.parentElement;
                    }

                    // Log if we found a higher priority element
                    if (finalClassId !== classId) {
                        console.log('ABScribe: Found higher priority ABScribe element in hierarchy. Using existing element with class:', finalClassId, 'Target element:', targetElement.tagName);
                    }

                    let namedParent: HTMLElement | null = targetElement;
                    while (namedParent && !namedParent.id) {
                        if (namedParent.parentElement && namedParent.parentElement !== namedParent) {
                            namedParent = namedParent.parentElement;
                        } else {
                            namedParent = null;
                            break;
                        }
                    }

                    const elementDetails: ClickedElementData = {
                        tagName: targetElement.tagName,
                        id: targetElement.id || undefined,
                        parentId: namedParent?.id || undefined,
                        classId: finalClassId,
                        actualClickedElementClassId: classId,
                        classList: Array.from(targetElement.classList),
                        // Sanitize HTML content using the cross-environment sanitizer
                        innerHTML: await sanitizeHTML(targetElement.innerHTML),
                        textContent: targetElement.textContent,
                        value: (targetElement as HTMLInputElement | HTMLTextAreaElement).value || undefined,
                        src: (targetElement as HTMLImageElement | HTMLMediaElement).src || undefined,
                        href: (targetElement as HTMLAnchorElement).href || undefined,
                    };

                    const message = createMessage<ClickedElementMessage>(MessageTypes.CLICKED_ELEMENT, {
                        element: elementDetails,
                    });

                    console.log('ABScribe: Sending clicked element to background:', elementDetails);

                    await sendMessage(message);
                } catch (error) {
                    logError(error, {
                        component: 'ContentScript',
                        operation: 'handleContextMenu',
                        metadata: {
                            targetTagName: (event.target as HTMLElement)?.tagName,
                            url: window.location.href
                        }
                    });
                }
            },
            'ContentScript',
            'contextMenuHandler'
        );

        document.addEventListener('contextmenu', handleContextMenu, true);
    },
});
