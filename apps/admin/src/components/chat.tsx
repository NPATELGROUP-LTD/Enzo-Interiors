import clsx from 'clsx';
import { CaretDown, Paperclip, PaperPlaneRight } from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { Button, Modal, Select } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';
import type { MessageAttachment } from '@/types/api';

/*
 * The chat's building blocks, shared by the admin's and the portal's Messages
 * (each app keeps an identical copy of this file).
 */

export const MAX_BODY = 5000;

/** http(s):// or www. up to the next space, without trailing punctuation. */
const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/gi;

/** Text and links in order: odd indexes are the links. */
export function linkParts(text: string): string[] {
  return text.split(URL_RE);
}

/** A message body, with its web addresses as links. Text only: never HTML. */
export function MessageText({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap break-words leading-relaxed text-ink">
      {linkParts(text).map((part, index) =>
        index % 2 ? (
          <a
            key={index}
            href={/^www\./i.test(part) ? `https://${part}` : part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-link underline underline-offset-2 [overflow-wrap:anywhere]"
          >
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export interface BubbleAction {
  label: string;
  run: () => void;
}

/**
 * The little arrow a bubble shows on hover (like WhatsApp Web), opening its
 * actions. Put it inside a `group relative` bubble.
 */
export function BubbleMenu({ actions }: { actions: BubbleAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      const outside = event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current?.contains(event.target as Node);
      if (outside) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (!actions.length) return null;
  return (
    <div ref={ref} className="absolute right-1 top-1 z-10">
      <button
        type="button"
        aria-label="Message options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          'flex h-6 w-6 items-center justify-center rounded-full text-ink-muted shadow-soft [background:inherit] hover:text-ink focus-visible:opacity-100 group-hover:opacity-100',
          open ? 'opacity-100' : 'opacity-0',
        )}
      >
        <CaretDown size={14} weight="bold" aria-hidden="true" />
      </button>
      {open ? (
        <ul role="menu" className="absolute right-0 top-7 min-w-44 rounded-[10px] bg-surface p-1 shadow-overlay">
          {actions.map((action) => (
            <li key={action.label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  action.run();
                }}
                className="block w-full truncate rounded-[7px] px-2.5 py-1.5 text-left text-sm text-ink hover:bg-ink/[0.06]"
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** An icon button inside the composer's bar. */
export const TOOL = 'flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-green-900 disabled:opacity-40';

/**
 * One long, thin message bar with its tools (attach, saved replies) inside on
 * the left and a round send button beside it. Grows to about five lines.
 * Enter sends with a keyboard; on a phone Enter is a new line.
 */
export function Composer({
  value,
  onChange,
  onSend,
  sending,
  placeholder,
  tools,
  above,
  canSend,
}: {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  sending: boolean;
  placeholder: string;
  tools?: ReactNode;
  /** Chips for the files about to be sent. */
  above?: ReactNode;
  canSend: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 136)}px`;
  }, [value]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
      className="pt-2"
    >
      {above}
      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 items-end rounded-[24px] border border-border bg-surface pr-4 transition-colors focus-within:border-green-900">
          {tools}
          <label htmlFor="message-body" className="sr-only">
            Message
          </label>
          <textarea
            id="message-body"
            ref={ref}
            rows={1}
            value={value}
            maxLength={MAX_BODY}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                event.preventDefault();
                onSend();
              }
            }}
            placeholder={placeholder}
            className={clsx(
              'min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 leading-normal text-ink outline-none placeholder:text-ink-muted/70',
              !tools && 'pl-4',
            )}
          />
        </div>
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend || sending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-900 text-on-primary transition-[opacity,transform] hover:brightness-110 active:scale-95 disabled:opacity-40"
        >
          <PaperPlaneRight size={18} weight="fill" aria-hidden="true" className={sending ? 'animate-pulse' : undefined} />
        </button>
      </div>
    </form>
  );
}

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.pptx';
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * The paperclip: picks a file on this device and uploads it, shared with the
 * client, onto one of their shared projects (asked when there is a choice).
 * Hands the new file back as an attachment for the next message.
 */
export function UploadButton({
  clientId,
  projects,
  onUploaded,
}: {
  clientId: string;
  projects: Array<{ id: string; name: string }>;
  onUploaded: (attachment: MessageAttachment) => void;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [waiting, setWaiting] = useState<File | null>(null);
  const [projectId, setProjectId] = useState('');
  const [busy, setBusy] = useState(false);

  const upload = async (file: File, project: string) => {
    setBusy(true);
    const form = new FormData();
    form.append('client_id', clientId);
    form.append('project_id', project);
    form.append('type', 'Other');
    form.append('share', 'true');
    form.append('file', file);
    try {
      const doc = await api.post<{ id: string; name: string; size_bytes: number }>('/documents/upload', form);
      onUploaded({ document_id: doc.id, name: doc.name, size_bytes: doc.size_bytes });
      setWaiting(null);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not upload that file.');
    } finally {
      setBusy(false);
    }
  };

  const picked = (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    if (file.size > MAX_BYTES) return toast.error('Files can be up to 25 MB.');
    if (projects.length === 1) return void upload(file, projects[0]!.id);
    setProjectId(projects[0]?.id ?? '');
    setWaiting(file);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy || projects.length === 0}
        aria-label="Attach a file from this device"
        title={projects.length ? 'Attach a file' : 'Files go on a project shared with the client; there is none yet'}
        className={TOOL}
      >
        <Paperclip size={20} aria-hidden="true" className={busy ? 'animate-pulse' : undefined} />
      </button>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(event) => picked(event.target.files?.[0])} />
      {waiting ? (
        <Modal
          open
          onClose={() => setWaiting(null)}
          title="Which project is this for?"
          description={waiting.name}
          footer={
            <>
              <Button variant="secondary" onClick={() => setWaiting(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" loading={busy} onClick={() => void upload(waiting, projectId)}>
                Attach
              </Button>
            </>
          }
        >
          <Select label="Project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Modal>
      ) : null}
    </>
  );
}
