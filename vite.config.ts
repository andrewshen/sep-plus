import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
  build: {
    // Vite 8 defaults to lightningcss, which drops ::highlight() and
    // :host-context() (warns then strips). esbuild preserves both.
    cssMinify: 'esbuild',
    rollupOptions: {
      preserveEntrySignatures: 'exports-only',
    },
  },
});
