import { useEffect, useState } from 'react';

import { Toggle } from '@/components/ui';
import { tokenStore } from '@/lib/api';
import { PUSH_MESSAGES, disablePush, enablePush, pushState, type PushState } from '@/lib/push';

/** "Notifications on this device": Web Push for this browser only. */
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    pushState().then(setState, () => setState('unsupported'));
  }, []);

  const change = async (next: boolean) => {
    setBusy(true);
    setFailed(false);
    try {
      if (next) setState(await enablePush());
      else {
        await disablePush(tokenStore.get());
        setState('off');
      }
    } catch {
      setFailed(true);
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
      {failed ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          Could not change notifications on this device. Try again.
        </p>
      ) : null}
    </div>
  );
}
