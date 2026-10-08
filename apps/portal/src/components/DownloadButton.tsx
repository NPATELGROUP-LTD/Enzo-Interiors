import { DownloadSimple } from '@phosphor-icons/react';
import { useState } from 'react';

import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, downloadDocument } from '@/lib/api';

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
