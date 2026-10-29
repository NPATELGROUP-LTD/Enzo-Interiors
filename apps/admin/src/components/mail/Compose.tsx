import { PaperPlaneTilt, Paperclip, X } from '@phosphor-icons/react';
import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';

import { Button, Checkbox, ConfirmDialog, Input, Modal, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';
import { fileSize } from '@/lib/format';
import { addressesIn } from '@/lib/mail';
import type { Draft } from '@/types/mail';

const LIMIT = 25 * 1024 * 1024;

/** The compose sheet: a new message, a reply, or a forward. Sent from the person's own Gmail. */
export function ComposeSheet({ draft, onClose, onSent }: { draft: Draft | null; onClose: () => void; onSent: () => void }) {
  // The form says whether anything was changed; closing a changed message asks first, an untouched one just closes.
  const dirty = useRef(false);
  const [asking, setAsking] = useState(false);
  const close = () => (dirty.current ? setAsking(true) : onClose());
  return (
    <>
      <Modal open={draft !== null} onClose={close} title={draft?.replyToId ? 'Reply' : draft?.forwardId ? 'Forward' : 'New message'} width="lg">
        {draft ? <Form draft={draft} dirty={dirty} onClose={close} onSent={onSent} /> : null}
      </Modal>
      <ConfirmDialog
        open={asking}
        title="Discard this message?"
        message="What you have written will be lost."
        confirmLabel="Discard"
        onConfirm={() => {
          setAsking(false);
          dirty.current = false;
          onClose();
        }}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}

function Form({ draft, dirty, onClose, onSent }: { draft: Draft; dirty: RefObject<boolean>; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const [to, setTo] = useState(draft.to);
  const [cc, setCc] = useState(draft.cc);
  const [bcc, setBcc] = useState(draft.bcc);
  const [showCc, setShowCc] = useState(Boolean(draft.cc));
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState(draft.subject);
  const [body, setBody] = useState(draft.body);
  const [files, setFiles] = useState<File[]>([]);
  const [kept, setKept] = useState<Set<string>>(new Set(draft.forwardFiles?.map((f) => f.part_id)));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const forwarded = (draft.forwardFiles ?? []).filter((f) => kept.has(f.part_id));
  useEffect(() => {
    dirty.current =
      to !== draft.to || cc !== draft.cc || bcc !== draft.bcc || subject !== draft.subject || body !== draft.body || files.length > 0 || kept.size !== (draft.forwardFiles?.length ?? 0);
  }, [dirty, draft, to, cc, bcc, subject, body, files, kept]);
  useEffect(() => () => void (dirty.current = false), [dirty]);

  const total = files.reduce((sum, f) => sum + f.size, 0) + forwarded.reduce((sum, f) => sum + f.size, 0);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const recipients = addressesIn(to);
    if (recipients.length === 0) return setError('Add at least one recipient.');
    if (total > LIMIT) return setError('Attachments can be 25 MB in all.');
    const data = new FormData();
    data.set('to', recipients.join(','));
    if (addressesIn(cc).length) data.set('cc', addressesIn(cc).join(','));
    if (addressesIn(bcc).length) data.set('bcc', addressesIn(bcc).join(','));
    data.set('subject', subject.trim());
    data.set('body', body);
    if (draft.replyToId) data.set('reply_to_id', draft.replyToId);
    if (draft.forwardId) {
      data.set('forward_id', draft.forwardId);
      data.set('forward_parts', forwarded.map((f) => f.part_id).join(','));
    }
    for (const file of files) data.append('files', file, file.name);
    setSending(true);
    setProgress(0);
    setError(null);
    try {
      await api.upload('/mailbox/send', data, setProgress);
      toast.success('Sent.');
      onSent();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not send. Please try again.');
      setSending(false);
      setProgress(null);
    }
  };

  return (
    <form onSubmit={send} className="flex flex-col gap-3" noValidate>
      <Input label="To" value={to} onChange={(e) => setTo(e.target.value)} autoComplete="off" placeholder="name@example.com, another@example.com" required />
      {showCc || showBcc ? null : (
        <div className="-mt-1 flex gap-3 text-[13px]">
          <button type="button" className="text-link" onClick={() => setShowCc(true)}>Cc</button>
          <button type="button" className="text-link" onClick={() => setShowBcc(true)}>Bcc</button>
        </div>
      )}
      {showCc ? <Input label="Cc" value={cc} onChange={(e) => setCc(e.target.value)} autoComplete="off" /> : null}
      {showBcc ? <Input label="Bcc" value={bcc} onChange={(e) => setBcc(e.target.value)} autoComplete="off" /> : null}
      <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={300} />
      <Textarea label="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={10} />

      {draft.forwardFiles?.length ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-semibold text-ink">Attachments from the original</legend>
          {draft.forwardFiles.map((file) => (
            <Checkbox
              key={file.part_id}
              label={`${file.filename} (${fileSize(file.size)})`}
              checked={kept.has(file.part_id)}
              onChange={(on) => setKept((current) => new Set(on ? [...current, file.part_id] : [...current].filter((id) => id !== file.part_id)))}
            />
          ))}
        </fieldset>
      ) : null}

      {files.length ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex max-w-full items-center gap-1.5 rounded-control bg-surface-muted py-1 pl-2.5 pr-1 text-[13px] text-ink">
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-ink-muted">{fileSize(file.size)}</span>
              <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, j) => j !== i))} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-ink/10">
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {sending && progress !== null ? (
        <div aria-live="polite">
          <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <div className="h-full rounded-full bg-green-900 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-1 text-[13px] text-ink-muted">{progress < 1 ? `Uploading ${Math.round(progress * 100)}%` : 'Sending…'}</p>
        </div>
      ) : null}

      {error ? <p role="alert" className="text-[13px] text-danger">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              // Read the files before clearing the input: the list is live, and the updater below runs later.
              const picked = Array.from(e.target.files ?? []);
              e.target.value = '';
              setFiles((current) => [...current, ...picked]);
            }}
          />
          <Button type="button" variant="secondary" icon={<Paperclip size={16} aria-hidden="true" />} onClick={() => picker.current?.click()}>
            Attach
          </Button>
          <span className={total > LIMIT ? 'text-[13px] text-danger' : 'text-[13px] text-ink-muted'}>{total > 0 ? `${fileSize(total)} of 25 MB` : ''}</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Discard</Button>
          <Button type="submit" variant="primary" loading={sending} icon={<PaperPlaneTilt size={16} aria-hidden="true" />}>Send</Button>
        </div>
      </div>
    </form>
  );
}
