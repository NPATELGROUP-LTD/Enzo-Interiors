import { api } from '@/lib/api';

/**
 * Web Push on this device ("Notifications on this device"). The browser holds
 * the subscription; the API stores it against whoever is signed in and sends
 * to it whenever their bell rings. The service worker's handlers are
 * public/push-sw.js. apps/admin and apps/portal each keep their own copy.
 */

export type PushState =
  | 'unsupported' // no service worker / Push API in this browser
  | 'install' // iPhone/iPad in Safari: only works from the Home Screen app
  | 'no-worker' // service worker not running (dev build, or still installing)
  | 'off-server' // the API has no VAPID keys
  | 'denied' // the person blocked notifications for this site
  | 'off'
  | 'on';

const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return navigator.serviceWorker.getRegistration();
}

async function publicKey(): Promise<string | null> {
  return (await api.get<{ key: string | null }>('/push/public-key')).key;
}

export async function pushState(): Promise<PushState> {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!supported) return isIos() && !isStandalone() ? 'install' : 'unsupported';
  const reg = await registration();
  if (!reg) return 'no-worker';
  if (!(await publicKey())) return 'off-server';
  if (Notification.permission === 'denied') return 'denied';
  return (await reg.pushManager.getSubscription()) && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Ask (only now, on the click), subscribe, and tell the API. Returns the new state. */
export async function enablePush(): Promise<PushState> {
  const reg = await registration();
  const key = await publicKey();
  if (!reg || !key) return pushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(key) }));
  const json = subscription.toJSON();
  await api.post('/push/subscribe', { endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
  return 'on';
}

/**
 * Stop pushes to this device: forget it on the API (with the given session,
 * so sign-out can call this before the token is gone) and unsubscribe the browser.
 */
export async function disablePush(token: string | null): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const subscription = await (await registration())?.pushManager.getSubscription();
  if (!subscription) return;
  if (token) {
    await fetch(`${api.baseUrl}/push/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);
  }
  await subscription.unsubscribe().catch(() => undefined);
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export const PUSH_MESSAGES: Record<Exclude<PushState, 'on' | 'off'>, string> = {
  unsupported: 'This browser cannot show notifications from the app.',
  install:
    'On iPhone and iPad, add Enzo Interiors to your Home Screen first (Share, then Add to Home Screen), open it from there, and turn this on.',
  'no-worker': 'Notifications work in the installed app. Reload the page and try again.',
  'off-server': 'Notifications on devices are not set up yet.',
  denied: 'Notifications are blocked for this site. Allow them in your browser or phone settings, then come back.',
};
