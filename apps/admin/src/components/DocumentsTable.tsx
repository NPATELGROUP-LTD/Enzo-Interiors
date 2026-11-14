import { DownloadSimple, Eye, Trash, UploadSimple } from '@phosphor-icons/react';
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
import { useFileViewer } from '@/components/FileViewer';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { date, fileSize } from '@/lib/format';
import { useQuery } from '@/hooks/useApi';
import { useSort } from '@/hooks/useSort';
import type { DocumentRecord } from '@/types/api';

type Row = Omit<DocumentRecord, 'client_name' | 'project_name'>;

/** What the API takes (apps/api documents.module.ts FILE_TYPES), for the picker. */
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.pptx';
const MAX_BYTES = 25 * 1024 * 1024;
// A stored type shows as the studio's own label (Settings › Document categories); only this one is spelled differently.
const label = (category: string) => (category === 'MoodBoard' ? 'Mood board' : category);

const message = (caught: unknown, fallback: string) =>
  caught instanceof ApiError ? caught.message : fallback;

/**
 * A project's or client's files. Anyone who can see the row downloads it (a
 * fresh five-minute link per click) and may delete it; only an Admin shows it
 * to the client. With `uploadTo`, files can be added to that project.
 */
export function DocumentsTable({
  documents,
  onChanged,
  emptyMessage,
  wrapClassName,
  list,
}: {
  documents: Row[];
  onChanged: () => Promise<unknown> | void;
  emptyMessage: string;
  wrapClassName?: string;
  /** Cards instead of a table, for a narrow box. */
  list?: boolean;
}) {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [category, setCategory] = useState('');

  const files = useFileViewer();
  // Filter by the labels the files actually carry, so a category dropped from Settings still finds its files.
  const categories = [...new Set(documents.map((row) => row.category))].sort();
  const shown = category && categories.includes(category) ? documents.filter((row) => row.category === category) : documents;
  const { rows: sortedShown, header } = useSort(shown, {
    name: (row) => row.name,
    category: (row) => row.category,
    uploaded: (row) => row.upload_date,
    size: (row) => row.size_bytes,
  });

  const setDownload = async (row: Row, next: boolean) => {
    try {
      await api.patch(`/documents/${row.id}/client-download`, { client_can_download: next });
      toast.success(next ? `The client can now download ${row.name}.` : `${row.name} is view-only for the client.`);
      await onChanged();
    } catch (caught) {
      toast.error(message(caught, 'Could not change that.'));
    }
  };

  const setVisible = async (row: Row, next: boolean) => {
    try {
      await api.patch(`/documents/${row.id}/visibility`, { client_visible: next });
      toast.success(
        next ? `${row.name} is now visible to the client.` : `${row.name} is internal only.`,
      );
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
      {documents.length === 0 ? (
        <Card className="p-0">
          <EmptyState title="No documents" message={emptyMessage} />
        </Card>
      ) : (
        <>
        {categories.length > 1 ? (
          <div className="mb-3 max-w-56">
            <Select label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((entry) => (
                <option key={entry} value={entry}>
                  {label(entry)}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        {list ? (
          <Card className={wrapClassName}>
            <ul className="rows">
              {sortedShown.map((row) => (
                <li key={row.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => void files.show(row)}
                        title={row.name}
                        className="line-clamp-2 text-left font-semibold leading-snug text-ink [overflow-wrap:anywhere] hover:text-green-900 hover:underline hover:underline-offset-2"
                      >
                        {row.name}
                      </button>
                      <p className="mt-1 text-xs text-ink-muted">
                        <span className="font-medium text-ink">{label(row.category)}</span> · {date(row.upload_date)} ·{' '}
                        <span className="tabular">{fileSize(row.size_bytes)}</span>
                      </p>
                    </div>
                    <div className="-mr-1 -mt-1 flex shrink-0">
                      {row.preview ? (
                        <Button
                          variant="ghost"
                          icon={<Eye size={15} aria-hidden="true" />}
                          loading={files.opening === row.id}
                          onClick={() => void files.show(row)}
                          aria-label={`View ${row.name}`}
                        />
                      ) : null}
                      <Button
                        variant="ghost"
                        icon={<DownloadSimple size={15} aria-hidden="true" />}
                        onClick={() => void files.download(row.id)}
                        aria-label={`Download ${row.name}`}
                      />
                      <Button
                        variant="ghost"
                        className="text-danger"
                        aria-label={`Delete ${row.name}`}
                        icon={<Trash size={15} aria-hidden="true" />}
                        onClick={() => setDeleting(row)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-x-6 border-t border-border pt-2 sm:grid-cols-2">
                    {isAdmin ? (
                      <>
                        <Toggle
                          label="Client sees"
                          checked={row.client_visible}
                          onChange={(next) => void setVisible(row, next)}
                        />
                        <Toggle
                          label="Can download"
                          checked={row.client_can_download}
                          onChange={(next) => void setDownload(row, next)}
                        />
                      </>
                    ) : (
                      <StatusTag tone={row.client_visible ? 'success' : 'neutral'}>
                        {row.client_visible ? 'Visible to client' : 'Internal only'}
                      </StatusTag>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
        <TableWrap wrapClassName={wrapClassName}>
          <thead>
            <tr>
              <Th sort={header('name')}>Name</Th>
              <Th col="xl" sort={header('category')}>Category</Th>
              <Th col="md" sort={header('uploaded')}>Uploaded</Th>
              <Th col="lg" sort={header('size')}>Size</Th>
              <Th>Visible to client</Th>
              {isAdmin ? <Th>Client can download</Th> : null}
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {sortedShown.map((row) => (
              <tr key={row.id}>
                <Td className="font-medium text-ink">
                  {/* The name opens it: shown in the page when it can be, else saved. */}
                  <button
                    type="button"
                    onClick={() => void files.show(row)}
                    className="text-left hover:text-green-900 hover:underline hover:underline-offset-2"
                  >
                    {row.name}
                  </button>
                </Td>
                <Td col="xl">
                  <StatusTag tone="info">{label(row.category)}</StatusTag>
                </Td>
                <Td col="md" className="whitespace-nowrap text-ink-muted">{date(row.upload_date)}</Td>
                <Td col="lg" className="tabular whitespace-nowrap text-ink-muted">
                  {fileSize(row.size_bytes)}
                </Td>
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
                {isAdmin ? (
                  <Td>
                    <Toggle
                      hideLabel
                      label={`Client can download: ${row.name}`}
                      checked={row.client_can_download}
                      onChange={(next) => void setDownload(row, next)}
                    />
                  </Td>
                ) : null}
                <Td>
                  <div className="flex justify-end gap-1">
                    {row.preview ? (
                      <Button
                        variant="ghost"
                        icon={<Eye size={15} aria-hidden="true" />}
                        loading={files.opening === row.id}
                        onClick={() => void files.show(row)}
                        aria-label={`View ${row.name}`}
                      >
                        View
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      icon={<DownloadSimple size={15} aria-hidden="true" />}
                      onClick={() => void files.download(row.id)}
                      aria-label={`Download ${row.name}`}
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
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'this file'}?`}
        message="The file is removed from storage too. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => void remove()}
        onCancel={() => setDeleting(null)}
      />
      {files.viewer}
    </>
  );
}

/** Upload one file to a project (its Documents tab carries the button). */
export function UploadDialog({
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
  const [category, setCategory] = useState('');
  const categories = useQuery<string[]>(open ? '/documents/categories' : null);
  const chosen = category || (categories.data?.includes('Plan') ? 'Plan' : (categories.data?.[0] ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setFile(null);
    setName('');
    setError(null);
    onClose();
  };

  // Shown in the dialog and as a toast: the dialog's line sits under the form, easy to miss.
  const fail = (text: string) => {
    setError(text);
    toast.error(text);
  };

  const choose = (picked: File | undefined) => {
    setError(null);
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      fail(`${picked.name} is ${fileSize(picked.size)}. The limit is 25 MB.`);
      return;
    }
    setFile(picked);
    setName(picked.name);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      fail('Choose a file to upload.');
      return;
    }
    const form = new FormData();
    form.append('client_id', target.clientId);
    form.append('project_id', target.projectId);
    form.append('category', chosen);
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
      fail(message(caught, `Could not upload ${file.name}.`));
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
            <Button
              type="button"
              icon={<UploadSimple size={15} aria-hidden="true" />}
              onClick={() => fileInput.current?.click()}
            >
              {file ? 'Choose another' : 'Choose file'}
            </Button>
            <p className="min-w-0 truncate text-ink-muted">
              {file
                ? `${file.name} · ${fileSize(file.size)}`
                : 'PDF, image, Word, Excel or PowerPoint, up to 25 MB'}
            </p>
          </div>
        </div>
        <Input
          label="Name"
          value={name}
          maxLength={160}
          onChange={(event) => setName(event.target.value)}
        />
        <Select
          label="Category"
          value={chosen}
          onChange={(event) => setCategory(event.target.value)}
        >
          {(categories.data ?? []).map((option) => (
            <option key={option} value={option}>
              {label(option)}
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
