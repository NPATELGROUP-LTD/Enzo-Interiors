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
        name: 'Enzo Interiors Portal',
        short_name: 'Enzo Portal',
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
        // Home-screen shortcuts: long-press the installed app's icon (Android, Windows, macOS) to open one, or
        // drag it to the home screen as its own icon. A page the role cannot open sends them to their home page.
        shortcuts: [
          { name: 'Home', short_name: 'Home', description: 'Your dashboard', url: '/dashboard', icons: [{ src: 'icons/shortcuts/dashboard.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Projects', short_name: 'Projects', description: 'Your projects', url: '/projects', icons: [{ src: 'icons/shortcuts/projects.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Messages', short_name: 'Messages', description: 'Talk to the studio', url: '/messages', icons: [{ src: 'icons/shortcuts/messages.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Documents', short_name: 'Documents', description: 'Your files', url: '/documents', icons: [{ src: 'icons/shortcuts/documents.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Quotes', short_name: 'Quotes', description: 'Your quotes', url: '/quotes', icons: [{ src: 'icons/shortcuts/quotes.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'Invoices', short_name: 'Invoices', description: 'Your invoices', url: '/invoices', icons: [{ src: 'icons/shortcuts/invoices.png', sizes: '192x192', type: 'image/png' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The invoice PDF code (jspdf and what it pulls in) loads on Download only; not on every install.
        globIgnores: ['**/jspdf*.js', '**/html2canvas*.js', '**/purify*.js', '**/index.es-*.js'],
        // Never let a cached shell shadow a newer one.
        cleanupOutdatedCaches: true,
        // Web Push handlers (public/push-sw.js): show the notification, open its page.
        importScripts: ['push-sw.js'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        /**
         * Only the app shell is cached, and no runtime route is registered on purpose: a route's
         * handler would fetch() from inside the service worker, which /sw.js's connect-src (the API
         * and the PUBLIC bucket's path only) refuses, so a private-bucket document image came up
         * broken (alt text and an icon). Unrouted requests go straight to the network from the page,
         * under its img-src / frame-src, and are never stored: API answers are a client's private
         * data and a document link is signed for five minutes.
         */
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
