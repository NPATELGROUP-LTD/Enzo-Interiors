import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * apps/portal — Client self-service portal.
 *
 * Standalone Vite SPA on port 5175. It talks to apps/api over HTTP and
 * WebSocket and shares no code with apps/admin or apps/web by design.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // TRD 11.2: new portal logic must reach clients without a manual reinstall.
      registerType: 'autoUpdate',
      manifest: {
        name: 'Enzo Interiors',
        short_name: 'Enzo',
        description: 'Track your Enzo Interiors project, approve designs, and view documents and invoices.',
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
        // Web Push handlers (public/push-sw.js): show the notification, open its page.
        importScripts: ['push-sw.js'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        /**
         * Only the app shell is cached. Everything else goes to the network
         * and is never stored: API answers are a client's private data and
         * live for one session, and a document link is signed for five
         * minutes. That is anything on another origin (the API, the private
         * bucket's signed URLs, fonts) and any /api path on this one.
         */
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => !sameOrigin || url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
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
    port: 5175,
    strictPort: true,
  },
});
