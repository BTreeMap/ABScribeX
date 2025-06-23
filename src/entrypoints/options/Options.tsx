import { useState, useEffect } from 'react';
import './Options.css';
import { ExtensionSettings, defaultSettings, getSettings, saveSettings as saveSettingsToStorage } from '@/lib/settings';

function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>(defaultSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Load settings on component mount
  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

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
              type="password"
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
              min="100"
              max="5000"
              step="100"
              value={settings.syncInterval}
              onChange={(e) => handleInputChange('syncInterval', parseInt(e.target.value))}
            />
            <small>How often to sync content with the editor (100-5000ms)</small>
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
        </div>
      </footer>
    </div>
  );
}

export default Options;
