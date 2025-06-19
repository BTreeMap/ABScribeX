import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: [], // You can add global setup files here if needed
        alias: {
            '@/': path.resolve(__dirname, './src') + '/',
            '~/': path.resolve(__dirname, './src') + '/',
        },
    },
});
