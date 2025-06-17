import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react'; // Import the React plugin
import { InlineConfig } from 'vitest'; // Import Vitest type

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src', // Defining srcDir to allow for cleaner imports like @/lib
  entrypointsDir: 'entrypoints',
  vite: (env) => { // env can be used to differentiate between build, dev, etc.
    const plugins = [react()];
    let testConfig: { test?: InlineConfig } = {};

    // Add Vitest config only when in test mode or if you want it available generally
    // WXT doesn't have a direct "test" mode in its env, so we add it generally
    // or you could use an environment variable to conditionally add this.
    testConfig.test = {
      globals: true,
      environment: 'jsdom', // or 'happy-dom'
      setupFiles: [], // if you need setup files
      include: ['src/**/*.test.ts', 'entrypoints/**/*.test.ts'],
      alias: { // Ensure aliases match tsconfig and vite config for consistency
        '@/': new URL('./src/', import.meta.url).pathname,
        '~/': new URL('./src/', import.meta.url).pathname,
      },
    };

    return {
      plugins,
      // Spread the test config here
      ...testConfig,
    };
  },
  manifest: {
    name: 'ABScribeX',
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
