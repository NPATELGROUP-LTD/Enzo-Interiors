import { DeviceMobile, ShareNetwork } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui';

/*
 * "Install the app" for a phone that has not: a card on Android/Chrome that opens the browser's own
 * install dialog, and on an iPhone in Safari the Share > Add to Home Screen steps (Safari has no
 * install API). Never inside the installed app, never on a desktop, and "Not now" hides it for two
 * weeks. Each app keeps an identical copy of this file.
 */

const KEY = 'enzo.installPrompt';
const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const dismissedRecently = (): boolean => {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < TWO_WEEKS;
  } catch {
    return false;
  }
};

const installed = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const phone = (): boolean => window.matchMedia('(pointer: coarse) and (max-width: 820px)').matches;

const iPhone = (): boolean => /iPhone|iPad|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);

export function InstallPrompt({ appName }: { appName: string }) {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(() => dismissedRecently() || installed() || !phone());
  const ios = iPhone();

  useEffect(() => {
    const onPrompt = (next: Event) => {
      next.preventDefault(); // keep it for our own button
      setEvent(next as InstallEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Android needs the browser's go-ahead (the event); an iPhone never sends one, so Safari shows the steps.
  if (hidden || !(event || ios)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* private mode: it asks again next visit */
    }
    setHidden(true);
  };

  const install = async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    if (outcome === 'accepted') setHidden(true);
    else dismiss();
  };

  return (
    <div
      role="region"
      aria-labelledby="install-prompt-title"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-40 rounded-card border border-border bg-surface p-4 shadow-window lg:bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-900 text-on-primary">
          <DeviceMobile size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p id="install-prompt-title" className="font-semibold text-ink">
            Install {appName}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {event ? (
              'Open it from your home screen like any other app, with notifications.'
            ) : (
              <>
                Tap <ShareNetwork size={14} aria-label="Share" className="inline align-[-2px]" /> Share, then <strong>Add to Home Screen</strong>.
              </>
            )}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={dismiss}>
          {event ? 'Not now' : 'Got it'}
        </Button>
        {event ? (
          <Button variant="primary" onClick={() => void install()}>
            Install
          </Button>
        ) : null}
      </div>
    </div>
  );
}
