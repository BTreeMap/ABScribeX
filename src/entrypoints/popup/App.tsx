import { useState, useEffect } from 'react';
import './App.css';
import '../options/Inter-font.css';

interface ExtensionStats {
  totalEdits: number;
  lastUsed: string | null;
}

function App() {
  const [stats, setStats] = useState<ExtensionStats>({ totalEdits: 0, lastUsed: null });

  useEffect(() => {
    // Load usage stats from storage
    chrome.storage.local.get(['totalEdits', 'lastUsed'], (result) => {
      setStats({
        totalEdits: result.totalEdits || 0,
        lastUsed: result.lastUsed || null
      });
    });
  }, []);

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  const openHelp = () => {
    chrome.tabs.create({
      url: 'https://github.com/your-repo/ABScribeX#readme'
    });
  };

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="logo-section">
          <div className="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L13.09 7.26L18 4L15.74 9.09L21 10L15.74 10.91L18 16L13.09 16.74L12 22L10.91 16.74L6 16L8.26 10.91L3 10L8.26 9.09L6 4L10.91 7.26L12 2Z" fill="currentColor" />
            </svg>
          </div>
          <div className="branding">
            <h1>ABScribeX</h1>
            <p>AI Writing Assistant</p>
          </div>
        </div>
      </header>

      <main className="popup-content">
        <section className="usage-section">
          <h2>Quick Start</h2>
          <div className="instruction-card">
            <div className="instruction-icon">✏️</div>
            <div className="instruction-text">
              <strong>Right-click</strong> on any text field and select <strong>"Edit with ABScribe"</strong> to start editing with AI assistance.
            </div>
          </div>
        </section>

        <section className="stats-section">
          <h2>Usage Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{stats.totalEdits}</div>
              <div className="stat-label">Total Edits</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{stats.lastUsed ? 'Active' : 'Ready'}</div>
              <div className="stat-label">Status</div>
            </div>
          </div>
          {stats.lastUsed && (
            <p className="last-used">
              Last used: {new Date(stats.lastUsed).toLocaleDateString()}
            </p>
          )}
        </section>

        <section className="actions-section">
          <button onClick={openOptions} className="action-button primary">
            <span className="button-icon">⚙️</span>
            Open Settings
          </button>
          <button onClick={openHelp} className="action-button secondary">
            <span className="button-icon">📖</span>
            Help & Documentation
          </button>
        </section>
      </main>

      <footer className="popup-footer">
        <p>Version 1.0.0 • <a href="#" onClick={openHelp}>Learn More</a></p>
      </footer>
    </div>
  );
}

export default App;
