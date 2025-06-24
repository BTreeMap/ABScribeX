export interface ExtensionSettings {
    editorUrl: string;
    activationKey: string;
    autoSave: boolean;
    theme: 'light' | 'dark' | 'auto';
    defaultModifiers: string[];
    syncInterval: number;
}

export const defaultSettings: ExtensionSettings = {
    editorUrl: 'https://abtestingtools-frontend.up.railway.app/',
    activationKey: 'k2bl9ke860c49eacm3harudni8gcf0ftc', // This is not a real secret or token - it is used to activate the injected script
    autoSave: true,
    theme: 'auto',
    defaultModifiers: ['Make it professional', 'Shorten', 'Expand', 'Make it more casual'],
    syncInterval: 250
};

/**
 * Get extension settings from storage
 */
export async function getSettings(): Promise<ExtensionSettings> {
    return new Promise((resolve) => {
        chrome.storage.sync.get(defaultSettings, (result) => {
            resolve(result as ExtensionSettings);
        });
    });
}

/**
 * Save extension settings to storage
 */
export async function saveSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.set(settings, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Get a specific setting value
 */
export async function getSetting<K extends keyof ExtensionSettings>(
    key: K
): Promise<ExtensionSettings[K]> {
    const settings = await getSettings();
    return settings[key];
}

/**
 * Set a specific setting value
 */
export async function setSetting<K extends keyof ExtensionSettings>(
    key: K,
    value: ExtensionSettings[K]
): Promise<void> {
    await saveSettings({ [key]: value });
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<void> {
    await saveSettings(defaultSettings);
}

/**
 * Listen for settings changes
 */
export function onSettingsChanged(
    callback: (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void
): void {
    chrome.storage.onChanged.addListener(callback);
}

/**
 * Clear all chrome.storage.local content
 * This will remove all stored content including cached data from the extension
 */
export async function clearLocalStorage(): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.clear(() => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                console.log('All chrome.storage.local content has been cleared');
                resolve();
            }
        });
    });
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
    averageProcessingTime: number;
    currentSyncInterval: number;
    adjustmentCount: number;
    lastUpdated: number;
    samplesCount: number;
}

/**
 * Store performance metrics
 */
export async function savePerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ performanceMetrics: metrics }, () => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Get performance metrics
 */
export async function getPerformanceMetrics(): Promise<PerformanceMetrics | null> {
    return new Promise((resolve) => {
        chrome.storage.local.get(['performanceMetrics'], (result) => {
            resolve(result.performanceMetrics || null);
        });
    });
}
