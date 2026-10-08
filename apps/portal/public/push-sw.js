/*
 * Web Push for this PWA, pulled into the generated service worker through
 * workbox.importScripts (vite.config.ts). The API sends { title, body, url };
 * a tap focuses an open window of this app and goes to url, or opens one.
 * Only paths on this origin are opened. Nothing here touches fetch: API calls
 * stay network-only.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Enzo Interiors', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: typeof data.url === 'string' ? data.url : '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let target = new URL('/', self.location.origin);
  try {
    const asked = new URL(event.notification.data?.url || '/', self.location.origin);
    if (asked.origin === self.location.origin) target = asked;
  } catch {
    /* a malformed url opens the home page */
  }
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ('navigate' in open) await open.navigate(target.href).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
