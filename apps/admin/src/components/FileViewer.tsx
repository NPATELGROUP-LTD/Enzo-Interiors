import { DownloadSimple } from '@phosphor-icons/react';
import { useState } from 'react';

import { Button, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, documentLink } from '@/lib/api';

export type Preview = 'pdf' | 'image' | 'video';
export interface ViewableFile {
  id: string;
  name: string;
  preview: Preview;
  /** A source that is not a document (team chat files): makes the signed link itself. */
  link?: () => Promise<string>;
}

/**
 * Which viewer a file's name suggests (chat attachments carry no type). Only a
 * hint: the API serves the file by the type it checked at upload, and as a
 * download when that type cannot be shown in a page.
 */
export function previewOfName(name: string): Preview | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'pdf';
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? 'image' : null;
}

/** Saves a file from a fresh five-minute link; the page stays where it is. */
export async function downloadFile(id: string): Promise<void> {
  window.location.assign(await documentLink(id));
}

/**
 * Opens a PDF or image in a dialog, from a fresh five-minute link made on
 * click. A browser with no PDF reader of its own in a page (Chrome on Android)
 * gets a link that opens the PDF in the phone's viewer instead. Render
 * `viewer` once; call `open` from any row.
 */
export function useFileViewer() {
  const toast = useToast();
  const [shown, setShown] = useState<{ file: ViewableFile; link: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const open = async (file: ViewableFile) => {
    setOpening(file.id);
    try {
      setShown({ file, link: file.link ? await file.link() : await documentLink(file.id, true) });
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not open this file. Try Download instead.');
    } finally {
      setOpening(null);
    }
  };

  const download = async (id: string) => {
    try {
      await downloadFile(id);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not download this file.');
    }
  };

  const viewer = (
    <Modal
      open={shown !== null}
      onClose={() => setShown(null)}
      title={shown?.file.name ?? ''}
      width="lg"
      footer={
        shown ? (
          <Button
            icon={<DownloadSimple size={15} aria-hidden="true" />}
            onClick={() => (shown.file.link ? void window.open(shown.link, '_blank', 'noopener,noreferrer') : void download(shown.file.id))}
          >
            Download
          </Button>
        ) : null
      }
    >
      {shown === null ? null : shown.file.preview === 'image' ? (
        <img src={shown.link} alt={shown.file.name} className="mx-auto max-h-[70dvh] w-auto max-w-full rounded-control" />
      ) : shown.file.preview === 'video' ? (
        <video src={shown.link} controls className="mx-auto max-h-[70dvh] w-auto max-w-full rounded-control" />
      ) : navigator.pdfViewerEnabled ? (
        <iframe src={shown.link} title={shown.file.name} className="h-[70dvh] w-full rounded-control border border-border bg-white" />
      ) : (
        <p className="text-ink">
          This browser cannot show a PDF inside the page.{' '}
          <a href={shown.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-900 underline underline-offset-2">
            Open the PDF
          </a>{' '}
          in your phone’s viewer instead.
        </p>
      )}
    </Modal>
  );

  /** View what can be shown, download the rest. */
  const show = (file: { id: string; name: string; preview?: Preview | null; link?: () => Promise<string> }) => {
    // The API's own answer when it gave one (null = cannot be shown).
    const preview = file.preview !== undefined ? file.preview : previewOfName(file.name);
    if (preview) return open({ id: file.id, name: file.name, preview, link: file.link });
    // A team file that cannot be shown: its signed link downloads it.
    return file.link ? file.link().then((url) => void window.open(url, '_blank', 'noopener,noreferrer')) : download(file.id);
  };

  return { show, opening, viewer, download };
}
