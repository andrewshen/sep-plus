import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { createManifest, type TargetBrowser } from './manifest.config';

export default defineConfig(({ mode }) => {
  const browser: TargetBrowser = mode === 'firefox' ? 'firefox' : 'chrome';
  return {
    plugins: [react(), crx({ manifest: createManifest(browser), browser })],
    server: {
      cors: {
        origin: [/chrome-extension:\/\//, /moz-extension:\/\//],
      },
    },
    build: {
      outDir: `dist/${browser}`,
      emptyOutDir: true,
      // Vite 8 defaults to lightningcss, which drops ::highlight() and
      // :host-context() (warns then strips). esbuild preserves both.
      cssMinify: 'esbuild',
      rollupOptions: {
        preserveEntrySignatures: 'exports-only',
      },
    },
  };
});
