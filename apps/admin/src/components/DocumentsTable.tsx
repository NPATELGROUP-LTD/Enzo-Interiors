import { DownloadSimple, Trash, UploadSimple } from '@phosphor-icons/react';
import { useRef, useState, type FormEvent } from 'react';

import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  StatusTag,
  TableWrap,
  Td,
  Th,
  Toggle,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, fileSize } from '@/lib/format';
import type { DocumentDownload, DocumentRecord, DocumentType } from '@/types/api';
import { DOCUMENT_TYPES } from '@/types/api';

type Row = Omit<DocumentRecord, 'client_name' | 'project_name'>;

/** What the API takes (apps/api documents.module.ts FILE_TYPES), for the picker. */
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.pptx';
const MAX_BYTES = 25 * 1024 * 1024;
const TYPE_LABELS: Record<DocumentType, string> = {
  Plan: 'Plan',
  Contract: 'Contract',
  MoodBoard: 'Mood board',
  Invoice: 'Invoice',
};

const message = (caught: unknown, fallback: string) => (caught instanceof ApiError ? caught.message : fallback);

/**
 * A project's or client's files. Anyone who can see the row downloads it (a
 * fresh five-minute link per click) and may delete it; only an Admin shows it
 * to the client. With `uploadTo`, files can be added to that project.
 */
export function DocumentsTable({
  documents,
  onChanged,
  uploadTo,
  emptyMessage,
}: {
  documents: Row[];
  onChanged: () => Promise<unknown> | void;
  uploadTo?: { clientId: string; projectId: string };
  emptyMessage: string;
}) {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<Row | null>(null);

  const download = async (row: Row) => {
    try {
      const { url } = await api.get<DocumentDownload>(`/documents/${row.id}/download`);
      // Served as an attachment, so this downloads rather than navigating away.
      window.location.assign(url);
    } catch (caught) {
      toast.error(message(caught, 'Could not download this file.'));
    }
  };

  const setVisible = async (row: Row, next: boolean) => {
    try {
      await api.patch(`/documents/${row.id}/visibility`, { client_visible: next });
      toast.success(next ? `${row.name} is now visible to the client.` : `${row.name} is internal only.`);
      await onChanged();
    } catch (caught) {
      toast.error(message(caught, 'Could not change who can see this file.'));
    }
  };

  const remove = async () => {
    const row = deleting;
    setDeleting(null);
    if (!row) return;
    try {
      await api.delete(`/documents/${row.id}`);
      toast.success(`${row.name} deleted.`);
      await onChanged();
    } catch (caught) {
      toast.error(message(caught, 'Could not delete this file.'));
    }
  };

  return (
    <>
      {uploadTo ? (
        <div className="mb-3 flex justify-end">
          <Button icon={<UploadSimple size={15} aria-hidden="true" />} onClick={() => setUploading(true)}>
            Upload
          </Button>
        </div>
      ) : null}

      {documents.length === 0 ? (
        <Card className="p-0">
          <EmptyState title="No documents" message={emptyMessage} />
        </Card>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Uploaded</Th>
              <Th>Size</Th>
              <Th>Visible to client</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {documents.map((row) => (
              <tr key={row.id}>
                <Td className="font-medium text-ink">{row.name}</Td>
                <Td>
                  <StatusTag tone="info">{TYPE_LABELS[row.type]}</StatusTag>
                </Td>
                <Td className="whitespace-nowrap text-ink-muted">{date(row.upload_date)}</Td>
                <Td className="tabular whitespace-nowrap text-ink-muted">{fileSize(row.size_bytes)}</Td>
                <Td>
                  {isAdmin ? (
                    <Toggle
                      hideLabel
                      label={`Visible to client: ${row.name}`}
                      checked={row.client_visible}
                      onChange={(next) => void setVisible(row, next)}
                    />
                  ) : (
                    <StatusTag tone={row.client_visible ? 'success' : 'neutral'}>
                      {row.client_visible ? 'Visible' : 'Internal only'}
                    </StatusTag>
                  )}
                </Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      icon={<DownloadSimple size={15} aria-hidden="true" />}
                      onClick={() => void download(row)}
                    >
                      Download
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-danger"
                      aria-label={`Delete ${row.name}`}
                      icon={<Trash size={15} aria-hidden="true" />}
                      onClick={() => setDeleting(row)}
                    />
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {uploadTo ? (
        <UploadDialog
          open={uploading}
          target={uploadTo}
          onClose={() => setUploading(false)}
          onUploaded={async () => {
            setUploading(false);
            await onChanged();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'this file'}?`}
        message="The file is removed from storage too. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

function UploadDialog({
  open,
  target,
  onClose,
  onUploaded,
}: {
  open: boolean;
  target: { clientId: string; projectId: string };
  onClose: () => void;
  onUploaded: () => Promise<void>;
}) {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<DocumentType>('Plan');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setFile(null);
    setName('');
    setError(null);
    onClose();
  };

  const choose = (picked: File | undefined) => {
    setError(null);
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      setError(`That file is ${fileSize(picked.size)}. The limit is 25 MB.`);
      return;
    }
    setFile(picked);
    setName(picked.name);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    const form = new FormData();
    form.append('client_id', target.clientId);
    form.append('project_id', target.projectId);
    form.append('type', type);
    form.append('name', name.trim() || file.name);
    form.append('file', file);
    setBusy(true);
    try {
      await api.post('/documents/upload', form);
      toast.success(`${name.trim() || file.name} uploaded.`);
      setFile(null);
      setName('');
      await onUploaded();
    } catch (caught) {
      setError(message(caught, 'Could not upload this file.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Upload a document"
      description="New files are internal. An Admin makes them visible to the client."
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="document-upload" loading={busy}>
            Upload
          </Button>
        </>
      }
    >
      <form id="document-upload" onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label="File"
            onChange={(event) => choose(event.target.files?.[0])}
          />
          <div className="flex items-center gap-3">
            <Button type="button" icon={<UploadSimple size={15} aria-hidden="true" />} onClick={() => fileInput.current?.click()}>
              {file ? 'Choose another' : 'Choose file'}
            </Button>
            <p className="min-w-0 truncate text-ink-muted">
              {file ? `${file.name} · ${fileSize(file.size)}` : 'PDF, image, Word, Excel or PowerPoint, up to 25 MB'}
            </p>
          </div>
        </div>
        <Input label="Name" value={name} maxLength={160} onChange={(event) => setName(event.target.value)} />
        <Select label="Type" value={type} onChange={(event) => setType(event.target.value as DocumentType)}>
          {DOCUMENT_TYPES.map((option) => (
            <option key={option} value={option}>
              {TYPE_LABELS[option]}
            </option>
          ))}
        </Select>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
