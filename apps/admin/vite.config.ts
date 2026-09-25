import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * apps/admin — Staff/Admin CRM.
 *
 * Standalone Vite SPA on port 5174. It talks to apps/api over HTTP and
 * WebSocket and shares no code with apps/portal or apps/web by design.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // TRD 11.2: new CRM logic must reach staff without a manual reinstall.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png', 'enzo-mark.png'],
      manifest: {
        name: 'Enzo Interiors',
        short_name: 'Enzo',
        description: 'Edit the words and pictures on the Enzo Interiors website.',
        // Standalone removes browser chrome so the portal feels like an app.
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        theme_color: '#173C30',
        background_color: '#F7F5F0',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Never let a cached shell shadow a newer one.
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // No runtime caching of API responses. This is an editor: a cached
        // GET would show a draft as it was before the last save, and "did my
        // change land?" must always be answered by the server.
      },
      devOptions: {
        // Keep the SW off in dev: it caches aggressively and makes "did my
        // change land?" much harder to answer while building.
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
