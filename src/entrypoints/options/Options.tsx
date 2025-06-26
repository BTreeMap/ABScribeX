import { useState, useEffect } from 'react';
import './Options.css';
import {
  ExtensionSettings,
  defaultSettings,
  getSettings,
  saveSettings as saveSettingsToStorage,
  clearLocalStorage,
  getPerformanceMetrics,
  PerformanceMetrics
} from '@/lib/settings';
import { getDiagnosticInfo } from '@/lib/errorHandler';

function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [isClearing, setIsClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState<'idle' | 'cleared' | 'error'>('idle');
  const [diagnosticInfo, setDiagnosticInfo] = useState<{
    errorLogs: any[];
    performanceLogs: any[];
    storageUsage: number;
  } | null>(null);

  // Load settings and performance metrics on component mount
  useEffect(() => {
    getSettings().then(setSettings);
    getPerformanceMetrics().then(setPerformanceMetrics);
  }, []);

  // Load diagnostic info on demand
  const loadDiagnosticInfo = async () => {
    try {
      const info = await getDiagnosticInfo();
      setDiagnosticInfo(info);
    } catch (error) {
      console.error('Failed to load diagnostic info:', error);
    }
  };

  const handleInputChange = (key: keyof ExtensionSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleModifierChange = (index: number, value: string) => {
    const newModifiers = [...settings.defaultModifiers];
    newModifiers[index] = value;
    setSettings(prev => ({
      ...prev,
      defaultModifiers: newModifiers
    }));
  };

  const addModifier = () => {
    setSettings(prev => ({
      ...prev,
      defaultModifiers: [...prev.defaultModifiers, '']
    }));
  };

  const removeModifier = (index: number) => {
    setSettings(prev => ({
      ...prev,
      defaultModifiers: prev.defaultModifiers.filter((_, i) => i !== index)
    }));
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await saveSettingsToStorage(settings);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  const clearLocalStorageData = async () => {
    if (!confirm('Are you sure you want to clear all local storage? This will remove all cached content and cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    try {
      await clearLocalStorage();
      setClearStatus('cleared');
      setTimeout(() => setClearStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to clear local storage:', error);
      setClearStatus('error');
      setTimeout(() => setClearStatus('idle'), 3000);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="options-container">
      <header className="options-header">
        <h1>ABScribeX Settings</h1>
        <p>Configure your AI-powered writing assistant</p>
      </header>

      <main className="options-content">
        <section className="settings-section">
          <h2>Editor Configuration</h2>

          <div className="setting-item">
            <label htmlFor="editorUrl">Editor URL</label>
            <input
              type="url"
              id="editorUrl"
              value={settings.editorUrl}
              onChange={(e) => handleInputChange('editorUrl', e.target.value)}
              placeholder="https://your-editor-url.com"
            />
            <small>The URL of the external editor interface</small>
          </div>

          <div className="setting-item">
            <label htmlFor="activationKey">Activation Key</label>
            <input
              type="text"
              id="activationKey"
              value={settings.activationKey}
              onChange={(e) => handleInputChange('activationKey', e.target.value)}
              placeholder="Enter your activation key"
            />
            <small>Unique identifier used to activate the extension script (not a real secret)</small>
          </div>

          <div className="setting-item">
            <label htmlFor="syncInterval">Sync Interval (ms)</label>
            <input
              type="number"
              id="syncInterval"
              min="200"
              max="5000"
              step="50"
              value={settings.syncInterval}
              onChange={(e) => handleInputChange('syncInterval', parseInt(e.target.value))}
            />
            <small>
              How often to sync content with the editor (200-5000ms).
              Minimum 200ms to prevent screen flashing and high CPU usage.
              The extension will auto-adjust this value based on performance.
            </small>
          </div>

          <div className="setting-item">
            <div className="performance-info">
              <h4>Sync Performance</h4>
              <p><strong>Recommended Values:</strong></p>
              <ul>
                <li><strong>250ms</strong> - Fast typing, modern devices (recommended)</li>
                <li><strong>500ms</strong> - Balanced performance</li>
                <li><strong>1000ms</strong> - Slower devices or poor network</li>
              </ul>
              <p><strong>Note:</strong> Minimum 200ms enforced to prevent screen flashing and excessive CPU usage.</p>

              {performanceMetrics && (
                <div className="current-performance">
                  <h5>Current Performance:</h5>
                  <ul>
                    <li><strong>Avg Processing Time:</strong> {performanceMetrics.averageProcessingTime.toFixed(1)}ms</li>
                    <li><strong>Current Sync Interval:</strong> {performanceMetrics.currentSyncInterval}ms</li>
                    <li><strong>Auto-Adjustments Made:</strong> {performanceMetrics.adjustmentCount}</li>
                    <li><strong>Samples Collected:</strong> {performanceMetrics.samplesCount}</li>
                    <li><strong>Last Updated:</strong> {new Date(performanceMetrics.lastUpdated).toLocaleString()}</li>
                  </ul>
                </div>
              )}

              <p>
                <em>Note: The extension automatically adjusts sync frequency based on processing time
                  to maintain optimal performance. Your setting acts as a baseline.</em>
              </p>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2>User Interface</h2>

          <div className="setting-item">
            <label htmlFor="theme">Theme</label>
            <select
              id="theme"
              value={settings.theme}
              onChange={(e) => handleInputChange('theme', e.target.value as 'light' | 'dark' | 'auto')}
            >
              <option value="auto">Auto (System)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <small>Choose your preferred color scheme</small>
          </div>

          <div className="setting-item">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={(e) => handleInputChange('autoSave', e.target.checked)}
              />
              <span>Auto-save changes</span>
            </label>
            <small>Automatically save changes as you type</small>
          </div>

          <div className="setting-item">
            <h3>Editor Window Size</h3>
            <div className="window-size-controls">
              <div className="preset-selector">
                <label htmlFor="windowPreset">Quick Presets</label>
                <select
                  id="windowPreset"
                  value={settings.windowSize?.preset || 'large'}
                  onChange={(e) => {
                    const preset = e.target.value as 'small' | 'medium' | 'large' | 'extra-large' | 'custom';
                    let newWindowSize;

                    switch (preset) {
                      case 'small':
                        newWindowSize = { width: 600, height: 500, preset };
                        break;
                      case 'medium':
                        newWindowSize = { width: 800, height: 700, preset };
                        break;
                      case 'large':
                        newWindowSize = { width: 1200, height: 900, preset };
                        break;
                      case 'extra-large':
                        newWindowSize = { width: 1600, height: 1200, preset };
                        break;
                      default:
                        newWindowSize = settings.windowSize || { width: 1200, height: 900, preset: 'custom' };
                    }

                    handleInputChange('windowSize', newWindowSize);
                  }}
                >
                  <option value="small">Small (600×500)</option>
                  <option value="medium">Medium (800×700)</option>
                  <option value="large">Large (1200×900) - Recommended</option>
                  <option value="extra-large">Extra Large (1600×1200)</option>
                  <option value="custom">Custom</option>
                </select>
                <small>Choose from predefined window sizes or set custom dimensions</small>
              </div>

              <div className="custom-size-inputs">
                <div className="size-input-group">
                  <label htmlFor="windowWidth">Width (px)</label>
                  <input
                    type="number"
                    id="windowWidth"
                    min="400"
                    max="3840"
                    value={settings.windowSize?.width || 1200}
                    onChange={(e) => {
                      const width = Math.max(400, Math.min(3840, parseInt(e.target.value) || 1200));
                      handleInputChange('windowSize', {
                        ...settings.windowSize,
                        width,
                        preset: 'custom'
                      });
                    }}
                  />
                </div>

                <div className="size-input-group">
                  <label htmlFor="windowHeight">Height (px)</label>
                  <input
                    type="number"
                    id="windowHeight"
                    min="300"
                    max="2160"
                    value={settings.windowSize?.height || 900}
                    onChange={(e) => {
                      const height = Math.max(300, Math.min(2160, parseInt(e.target.value) || 900));
                      handleInputChange('windowSize', {
                        ...settings.windowSize,
                        height,
                        preset: 'custom'
                      });
                    }}
                  />
                </div>
              </div>

              <div className="window-size-info">
                <small>
                  <strong>Current size:</strong> {settings.windowSize?.width || 1200} × {settings.windowSize?.height || 900} pixels
                  <br />
                  <strong>Recommended:</strong> Large (1200×900) provides optimal writing space and readability
                  <br />
                  <strong>Limits:</strong> Width: 400-3840px, Height: 300-2160px (automatically enforced)
                </small>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2>AI Modifiers</h2>
          <p>Configure default AI modification prompts for quick access</p>

          <div className="modifiers-list">
            {settings.defaultModifiers.map((modifier, index) => (
              <div key={index} className="modifier-item">
                <input
                  type="text"
                  value={modifier}
                  onChange={(e) => handleModifierChange(index, e.target.value)}
                  placeholder="Enter modifier prompt"
                />
                <button
                  type="button"
                  onClick={() => removeModifier(index)}
                  className="remove-button"
                  aria-label="Remove modifier"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button type="button" onClick={addModifier} className="add-button">
            + Add Modifier
          </button>
        </section>

        <section className="settings-section">
          <h2>Storage Management</h2>
          <p>Manage your extension's local storage data</p>

          <div className="storage-info">
            <h3>Clear Local Storage</h3>
            <p>This will remove all cached content, stored data, and temporary files created by the extension. This action cannot be undone.</p>
            <ul>
              <li>Cached HTML content from edited elements</li>
              <li>Temporary content storage</li>
              <li>Other extension data stored locally</li>
            </ul>
            <p><strong>Note:</strong> Your extension settings will not be affected as they are stored separately.</p>
          </div>
        </section>

        <section className="settings-section diagnostics-section">
          <h2>Diagnostics</h2>
          <p>View diagnostic information and performance metrics</p>

          <button type="button" onClick={loadDiagnosticInfo} className="load-diagnostics-button">
            Load Diagnostic Info
          </button>

          {diagnosticInfo && (
            <div className="diagnostic-info">
              <h3>Diagnostic Information:</h3>
              <div className="diagnostic-data">
                <div>
                  <strong>Error Logs:</strong> {diagnosticInfo.errorLogs.length} entries
                </div>
                <div>
                  <strong>Performance Logs:</strong> {diagnosticInfo.performanceLogs.length} entries
                </div>
                <div>
                  <strong>Storage Usage:</strong> {(diagnosticInfo.storageUsage / 1024).toFixed(2)} KB
                </div>
                <details className="diagnostic-details">
                  <summary>View Raw Data</summary>
                  <pre>{JSON.stringify(diagnosticInfo, null, 2)}</pre>
                </details>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="options-footer">
        <div className="button-group">
          <button
            type="button"
            onClick={resetSettings}
            className="reset-button"
          >
            Reset to Defaults
          </button>

          <button
            type="button"
            onClick={clearLocalStorageData}
            disabled={isClearing}
            className={`clear-button ${clearStatus}`}
          >
            {isClearing ? 'Clearing...' : clearStatus === 'cleared' ? 'Cleared!' : clearStatus === 'error' ? 'Error!' : 'Clear Local Storage'}
          </button>

          <button
            type="button"
            onClick={saveSettings}
            disabled={isSaving}
            className={`save-button ${saveStatus}`}
          >
            {isSaving ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error!' : 'Save Settings'}
          </button>
        </div>

        <div className="save-status">
          {saveStatus === 'saved' && <span className="status-success">Settings saved successfully!</span>}
          {saveStatus === 'error' && <span className="status-error">Failed to save settings. Please try again.</span>}
          {clearStatus === 'cleared' && <span className="status-success">Local storage cleared successfully!</span>}
          {clearStatus === 'error' && <span className="status-error">Failed to clear local storage. Please try again.</span>}
        </div>
      </footer>
    </div>
  );
}

export default Options;
