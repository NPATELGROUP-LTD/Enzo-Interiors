import clsx from 'clsx';
import { Image as ImageIcon, UploadSimple, X } from '@phosphor-icons/react';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';

import { Button, EmptyState, ErrorState, Input, LoadingState, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
  type MediaAsset,
  type UploadTicket,
} from '@/types/cms';

/** The public site. */
export const WEB_URL = (import.meta.env.VITE_WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/**
 * Uploads a file and returns the library row for it.
 *
 * Three steps, because the browser never holds a storage credential: ask the
 * API for a short-lived upload URL, PUT the bytes straight to storage, then
 * tell the API the object landed so it becomes a row. The middle request goes
 * out as a bare fetch on purpose — it is addressed to object storage, not to
 * our API, and attaching our bearer token to it would send a staff credential
 * to a third party.
 */
async function upload(file: File, alt: string): Promise<MediaAsset> {
  const ticket = await api.post<UploadTicket>('/cms/media/upload-url', {
    filename: file.name,
    content_type: file.type,
    byte_size: file.size,
  });

  const put = await fetch(ticket.url, {
    method: 'PUT',
    // Both are signed into the URL; storage rejects the PUT if either differs.
    headers: { 'Content-Type': file.type, 'Cache-Control': 'public, max-age=31536000, immutable' },
    body: file,
  });
  if (!put.ok) {
    throw new ApiError(put.status, 'The file could not be uploaded to storage. Try again.');
  }

  return api.post<MediaAsset>('/cms/media', {
    storage_key: ticket.storage_key,
    alt,
  });
}

/** A single thumbnail. PDFs have no preview, so they get a labelled tile. */
function Thumb({
  asset,
  selected,
  index,
  onClick,
}: {
  asset: MediaAsset;
  selected: boolean;
  /** 1-based position when this is part of an ordered gallery. */
  index?: number;
  onClick: () => void;
}) {
  const isImage = asset.mime_type !== 'application/pdf';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        'group relative flex flex-col overflow-hidden rounded-[10px] text-left transition',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35',
        selected ? 'bg-green-100 ring-[3px] ring-green-900' : 'bg-surface-muted/60 hover:bg-surface-muted',
      ].join(' ')}
    >
      <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-muted">
        {isImage && asset.src_resolved ? (
          <img
            src={asset.src_resolved}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon size={22} className="text-ink-muted" aria-hidden="true" />
        )}
      </span>
      <span className="flex flex-col gap-0.5 px-2.5 py-2">
        <span className="truncate text-xs font-semibold text-ink">{asset.title ?? asset.id}</span>
        <span className="truncate text-[11px] text-ink-muted">
          {asset.alt || 'No alt text'}
        </span>
      </span>
      {index !== undefined ? (
        <span className="tabular absolute left-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-green-900 px-1.5 text-[11px] font-semibold text-white">
          {index}
        </span>
      ) : null}
    </button>
  );
}

interface PickerProps {
  open: boolean;
  onClose: () => void;
  /** Ordered ids when multiple, a single-entry array otherwise. */
  value: string[];
  multiple: boolean;
  onChange: (next: string[]) => void;
  title: string;
  /** Called after an upload adds a picture to the library. */
  onUploaded?: () => void;
}

/**
 * The image library, as a picker.
 *
 * Doubles as the media manager: there is no separate Media screen, because
 * everything one would do there — look through the images, upload a new one,
 * fix a piece of alt text — is something you want to do at the moment you are
 * choosing a picture, not on a different page.
 */
export function MediaPicker({ open, onClose, value, multiple, onChange, title, onUploaded }: PickerProps) {
  const toast = useToast();
  const assets = useQuery<MediaAsset[]>(open ? '/cms/media' : null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const rows = assets.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.id, row.alt, row.title ?? '', row.source].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [assets.data, search]);

  const toggle = (id: string) => {
    if (!multiple) {
      onChange([id]);
      onClose();
      return;
    }
    onChange(value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id]);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
      );
      return;
    }

    // Alt text is required for every public image, so it is collected at the
    // moment of upload rather than left for a later pass that never happens.
    const alt = window.prompt(
      `Describe this image for screen readers and search engines.\n\nFor example: "Walnut kitchen island with brass handles".`,
      '',
    );
    if (alt === null) return;
    if (alt.trim().length < 3) {
      toast.error('That description is too short to be useful. Nothing was uploaded.');
      return;
    }

    setBusy(true);
    try {
      const created = await upload(file, alt.trim());
      await assets.refetch();
      onUploaded?.();
      onChange(multiple ? [...value, created.id] : [created.id]);
      toast.success('Image uploaded.');
      if (!multiple) onClose();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That upload did not work.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} width="lg">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Input
              label="Search"
              placeholder="Name, description or source"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <input
            ref={fileInput}
            type="file"
            accept={UPLOAD_ACCEPT}
            onChange={onFile}
            className="sr-only"
          />
          <Button
            variant="secondary"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            icon={<UploadSimple size={16} />}
          >
            {busy ? 'Uploading…' : 'Upload'}
          </Button>
        </div>

        {assets.loading && !assets.data ? (
          <LoadingState label="Loading the image library…" />
        ) : assets.error ? (
          <ErrorState message={assets.error} onRetry={assets.refetch} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search ? 'Nothing matches that' : 'No images yet'}
            message={
              search
                ? 'Try a different word, or upload a new image.'
                : 'Upload the first one to get started.'
            }
          />
        ) : (
          <div className="grid max-h-[46vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((asset) => (
              <Thumb
                key={asset.id}
                asset={asset}
                selected={value.includes(asset.id)}
                index={multiple && value.includes(asset.id) ? value.indexOf(asset.id) + 1 : undefined}
                onClick={() => toggle(asset.id)}
              />
            ))}
          </div>
        )}

        {multiple ? (
          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-ink-muted">
              {value.length === 0
                ? 'Nothing selected. The first image you pick is the cover.'
                : `${value.length} selected, in the order you picked them. The first is the cover.`}
            </p>
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/** The chosen image(s), with the controls to change them. */
export function MediaField({
  label,
  hint,
  value,
  multiple,
  onChange,
  assets,
  onAssetsChanged,
  logo,
}: {
  label: string;
  hint?: string;
  value: string[];
  multiple: boolean;
  onChange: (next: string[]) => void;
  assets: MediaAsset[];
  onAssetsChanged?: () => void;
  /** Show the whole image on the ground it is meant for, rather than a cropped photo. */
  logo?: 'light' | 'dark';
}) {
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink-muted">{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((id, position) => {
          const asset = byId.get(id);
          return (
            <span key={`${id}-${position}`} className="relative">
            <span
              className={clsx(
                'flex h-20 items-center justify-center overflow-hidden rounded-[10px]',
                logo === 'dark' ? 'w-40 bg-green-900' : logo ? 'w-40 bg-surface-muted' : 'w-28 bg-surface-muted',
              )}
            >
              {asset?.src_resolved ? (
                <img
                  src={asset.src_resolved}
                  alt={asset.alt}
                  className={logo ? 'h-full w-full object-contain p-3' : 'h-full w-full object-cover'}
                />
              ) : (
                // A referenced id with no row behind it. Showing the id beats
                // showing an empty box, because the id is what to search for.
                <span className="px-1 text-center text-[10px] leading-tight text-ink-muted">{id}</span>
              )}
            </span>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, index) => index !== position))}
                aria-label={`Remove ${asset?.alt || id}`}
                className="group absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full"
              >
                <span className="rounded-full bg-ink/75 p-1 text-white shadow-soft group-hover:bg-ink">
                  <X size={12} aria-hidden="true" />
                </span>
              </button>
            </span>
          );
        })}
        <Button variant="secondary" onClick={() => setOpen(true)} icon={<ImageIcon size={16} />}>
          {value.length === 0 ? 'Choose' : multiple ? 'Add or reorder' : 'Replace'}
        </Button>
      </div>
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}

      <MediaPicker
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        multiple={multiple}
        onChange={onChange}
        title={multiple ? `${label} — pick images in order` : `${label} — pick an image`}
        onUploaded={onAssetsChanged}
      />
    </div>
  );
}
