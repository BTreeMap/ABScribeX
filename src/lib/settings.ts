export interface ExtensionSettings {
    editorUrl: string;
    secretKey: string;
    autoSave: boolean;
    theme: 'light' | 'dark' | 'auto';
    defaultModifiers: string[];
    syncInterval: number;
}

export const defaultSettings: ExtensionSettings = {
    editorUrl: 'https://abtestingtools-frontend.up.railway.app/',
    secretKey: 'k2bl9ke860c49eacm3harudni8gcf0ftc', // Default from your current setup
    autoSave: true,
    theme: 'auto',
    defaultModifiers: ['Make it professional', 'Shorten', 'Expand', 'Make it more casual'],
    syncInterval: 500
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
