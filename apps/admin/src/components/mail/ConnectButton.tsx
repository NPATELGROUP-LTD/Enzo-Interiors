import { useState } from 'react';

import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';

/** Sends the person to Google to link (or relink) their own Gmail; Google sends them back to /mail. */
export function ConnectButton({ label = 'Connect your Gmail', variant = 'primary' }: { label?: string; variant?: 'primary' | 'secondary' }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const go = async () => {
    setPending(true);
    try {
      window.location.assign((await api.get<{ url: string }>('/mailbox/connect')).url);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not start connecting Gmail.');
      setPending(false);
    }
  };
  return (
    <Button variant={variant} loading={pending} onClick={() => void go()}>
      {label}
    </Button>
  );
}
