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
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Enzo Interiors — Admin',
        short_name: 'Enzo Admin',
        description: 'Staff CRM for Enzo Interiors: clients, bookings, quotes, projects and invoices.',
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
        runtimeCaching: [
          {
            /**
             * API GETs are stale-while-revalidate per TRD 11.2, so the shell
             * can paint last-seen data instantly while the network refreshes.
             *
             * Deliberately NOT applied to auth or mutations: a cached login or
             * a replayed write would be a correctness bug, not a nicety.
             */
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.port === '4000' &&
              !url.pathname.startsWith('/auth'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'enzo-admin-api',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
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
