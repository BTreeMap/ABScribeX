import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react'; // Import the React plugin

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src', // Defining srcDir to allow for cleaner imports like @/lib
  entrypointsDir: 'entrypoints',
  vite: () => ({
    plugins: [react()],
  }),
  manifest: {
    name: 'AI Content Editor',
    version: '1.0',
    description: 'Edit content with generative AI support',
    permissions: [
      "contextMenus",
      "activeTab",
      "scripting",
      "storage" // Added because the background script uses chrome.storage
    ],
    action: {
      default_popup: 'popup/index.html',
      default_icon: {
        16: 'icon/16.png',
        48: 'icon/48.png',
        128: 'icon/128.png'
      }
    },
    icons: {
      16: 'icon/16.png',
      48: 'icon/48.png',
      128: 'icon/128.png'
    },
    host_permissions: [
      "<all_urls>"
    ]
    // Content scripts are defined in their respective files using defineContentScript
    // or automatically picked up if named *.content.ts in entrypoints/
  },
  modules: ['@wxt-dev/module-react'],
});
