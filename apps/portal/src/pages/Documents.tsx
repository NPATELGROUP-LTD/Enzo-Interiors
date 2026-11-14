import { MagnifyingGlass } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Listbox,
  PageHeader,
  StatusTag,
  TableSkeleton,
  TableWrap,
  Td,
  Th,
} from '@/components/ui';
import { DocumentActions, DocumentName } from '@/components/DownloadButton';
import { useQuery } from '@/hooks/useApi';
import { useSort } from '@/hooks/useSort';
import { date, fileSize } from '@/lib/format';
import type { DocumentRecord } from '@/types/api';
import { categoryLabel } from '@/types/api';

export function DocumentsPage() {
  const documents = useQuery<DocumentRecord[]>('/documents');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  // The categories the files carry (the studio can rename or drop one, but its files keep the label).
  const categories = useMemo(() => [...new Set((documents.data ?? []).map((document) => document.category))].sort(), [documents.data]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (documents.data ?? []).filter((document) => {
      if (type !== 'all' && document.category !== type) return false;
      if (!term) return true;
      return (
        document.name.toLowerCase().includes(term) ||
        (document.project_name ?? '').toLowerCase().includes(term)
      );
    });
  }, [documents.data, search, type]);
  const { rows: sortedVisible, header } = useSort(visible, {
    name: (document) => document.name,
    category: (document) => document.category,
    project: (document) => document.project_name,
    added: (document) => document.upload_date,
    size: (document) => document.size_bytes,
  });

  return (
    <>
      <PageHeader title="" />

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
        <Listbox
          value={type}
          onChange={(event) => setType(event.target.value)}
          aria-label="Filter by category"
          className="w-full sm:w-48"
        >
          <option value="all">All categories</option>
          {categories.map((option) => (
            <option key={option} value={option}>
              {categoryLabel(option)}
            </option>
          ))}
        </Listbox>
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
                ? 'Try a different search term or clear the category filter.'
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
          <ul className="space-y-3 sm:hidden">
            {sortedVisible.map((document) => (
              <li key={document.id}>
                <Card>
                  <p className="font-medium text-ink [overflow-wrap:anywhere]">
                    <DocumentName document={document} />
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {categoryLabel(document.category)} · {date(document.upload_date)} · {fileSize(document.size_bytes)}
                  </p>
                  {document.project_name ? (
                    <p className="text-xs text-ink-muted">{document.project_name}</p>
                  ) : null}
                  <DocumentActions document={document} className="mt-3 flex gap-2 [&>button]:flex-1" />
                </Card>
              </li>
            ))}
          </ul>

          <div className="max-sm:hidden">
          <TableWrap>
            <thead>
              <tr>
                <Th sort={header('name')}>Document</Th>
                <Th col="md" sort={header('category')}>Category</Th>
                <Th col="lg" sort={header('project')}>Project</Th>
                <Th col="lg" sort={header('added')}>Added</Th>
                <Th col="xl" sort={header('size')}>Size</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {sortedVisible.map((document) => (
                <tr key={document.id}>
                  <Td className="font-medium text-ink [overflow-wrap:anywhere]">
                    <DocumentName document={document} />
                  </Td>
                  <Td col="md">
                    <StatusTag tone="info">{categoryLabel(document.category)}</StatusTag>
                  </Td>
                  <Td col="lg" className="text-ink-muted">{document.project_name ?? '—'}</Td>
                  <Td col="lg" className="whitespace-nowrap text-ink-muted">{date(document.upload_date)}</Td>
                  <Td col="xl" className="tabular whitespace-nowrap text-ink-muted">
                    {fileSize(document.size_bytes)}
                  </Td>
                  <Td>
                    <DocumentActions document={document} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          </div>

          <p className="mt-3 text-xs text-ink-muted">
            Showing {visible.length} of {documents.data?.length ?? 0} documents.
          </p>
        </>
      )}
    </>
  );
}
