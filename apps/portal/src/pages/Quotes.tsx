import { CheckCircle, XCircle } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { InvoicePreview, quoteSheet } from '@/components/invoice/InvoiceSheet';
import { Button, Card, EmptyState, ErrorState, LoadingState, Modal, PageHeader, StatusTag, Textarea, type StatusTone } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { date, money } from '@/lib/format';
import type { Quote, QuoteStatus } from '@/types/api';

const TONE: Record<QuoteStatus, StatusTone> = { Draft: 'neutral', Sent: 'info', Accepted: 'success', Declined: 'danger' };
/** Sent is "Waiting for you" to the client, and "Expired" once its last day has gone. */
const label = (quote: Quote) => (quote.expired ? 'Expired' : quote.status === 'Sent' ? 'Waiting for you' : quote.status);

/** Quotes the studio has sent: read them, then accept or decline. Nothing here takes payment. */
export function QuotesPage() {
  const { id } = useParams();
  return id ? <QuoteDetail id={id} /> : <QuoteList />;
}

function QuoteList() {
  const quotes = useQuery<Quote[]>('/quotes');
  return (
    <>
      <PageHeader title="" />
      {quotes.error ? (
        <ErrorState message={quotes.error} onRetry={quotes.refetch} />
      ) : quotes.loading ? (
        <LoadingState label="Loading quotes…" />
      ) : (quotes.data ?? []).length === 0 ? (
        <Card className="p-0">
          <EmptyState title="No quotes yet" message="A quote the studio sends you for a project will appear here." />
        </Card>
      ) : (
        <ul className="space-y-3">
          {(quotes.data ?? []).map((quote) => (
            <li key={quote.id}>
              <Link to={`/quotes/${quote.id}`} className="block">
                <Card className="flex flex-wrap items-center justify-between gap-3 transition-colors hover:bg-surface-muted/60">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      {quote.number}
                      {quote.title ? <span className="font-normal text-ink-muted"> · {quote.title}</span> : null}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {quote.project_name ?? 'Project'}
                      {quote.valid_until ? ` · valid until ${date(quote.valid_until)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusTag tone={quote.expired ? 'warning' : TONE[quote.status]}>{label(quote)}</StatusTag>
                    <span className="tabular font-semibold text-ink">{money(quote.amount)}</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function QuoteDetail({ id }: { id: string }) {
  const toast = useToast();
  const quote = useQuery<Quote>(`/quotes/${encodeURIComponent(id)}`);
  const [asking, setAsking] = useState<'accept' | 'decline' | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  if (quote.error && !quote.data) return <ErrorState message={quote.error} onRetry={quote.refetch} />;
  const q = quote.data;
  if (!q) return <LoadingState label="Opening quote…" />;
  const open = q.status === 'Sent' && !q.expired;

  const answer = async () => {
    if (!asking) return;
    setSending(true);
    try {
      await api.post(`/quotes/${encodeURIComponent(id)}/respond`, { decision: asking, comment: comment.trim() || null });
      toast.success(asking === 'accept' ? 'Thank you. The studio has been told.' : 'Declined. The studio has been told.');
      setAsking(null);
      setComment('');
      quote.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'That did not work. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader
        title={`${q.number}${q.title ? ` · ${q.title}` : ''}`}
        description={q.project_name ?? undefined}
        actions={<StatusTag tone={q.expired ? 'warning' : TONE[q.status]}>{label(q)}</StatusTag>}
      />
      <Card className="flex flex-col gap-4">
        {/* The letterhead sheet, installation charges and totals only: the API sends no lines, costs or margins. */}
        <InvoicePreview invoice={quoteSheet(q)} kind="quote" />
        {q.response_comment ? <p className="rounded-control bg-surface-muted px-3 py-2 text-sm text-ink">Your note: “{q.response_comment}”</p> : null}
        {q.expired ? <p className="text-sm text-warning">This quote has expired. Ask the studio for a new one.</p> : null}
        {open ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" icon={<XCircle size={16} aria-hidden="true" />} onClick={() => setAsking('decline')}>
              Decline
            </Button>
            <Button variant="primary" icon={<CheckCircle size={16} aria-hidden="true" />} onClick={() => setAsking('accept')}>
              Accept quote
            </Button>
          </div>
        ) : null}
      </Card>

      <Modal
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={asking === 'accept' ? `Accept ${q.number}?` : `Decline ${q.number}?`}
        description={asking === 'accept' ? `You are accepting ${money(q.amount)}. The studio will be in touch about the next step.` : 'Tell the studio why, if you like, so they can send a better one.'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAsking(null)} disabled={sending}>
              Cancel
            </Button>
            <Button variant="primary" loading={sending} onClick={() => void answer()}>
              {asking === 'accept' ? 'Accept' : 'Decline'}
            </Button>
          </>
        }
      >
        <Textarea label="A note for the studio (optional)" rows={3} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} />
      </Modal>
    </>
  );
}
