/*
 * Web Push for this PWA, pulled into the generated service worker through
 * workbox.importScripts (vite.config.ts). The API sends { title, body, url, tag };
 * a tap focuses an open window of this app and goes to url, or opens one.
 * Only paths on this origin are opened. Nothing here touches fetch: API calls
 * stay network-only. apps/admin and apps/portal keep identical copies.
 */

// Safari (iPhone, iPad, Mac) withdraws push permission from a site whose push
// shows nothing, so there every push is shown. Elsewhere a chat message is
// skipped while that very chat is on screen: it has already arrived live.
const ua = self.navigator.userAgent;
const strict = /iPhone|iPad|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android|Firefox/.test(ua));

const sameOrigin = (value) => {
  try {
    const url = new URL(value || '/', self.location.origin);
    return url.origin === self.location.origin ? url : null;
  } catch {
    return null;
  }
};

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : '' };
  }
  const target = sameOrigin(data.url) || new URL('/', self.location.origin);
  event.waitUntil(
    (async () => {
      if (!strict && typeof data.tag === 'string' && data.tag.startsWith('message:')) {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const watching = windows.some(
          (client) => client.focused && client.visibilityState === 'visible' && new URL(client.url).pathname === target.pathname,
        );
        if (watching) return;
      }
      const options = {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: target.pathname + target.search },
      };
      if (typeof data.tag === 'string') {
        options.tag = data.tag;
        options.renotify = true;
      }
      await self.registration.showNotification(data.title || 'Enzo Interiors', options);
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = sameOrigin(event.notification.data && event.notification.data.url) || new URL('/', self.location.origin);
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

