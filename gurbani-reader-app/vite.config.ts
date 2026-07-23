import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      disable: process.env.NATIVE_BUILD === 'true',
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Shabad Sojhi',
        short_name: 'Sojhi',
        description: 'Read, find and understand Gurbani',
        theme_color: '#f5f0e5',
        background_color: '#f5f0e5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        cleanupOutdatedCaches: true
      }
    })
  ],
  build: {
    sourcemap: true
  }
});
