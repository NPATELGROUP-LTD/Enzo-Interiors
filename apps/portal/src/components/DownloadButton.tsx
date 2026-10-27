import clsx from 'clsx';
import { DownloadSimple, Eye } from '@phosphor-icons/react';
import { useState } from 'react';

import { Button, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ProtectedView, VIEW_ONLY_NOTE } from '@/components/ProtectedView';
import { ApiError, documentAccess, downloadDocument } from '@/lib/api';
import type { DocumentRecord } from '@/types/api';

/** "Download" for one document, named for screen readers by the file it fetches. */
export function DownloadButton({ id, name }: { id: string; name: string }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);

  const download = async () => {
    setPending(true);
    try {
      await downloadDocument(id);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not download this file. Try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      variant="secondary"
      className="px-3 text-xs"
      icon={<DownloadSimple size={14} aria-hidden="true" />}
      loading={pending}
      onClick={download}
      aria-label={`Download ${name}`}
    >
      Download
    </Button>
  );
}

/** Which viewer a file's name suggests (chat attachments carry no type). Only a
 *  hint: the API serves the file by the type it checked at upload, and as a
 *  download when that type cannot be shown in a page. */
export function previewOfName(name: string): Preview | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'pdf') return 'pdf';
  return ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? 'image' : null;
}

type Preview = NonNullable<DocumentRecord['preview']>;
type Openable = { id: string; name: string; preview?: Preview | null };
type Shown = { file: Openable; preview: Preview; link: string; canSave: boolean };

/**
 * Opens a PDF or image in a dialog, from a fresh five-minute link made on
 * click; anything else is saved, if an Admin allowed it. A file the client may only
 * view is shown behind a watermark (ProtectedView) with no Download. A browser with no PDF reader of its own in a
 * page (Chrome on Android) gets a link that opens the PDF in the phone's
 * viewer instead. Render `viewer` once; call `show` from any row.
 */
export function useFileViewer() {
  const toast = useToast();
  const [shown, setShown] = useState<Shown | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const show = async (file: Openable) => {
    // The API's own answer when it gave one (null = cannot be shown).
    const preview = file.preview !== undefined ? file.preview : previewOfName(file.name);
    setOpening(file.id);
    try {
      if (preview) {
        const { url, canSave } = await documentAccess(file.id, true);
        setShown({ file, preview, link: url, canSave });
      } else await downloadDocument(file.id); // the API refuses it with the reason when saving is not allowed
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not open this file. Try again.');
    } finally {
      setOpening(null);
    }
  };

  const content = shown && (shown.preview === 'image' ? (
        <img
          src={shown.link}
          alt={shown.file.name}
          draggable={false}
          className="mx-auto max-h-[70dvh] w-auto max-w-full rounded-control"
        />
      ) : navigator.pdfViewerEnabled ? (
        <iframe
          // View only: ask the browser's PDF viewer to leave out its save and print toolbar.
          src={shown.canSave ? shown.link : `${shown.link}#toolbar=0&navpanes=0`}
          title={shown.file.name}
          className="h-[70dvh] w-full rounded-control border border-border bg-white"
        />
      ) : (
        <p className="text-ink">
          This browser cannot show a PDF inside the page.{' '}
          <a
            href={shown.link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-green-900 underline underline-offset-2"
          >
            Open the PDF
          </a>{' '}
          in your phone’s viewer instead.
        </p>
      ));

  const viewer = (
    <Modal
      open={shown !== null}
      onClose={() => setShown(null)}
      title={shown?.file.name ?? ''}
      width="lg"
      footer={
        shown ? (
          shown.canSave ? (
            <DownloadButton id={shown.file.id} name={shown.file.name} />
          ) : (
            <p className="mr-auto text-xs text-ink-muted">{VIEW_ONLY_NOTE}</p>
          )
        ) : null
      }
    >
      {shown === null ? null : shown.canSave ? content : <ProtectedView>{content}</ProtectedView>}
    </Modal>
  );

  return { show, opening, viewer };
}

/** View (PDFs and images, shown in the page) and, if an Admin allowed it, Download for one document. */
export function DocumentActions({
  document,
  className = 'flex justify-end gap-2',
}: {
  document: Pick<DocumentRecord, 'id' | 'name' | 'preview' | 'client_can_download'>;
  className?: string;
}) {
  const files = useFileViewer();
  return (
    <div className={className}>
      {document.preview ? (
        <Button
          variant="secondary"
          className="px-3 text-xs"
          icon={<Eye size={14} aria-hidden="true" />}
          loading={files.opening === document.id}
          onClick={() => void files.show(document)}
          aria-label={`View ${document.name}`}
        >
          View
        </Button>
      ) : null}
      {document.client_can_download ? <DownloadButton id={document.id} name={document.name} /> : null}
      {files.viewer}
    </div>
  );
}

/** A document's name that opens it: shown in the page when it can be, else saved. */
export function DocumentName({
  document,
  className,
}: {
  document: Pick<DocumentRecord, 'id' | 'name' | 'preview'>;
  className?: string;
}) {
  const files = useFileViewer();
  return (
    <>
      <button
        type="button"
        onClick={() => void files.show(document)}
        className={clsx('text-left hover:text-green-900 hover:underline hover:underline-offset-2', className)}
      >
        {document.name}
      </button>
      {files.viewer}
    </>
  );
}
