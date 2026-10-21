import { BellRinging } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Button, Toggle } from '@/components/ui';
import { tokenStore } from '@/lib/api';
import { PUSH_MESSAGES, disablePush, enablePush, pushState, syncPush, testPush, type PushState } from '@/lib/push';

/** "Notifications on this device": Web Push for this browser only. */
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'));
  }, []);

  const change = async (next: boolean) => {
    setBusy(true);
    setFailed(false);
    try {
      if (next) setState(await enablePush());
      else {
        await disablePush(tokenStore.get(), true);
        setState('off');
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      setTestResult(await testPush());
    } catch {
      setTestResult('Could not send the test. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const note = state && state !== 'on' && state !== 'off' ? PUSH_MESSAGES[state] : null;
  return (
    <div>
      <Toggle
        label="Notifications on this device"
        description="Alerts on this phone or computer, even when the app is closed."
        checked={state === 'on'}
        disabled={busy || (state !== 'on' && state !== 'off')}
        onChange={(next) => void change(next)}
      />
      {note ? <p className="mt-1 text-xs text-ink-muted" role="status">{note}</p> : null}
      {state === 'on' ? (
        <div className="mt-1">
          <button type="button" onClick={() => void test()} disabled={busy} className="text-link text-xs">
            Send a test notification
          </button>
          {testResult ? <p className="mt-1 text-xs text-ink-muted" role="status">{testResult}</p> : null}
        </div>
      ) : null}
      {failed ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          Could not change notifications on this device. Try again.
        </p>
      ) : null}
    </div>
  );
}

const PROMPT_KEY = 'enzo.pushPrompt';
const ASK_AGAIN_MS = 14 * 24 * 60 * 60 * 1000;

const dismissedRecently = () => {
  try {
    return Date.now() - Number(localStorage.getItem(PROMPT_KEY) ?? 0) < ASK_AGAIN_MS;
  } catch {
    return false;
  }
};

/**
 * Shown once after sign-in on a device that has never been asked: browsers
 * (iPhone above all) only show their "Allow notifications?" question in answer
 * to a tap, so this card is that tap. On an iPhone in Safari it explains the
 * Home Screen step instead. "Not now" hides it for two weeks; the Settings
 * toggle is always there. Also re-registers a device that already allowed.
 */
export function PushPrompt({ detail }: { detail: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    syncPush().then(setState, () => setState(null));
  }, []);

  const asking = state === 'off' && 'Notification' in window && Notification.permission === 'default';
  // Not over a chat's composer: the card shows on the next page instead.
  if (!(asking || state === 'install') || dismissedRecently() || pathname.startsWith('/messages')) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(PROMPT_KEY, String(Date.now()));
    } catch {
      /* private mode: it asks again next time */
    }
    setState(null);
  };

  const turnOn = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const next = await enablePush();
      if (next !== 'on') dismiss();
      else setState(next);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="region"
      aria-labelledby="push-prompt-title"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-card border border-border bg-surface p-4 shadow-window sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[22rem]"
    >
      <div className="flex gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-900 text-on-primary">
          <BellRinging size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p id="push-prompt-title" className="font-semibold text-ink">
            {state === 'install' ? 'Get notifications on this iPhone' : 'Turn on notifications?'}
          </p>
          <p className="mt-1 text-sm text-ink-muted">{state === 'install' ? PUSH_MESSAGES.install : detail}</p>
          {failed ? (
            <p className="mt-1 text-sm text-danger" role="alert">
              This browser could not turn them on. Try again, or use the installed app.
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {state === 'install' ? (
          <Button variant="secondary" onClick={dismiss}>
            Got it
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={dismiss} disabled={busy}>
              Not now
            </Button>
            <Button variant="primary" onClick={() => void turnOn()} loading={busy}>
              Turn on
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
