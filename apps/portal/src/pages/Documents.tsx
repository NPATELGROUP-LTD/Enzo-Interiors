import {
  DownloadSimple,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import { useMemo, useState } from 'react';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { date, fileSize } from '@/lib/format';
import type { DocumentRecord, DocumentType } from '@/types/api';
import { DOCUMENT_LABELS, DOCUMENT_TYPES } from '@/types/api';

export function DocumentsPage() {
  const toast = useToast();
  const documents = useQuery<DocumentRecord[]>('/documents');
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | DocumentType>('all');

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (documents.data ?? []).filter((document) => {
      if (type !== 'all' && document.type !== type) return false;
      if (!term) return true;
      return (
        document.name.toLowerCase().includes(term) ||
        (document.project_name ?? '').toLowerCase().includes(term)
      );
    });
  }, [documents.data, search, type]);

  return (
    <>
      <PageHeader
        title="Documents"
        description="Contracts, plans, mood boards and invoices for your projects."
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <MagnifyingGlass
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search documents"
            aria-label="Search documents"
            className="min-h-11 w-full rounded-control border border-border bg-surface pl-9 pr-3 text-ink placeholder:text-ink-muted/70 focus:border-green-900"
          />
        </div>
        <select
          value={type}
          onChange={(event) => setType(event.target.value as 'all' | DocumentType)}
          aria-label="Filter by document type"
          className="min-h-11 rounded-control border border-border bg-surface px-3 text-ink focus:border-green-900"
        >
          <option value="all">All types</option>
          {DOCUMENT_TYPES.map((option) => (
            <option key={option} value={option}>
              {DOCUMENT_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      {documents.error ? (
        <ErrorState message={documents.error} onRetry={documents.refetch} />
      ) : documents.loading ? (
        <Card className="p-0">
          <TableSkeleton rows={6} columns={4} />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title={documents.data?.length ? 'No matching documents' : 'No documents yet'}
            message={
              documents.data?.length
                ? 'Try a different search term or clear the type filter.'
                : 'Documents shared by the Enzo team will appear here.'
            }
            action={
              documents.data?.length ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch('');
                    setType('all');
                  }}
                >
                  Clear filters
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <Th>Document</Th>
                <Th>Type</Th>
                <Th>Project</Th>
                <Th>Added</Th>
                <Th>Size</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((document) => (
                <tr key={document.id} className="hover:bg-surface-muted/40">
                  <Td className="font-medium text-ink">{document.name}</Td>
                  <Td>
                    <StatusTag tone="info">{DOCUMENT_LABELS[document.type]}</StatusTag>
                  </Td>
                  <Td className="text-ink-muted">{document.project_name ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-ink-muted">{date(document.upload_date)}</Td>
                  <Td className="tabular whitespace-nowrap text-ink-muted">
                    {fileSize(document.size_bytes)}
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button
                        variant="secondary"
                        className="min-h-9 px-2 text-xs"
                        icon={<DownloadSimple size={14} aria-hidden="true" />}
                        onClick={() =>
                          toast.info(
                            'File storage is not part of this prototype, so there is nothing to download yet.',
                          )
                        }
                      >
                        Download
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>

          <p className="mt-3 text-xs text-ink-muted">
            Showing {visible.length} of {documents.data?.length ?? 0} documents.
          </p>
        </>
      )}
    </>
  );
}
