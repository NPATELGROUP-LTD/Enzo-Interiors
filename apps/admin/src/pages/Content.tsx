import { useMemo, useState } from 'react';

import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  StatusTag,
  TableSkeleton,
  Tabs,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { submissionTone } from '@/lib/status';
import type { ContactSubmission, SubmissionStatus } from '@/types/api';
import { SUBMISSION_STATUSES } from '@/types/api';

/**
 * Enquiries from the public site's contact form.
 *
 * This screen used to also edit testimonials and portfolio entries, against
 * `/testimonials` and `/portfolio-items`. Those tabs are gone, and their
 * removal is the point rather than a side effect: the public site reads
 * `GET /content/site`, the CMS's published bundle, so edits made here landed
 * in tables nothing on the site reads. It looked like it worked and never
 * reached a visitor. Both now live in Website → Testimonials / Portfolio,
 * where saving and publishing are distinct acts and the second one is what
 * changes the site.
 *
 * The API endpoints are left in place; they are what the public contact form
 * posts to, and the legacy tables are still what the CRM reports read.
 */
export function ContentPage() {
  const toast = useToast();
  const submissions = useQuery<ContactSubmission[]>('/contact-submissions');

  /** 'all', or one of SUBMISSION_STATUSES. */
  const [filter, setFilter] = useState('New');

  const counts = useMemo(() => {
    const rows = submissions.data ?? [];
    return {
      all: rows.length,
      ...Object.fromEntries(
        SUBMISSION_STATUSES.map((status) => [
          status,
          rows.filter((row) => row.status === status).length,
        ]),
      ),
    } as Record<string, number>;
  }, [submissions.data]);

  const visible = useMemo(() => {
    const rows = submissions.data ?? [];
    return (filter === 'all' ? rows : rows.filter((row) => row.status === filter))
      // Newest first. An enquiry list is read top-down and the oldest one is
      // the least likely to still need answering.
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [submissions.data, filter]);

  const setStatus = async (entry: ContactSubmission, status: SubmissionStatus) => {
    try {
      await api.put(`/contact-submissions/${entry.id}`, { status });
      toast.success(`Enquiry marked ${status.toLowerCase()}.`);
      await submissions.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not update this enquiry.');
    }
  };

  return (
    <>
      <PageHeader
        title="Enquiries"
        description="Messages sent through the contact form on the website. Testimonials and portfolio projects are edited in Website."
      />

      <Tabs
        active={filter}
        onChange={setFilter}
        tabs={[
          // Only offer a status that has something in it, apart from New,
          // which stays visible so an empty inbox reads as "nothing new"
          // rather than as a missing tab.
          { id: 'New', label: 'New', count: counts.New ?? 0 },
          ...SUBMISSION_STATUSES.filter(
            (status) => status !== 'New' && (counts[status] ?? 0) > 0,
          ).map((status) => ({ id: status, label: status, count: counts[status] })),
          { id: 'all', label: 'All', count: counts.all },
        ]}
      />

      {submissions.error ? (
        <ErrorState message={submissions.error} onRetry={submissions.refetch} />
      ) : submissions.loading ? (
        <Card className="p-0">
          <TableSkeleton rows={4} columns={4} />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title={filter === 'New' ? 'Nothing new' : 'Nothing here'}
            message={
              filter === 'all'
                ? 'Contact form submissions from the website will appear here.'
                : 'Every enquiry with this status has been dealt with.'
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((entry) => (
            <Card
              key={entry.id}
              accent={entry.status === 'New' ? 'warning' : 'none'}
              className={entry.status === 'New' ? 'pl-5' : undefined}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{entry.name}</p>
                  <p className="text-xs text-ink-muted">
                    {entry.email}
                    {entry.phone ? ` · ${entry.phone}` : ''}
                    {entry.service_interest ? ` · interested in ${entry.service_interest}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusTag tone={submissionTone(entry.status)}>{entry.status}</StatusTag>
                  <span className="text-xs text-ink-muted">{dateTime(entry.created_at)}</span>
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap leading-relaxed text-ink">{entry.message}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label htmlFor={`status-${entry.id}`} className="label-eyebrow">
                  Set status
                </label>
                <select
                  id={`status-${entry.id}`}
                  value={entry.status}
                  onChange={(event) => void setStatus(entry, event.target.value as SubmissionStatus)}
                  className="min-h-11 rounded-control border border-border bg-surface px-2 text-ink focus:border-green-900"
                >
                  {SUBMISSION_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <a href={`mailto:${entry.email}`} className="text-link">
                  Reply by email
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
