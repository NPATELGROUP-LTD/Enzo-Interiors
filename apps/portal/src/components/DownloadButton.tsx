import { DownloadSimple, Eye } from '@phosphor-icons/react';
import { useState } from 'react';

import { Button, Modal } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, documentLink, downloadDocument } from '@/lib/api';
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

/**
 * View (PDFs and images, shown in the page from a fresh five-minute link) and
 * Download. A browser with no PDF reader of its own in a page (Chrome on
 * Android) gets a link that opens the PDF in the phone's viewer instead.
 */
export function DocumentActions({
  document,
  className = 'flex justify-end gap-2',
}: {
  document: Pick<DocumentRecord, 'id' | 'name' | 'preview'>;
  className?: string;
}) {
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  const view = async () => {
    setOpening(true);
    try {
      setLink(await documentLink(document.id, true));
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not open this file. Try Download instead.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className={className}>
      {document.preview ? (
        <Button
          variant="secondary"
          className="px-3 text-xs"
          icon={<Eye size={14} aria-hidden="true" />}
          loading={opening}
          onClick={view}
          aria-label={`View ${document.name}`}
        >
          View
        </Button>
      ) : null}
      <DownloadButton id={document.id} name={document.name} />
      <Modal
        open={link !== null}
        onClose={() => setLink(null)}
        title={document.name}
        width="lg"
        footer={<DownloadButton id={document.id} name={document.name} />}
      >
        {link === null ? null : document.preview === 'image' ? (
          <img src={link} alt={document.name} className="mx-auto max-h-[70dvh] w-auto max-w-full rounded-control" />
        ) : navigator.pdfViewerEnabled ? (
          <iframe
            src={link}
            title={document.name}
            className="h-[70dvh] w-full rounded-control border border-border bg-white"
          />
        ) : (
          <p className="text-ink">
            This browser cannot show a PDF inside the page.{' '}
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-green-900 underline underline-offset-2"
            >
              Open the PDF
            </a>{' '}
            in your phone’s viewer instead.
          </p>
        )}
      </Modal>
    </div>
  );
}
