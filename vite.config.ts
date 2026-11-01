import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'node:fs'

// Keep large public/workspace junction excluded, but always bundle the tiny
// first-party app logos/icons used by both source-mode and installed desktops.
function brandAssets(): Plugin {
  return {
    name: 'mrmak-brand-assets',
    apply: 'build',
    generateBundle() {
      for (const name of ['mak-nose.svg', 'mak-nose-chats.svg', 'mak-mobile-192.png', 'mak-mobile-512.png']) {
        this.emitFile({
          type: 'asset',
          fileName: `assets/${name}`,
          source: readFileSync(path.resolve(import.meta.dirname, 'public/assets', name)),
        })
      }
    },
  }
}


export default defineConfig({
  plugins: [react(), brandAssets()],
  server: {
    port: 3009,
    open: true,
    fs: {
      allow: ['.'],
    },
  },
  publicDir: 'public',
  build: {
    // public/workspace is a junction into workspace/ (gigabytes of reports).
    // The dashboard is a dev-server tool, so never copy publicDir into dist.
    copyPublicDir: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
})
