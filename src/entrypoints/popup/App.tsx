import { useState } from 'react';
import reactLogo from '@/assets/react.svg';
import wxtLogo from '/wxt.svg';
import './App.css';

function App() {
  const [count, setCount] = useState(0);

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <>
      <div>
        <a href="https://wxt.dev" target="_blank">
          <img src={wxtLogo} className="logo" alt="WXT logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>ABScribeX</h1>
      <div className="card">
        <p>Right-click on any text field and select "Edit with ABScribe" to start editing.</p>

        <div style={{ marginTop: '1rem' }}>
          <button onClick={openOptions} style={{ marginBottom: '1rem' }}>
            ⚙️ Settings
          </button>
        </div>

        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
      <p className="read-the-docs">
        AI-powered writing assistant for any web editor
      </p>
    </>
  );
}

export default App;
