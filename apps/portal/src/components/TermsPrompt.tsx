import { useState } from 'react';

import { Button, Checkbox, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TERMS_VERSION } from '@/lib/legal';

/**
 * Asked at sign-in or next open until the client accepts the current terms, and again whenever the studio
 * asks (Admin › the client's page). It cannot be dismissed: the only ways out are "I agree" and signing out.
 * The API keeps the record (time, version, IP, browser kind); the full text is /terms, open in a new tab.
 */
export function TermsPrompt() {
  const toast = useToast();
  const { user, logout, termsAgreed } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `undefined` is a session cached before this existed; /auth/me fills it in on start.
  if (user?.termsAccepted !== false) return null;

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post('/account/terms/accept', { version: TERMS_VERSION });
      termsAgreed();
      toast.success('Thank you. Your agreement is recorded.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save that. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => undefined}
      title="Terms of use"
      description="Please read and accept these to carry on using your portal."
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={logout} disabled={busy}>
            Sign out
          </Button>
          <Button variant="primary" onClick={() => void accept()} disabled={!agreed} loading={busy}>
            I agree
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm text-ink-muted">
        <p>
          What you do in your account, such as approving a design, accepting or declining a quotation, asking for
          changes or sending a message, is treated as done by you and is legally binding on you, as if you had signed
          it on paper.
        </p>
        <p>
          We record the date and time, your IP address and your browser kind when you agree.{' '}
          <a href="/terms" target="_blank" rel="noreferrer" className="font-medium text-green-900 underline">
            Read the full terms
          </a>
          .
        </p>
        <Checkbox label="I have read and agree to the terms of use" checked={agreed} onChange={setAgreed} />
        {error ? <p role="alert" className="text-danger">{error}</p> : null}
      </div>
    </Modal>
  );
}
