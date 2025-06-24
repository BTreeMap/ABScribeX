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
import { getSettings, savePerformanceMetrics, PerformanceMetrics } from '@/lib/settings';

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

const sync = async (content: string, editorId: string): Promise<void> => {
    console.log("ABScribe: Syncing content with editorId:", editorId, "Content length:", content.length);

    const message = createMessage<SyncContentMessage>(MessageTypes.SYNC_CONTENT, {
        content: content,
        editorId, // Changed from 'key' to 'editorId'
    });

    try {
        // Send to background which will forward to the appropriate page-helper
        const response = await sendMessage(message);
        console.log("ABScribe: Received response from page-helper: ", response?.status, response?.message);
    } catch (error: any) {
        console.warn("ABScribe: Error sending sync message:", error);
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

    // The key is now the editorId directly
    const editorId = key;

    let initialContent = '<p>Loading content...</p>';
    try {
        // Use the centralized ContentStorage utility to get content
        const storedContent = await ContentStorage.getContent(editorId);
        if (typeof storedContent === 'string') {
            initialContent = storedContent;
        } else {
            console.warn(`ABScribe: Content not found in local ContentStorage for editorId ${editorId}.`);
            initialContent = '<p>Error: No content found.</p>';
        }
    } catch (e) {
        console.error('ABScribe: Failed to retrieve content from ContentStorage.', e);
        initialContent = '<p>Error retrieving content.</p>';
    }
    // The initial content is already sanitized in the background script
    console.log('ABScribe: Initial content loaded, length:', initialContent.length);

    // Extract existing stego data from the initial content to check for an oid
    const existingStegoData = extractStego(initialContent);
    const extractedOid = existingStegoData?.oid;

    const oid: string = await (async (): Promise<string> => {
        // If we found an oid in the stego data, update the URL fragment
        if (typeof extractedOid === 'string' && extractedOid.length > 0) {
            const currentUrl = new URL(location.href);

            // Set hash directly to /document/{oid}
            const expectedHash = `/document/${extractedOid}`;
            if (currentUrl.hash !== expectedHash) {
                currentUrl.hash = `/document/${extractedOid}`;

                console.log(`ABScribe: Found oid in stego data: ${extractedOid}, updating URL to: ${currentUrl.href}`);
                // Reload the page with the new hash
                window.location.href = currentUrl.href;
            }
            else {
                console.log(`ABScribe: Oid already matches URL hash: ${currentUrl.hash}`);
            }

            return extractedOid
        }
        else {
            // Create a new document if no oid is found
            console.log('ABScribe: No oid found in stego data, creating a new document.');
            trigger('try');
            await sleep(1000);
            const currentUrl = new URL(location.href);
            const newOid = currentUrl.hash.match(/\/document\/([^/]+)/)?.[1];
            if (!newOid) {
                console.error('ABScribe: Failed to create a new document, no oid found in URL hash.');
                return '';
            }
            console.log(`ABScribe: New document created with oid: ${newOid}`);
            return newOid;
        }
    })()


    let editorTarget: HTMLElement | null = document.getElementById('editor-container');

    if (!editorTarget) {
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
        fallbackTextarea.value = stripStego(initialContent);
        document.body.appendChild(fallbackTextarea);
        editorTarget = fallbackTextarea;
    } else {
        editorTarget.innerHTML = stripStego(initialContent);
    }

    if (editorTarget) {
        // Performance monitoring for self-adjusting sync frequency
        let performanceMetrics = {
            averageProcessingTime: 0,
            measurements: [] as number[],
            adjustmentCount: 0,
            lastAdjustment: Date.now()
        };

        let currentSyncInterval = Math.max(settings.syncInterval || 250, 200); // Default to 250ms, but never below 200ms
        let syncIntervalId: ReturnType<typeof setInterval> | null = null;

        const measurePerformance = (processingTime: number): void => {
            performanceMetrics.measurements.push(processingTime);

            // Keep only last 10 measurements for rolling average
            if (performanceMetrics.measurements.length > 10) {
                performanceMetrics.measurements.shift();
            }

            performanceMetrics.averageProcessingTime =
                performanceMetrics.measurements.reduce((sum, time) => sum + time, 0) /
                performanceMetrics.measurements.length;
        };

        const adjustSyncFrequency = async (): Promise<void> => {
            const now = Date.now();
            const timeSinceLastAdjustment = now - performanceMetrics.lastAdjustment;

            // Only adjust every 10 seconds to avoid thrashing
            if (timeSinceLastAdjustment < 10000) return;

            const avgProcessingTime = performanceMetrics.averageProcessingTime;
            const targetProcessingRatio = 0.3; // Sync should use max 30% of interval time

            if (avgProcessingTime > 0 && performanceMetrics.measurements.length >= 5) {
                const idealInterval = Math.max(avgProcessingTime / targetProcessingRatio, 100); // Min 100ms
                const maxInterval = Math.max(settings.syncInterval * 2, 2000); // Max 2x setting or 2000ms
                const minInterval = Math.max(settings.syncInterval * 0.5, 200); // Min 0.5x setting or 200ms (prevent flashing)

                let newInterval = Math.min(Math.max(idealInterval, minInterval), maxInterval);
                newInterval = Math.round(newInterval / 50) * 50; // Round to nearest 50ms

                // Additional check: never go below 200ms to prevent screen flashing and high CPU usage
                newInterval = Math.max(newInterval, 200);

                if (Math.abs(newInterval - currentSyncInterval) > 50) {
                    console.log(`ABScribe: Adjusting sync interval from ${currentSyncInterval}ms to ${newInterval}ms (avg processing: ${avgProcessingTime.toFixed(1)}ms)`);
                    currentSyncInterval = newInterval;
                    performanceMetrics.adjustmentCount++;
                    performanceMetrics.lastAdjustment = now;

                    // Save performance metrics to storage
                    try {
                        await savePerformanceMetrics({
                            averageProcessingTime: avgProcessingTime,
                            currentSyncInterval: currentSyncInterval,
                            adjustmentCount: performanceMetrics.adjustmentCount,
                            lastUpdated: now,
                            samplesCount: performanceMetrics.measurements.length
                        });
                    } catch (error) {
                        console.warn('ABScribe: Failed to save performance metrics:', error);
                    }

                    // Restart the interval with new timing
                    if (syncIntervalId) {
                        clearInterval(syncIntervalId);
                        startSyncInterval();
                    }
                }
            }
        };

        const syncContent = async (): Promise<void> => {
            const startTime = performance.now();

            try {
                const currentHTML = (editorTarget as HTMLTextAreaElement).value !== undefined ?
                    (editorTarget as HTMLTextAreaElement).value :
                    editorTarget.innerHTML;
                const baseContent = currentHTML;
                const stegoData = { oid: oid };
                const filteredContent = await sanitizeHTML(baseContent);
                await sync(filteredContent + encode(JSON.stringify(stegoData)), editorId);

                const processingTime = performance.now() - startTime;
                measurePerformance(processingTime);
                adjustSyncFrequency();

            } catch (error) {
                console.warn('ABScribe: Error during sync:', error);
                const processingTime = performance.now() - startTime;
                measurePerformance(processingTime);
            }
        };

        const startSyncInterval = (): void => {
            if (syncIntervalId) {
                clearInterval(syncIntervalId);
            }
            syncIntervalId = setInterval(syncContent, currentSyncInterval);
            console.log(`ABScribe: Editor sync interval started at ${currentSyncInterval}ms for target:`, editorTarget.tagName);
        };

        // Initial sync to load content
        syncContent().catch(error => {
            console.error('ABScribe: Initial sync failed:', error);
        });

        // Start the sync interval
        startSyncInterval();

        // Log performance stats periodically
        setInterval(() => {
            if (performanceMetrics.measurements.length > 0) {
                console.log(`ABScribe Performance: Avg processing time: ${performanceMetrics.averageProcessingTime.toFixed(1)}ms, Current interval: ${currentSyncInterval}ms, Adjustments: ${performanceMetrics.adjustmentCount}`);
            }
        }, 30000); // Log every 30 seconds
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
