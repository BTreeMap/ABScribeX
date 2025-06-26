export interface WindowSizeSettings {
    width: number;
    height: number;
    preset: 'small' | 'medium' | 'large' | 'custom';
}

export interface ExtensionSettings {
    editorUrl: string;
    activationKey: string;
    autoSave: boolean;
    theme: 'light' | 'dark' | 'auto';
    defaultModifiers: string[];
    syncInterval: number;
    windowSize: WindowSizeSettings;
}

export const defaultSettings: ExtensionSettings = {
    editorUrl: 'https://abtestingtools-frontend.up.railway.app/',
    activationKey: 'k2bl9ke860c49eacm3harudni8gcf0ftc', // This is not a real secret or token - it is used to activate the injected script
    autoSave: true,
    theme: 'auto',
    defaultModifiers: ['Make it professional', 'Shorten', 'Expand', 'Make it more casual'],
    syncInterval: 250,
    windowSize: {
        width: 800,
        height: 700,
        preset: 'medium'
    }
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

/**
 * Window size utility functions and constants
 */
export const WINDOW_SIZE_PRESETS = {
    small: { width: 500, height: 550 },
    medium: { width: 800, height: 700 },
    large: { width: 1200, height: 900 }
} as const;

export const WINDOW_SIZE_CONSTRAINTS = {
    minWidth: 400,
    minHeight: 300,
    maxWidth: 2000,
    maxHeight: 1500
} as const;

/**
 * Validate window size settings
 */
export function validateWindowSize(windowSize: WindowSizeSettings): WindowSizeSettings {
    const validated = { ...windowSize };

    // Ensure dimensions are within constraints
    validated.width = Math.max(WINDOW_SIZE_CONSTRAINTS.minWidth,
        Math.min(WINDOW_SIZE_CONSTRAINTS.maxWidth, validated.width));
    validated.height = Math.max(WINDOW_SIZE_CONSTRAINTS.minHeight,
        Math.min(WINDOW_SIZE_CONSTRAINTS.maxHeight, validated.height));

    // Update preset if dimensions match a preset
    for (const [presetName, presetSize] of Object.entries(WINDOW_SIZE_PRESETS)) {
        if (presetSize.width === validated.width && presetSize.height === validated.height) {
            validated.preset = presetName as WindowSizeSettings['preset'];
            return validated;
        }
    }

    // If dimensions don't match any preset, set to custom
    validated.preset = 'custom';
    return validated;
}

/**
 * Get window size from preset
 */
export function getWindowSizeFromPreset(preset: WindowSizeSettings['preset']): { width: number; height: number } {
    if (preset === 'custom') {
        return WINDOW_SIZE_PRESETS.medium; // fallback
    }
    return WINDOW_SIZE_PRESETS[preset];
}

/**
 * Create window size settings from dimensions
 */
export function createWindowSizeSettings(width: number, height: number): WindowSizeSettings {
    return validateWindowSize({ width, height, preset: 'custom' });
}
