import { useState, type FormEvent } from 'react';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  PageHeader,
  StatusTag,
  TableSkeleton,
  Textarea,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { date, money } from '@/lib/format';
import { quoteLabel, quoteTone } from '@/lib/status';
import type { Quote } from '@/types/api';
import { SERVICE_LABELS } from '@/types/api';

type Decision = 'accept' | 'decline' | 'revise';

const DECISION_COPY: Record<
  Decision,
  { title: string; description: string; confirm: string; needsNote: boolean }
> = {
  accept: {
    title: 'Accept this quote?',
    description:
      'We will raise an invoice and get your project moving. Nothing is charged automatically — Enzo will arrange payment with you directly.',
    confirm: 'Yes, accept',
    needsNote: false,
  },
  decline: {
    title: 'Decline this quote?',
    description: 'Let us know why if you would like — it helps us put together something better.',
    confirm: 'Decline quote',
    needsNote: false,
  },
  revise: {
    title: 'Request a revision',
    description:
      'Tell us what you would like changed and your designer will rework the figures and send it again.',
    confirm: 'Send request',
    needsNote: true,
  },
};

export function QuotesPage() {
  const toast = useToast();
  const quotes = useQuery<Quote[]>('/quotes');
  const [decision, setDecision] = useState<{ quote: Quote; kind: Decision } | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!decision) return;
    setNoteError(null);

    const copy = DECISION_COPY[decision.kind];
    if (copy.needsNote && note.trim().length < 5) {
      setNoteError('Please tell us what you would like changed.');
      return;
    }

    const endpoint =
      decision.kind === 'accept'
        ? 'accept'
        : decision.kind === 'decline'
          ? 'decline'
          : 'request-revision';

    setPending(true);
    try {
      await api.post(`/quotes/${decision.quote.id}/${endpoint}`, {
        note: note.trim() || undefined,
      });
      toast.success(
        decision.kind === 'accept'
          ? 'Quote accepted — thank you. We will be in touch shortly.'
          : decision.kind === 'decline'
            ? 'Quote declined.'
            : 'Revision requested — your designer will be in touch.',
      );
      setDecision(null);
      setNote('');
      await quotes.refetch();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not record your decision.');
    } finally {
      setPending(false);
    }
  };

  // Draft quotes are still being prepared internally and should not appear.
  const visible = (quotes.data ?? []).filter((quote) => quote.status !== 'Draft');

  return (
    <>
      <PageHeader
        title="My Quotes"
        description="Prices we have put together for you, and your decisions on them."
      />

      {quotes.error ? (
        <ErrorState message={quotes.error} onRetry={quotes.refetch} />
      ) : quotes.loading ? (
        <Card className="p-0">
          <TableSkeleton rows={4} columns={3} />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            title="No quotes yet"
            message="When Enzo sends you a quote it will appear here for you to accept or query."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {visible.map((quote) => {
            const awaiting = quote.status === 'Sent';
            return (
              <Card
                key={quote.id}
                accent={awaiting ? 'warning' : 'none'}
                className={awaiting ? 'pl-5' : undefined}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-ink">
                      {SERVICE_LABELS[quote.service_id]}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {quote.type === 'Detailed' ? 'Itemised quote' : 'Estimate'} · issued{' '}
                      {date(quote.created_at)}
                    </p>
                  </div>
                  <StatusTag tone={quoteTone(quote.status)}>{quoteLabel(quote.status)}</StatusTag>
                </div>

                {quote.lines.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[28rem] border-collapse text-left">
                      <thead>
                        <tr>
                          <th className="label-eyebrow border-b border-border bg-surface-muted px-2.5 py-2">
                            Item
                          </th>
                          <th className="label-eyebrow border-b border-border bg-surface-muted px-2.5 py-2 text-right">
                            Qty
                          </th>
                          <th className="label-eyebrow border-b border-border bg-surface-muted px-2.5 py-2 text-right">
                            Unit
                          </th>
                          <th className="label-eyebrow border-b border-border bg-surface-muted px-2.5 py-2 text-right">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {quote.lines.map((line) => (
                          <tr key={line.id}>
                            <td className="border-b border-border px-2.5 py-2 text-ink">
                              {line.component_name}
                            </td>
                            <td className="tabular border-b border-border px-2.5 py-2 text-right text-ink-muted">
                              {line.quantity}
                            </td>
                            <td className="tabular border-b border-border px-2.5 py-2 text-right text-ink-muted">
                              {money(line.unit_price)}
                            </td>
                            <td className="tabular border-b border-border px-2.5 py-2 text-right font-medium text-ink">
                              {money(line.line_total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                <dl className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
                  {quote.design_fee > 0 ? (
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">3D design &amp; visualisation</dt>
                      <dd className="tabular font-medium text-ink">{money(quote.design_fee)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Subtotal</dt>
                    <dd className="tabular font-medium text-ink">{money(quote.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">VAT at {quote.vat_rate}%</dt>
                    <dd className="tabular font-medium text-ink">
                      {money(Math.round((quote.total - quote.subtotal) * 100) / 100)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5">
                    <dt className="font-semibold text-ink">Total</dt>
                    <dd className="tabular text-lg font-bold text-green-900">
                      {money(quote.total)}
                    </dd>
                  </div>
                </dl>

                {awaiting ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      onClick={() => {
                        setNote('');
                        setNoteError(null);
                        setDecision({ quote, kind: 'accept' });
                      }}
                    >
                      Accept quote
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setNote('');
                        setNoteError(null);
                        setDecision({ quote, kind: 'revise' });
                      }}
                    >
                      Request a revision
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setNote('');
                        setNoteError(null);
                        setDecision({ quote, kind: 'decline' });
                      }}
                    >
                      Decline
                    </Button>
                  </div>
                ) : quote.status === 'Accepted' ? (
                  <p className="mt-4 rounded-control border border-success/30 bg-success-bg px-3 py-2 text-success">
                    You accepted this quote. Enzo will raise an invoice and arrange payment with you
                    directly.
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={decision !== null}
        onClose={() => setDecision(null)}
        title={decision ? DECISION_COPY[decision.kind].title : ''}
        description={decision ? DECISION_COPY[decision.kind].description : undefined}
        width="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecision(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="decision-form"
              variant={decision?.kind === 'decline' ? 'destructive' : 'primary'}
              loading={pending}
            >
              {decision ? DECISION_COPY[decision.kind].confirm : ''}
            </Button>
          </>
        }
      >
        <form id="decision-form" onSubmit={submit} noValidate>
          {decision ? (
            <>
              <p className="mb-3 rounded-control border border-border bg-surface-muted px-3 py-2 text-ink">
                {SERVICE_LABELS[decision.quote.service_id]} ·{' '}
                <span className="tabular font-semibold">{money(decision.quote.total)}</span>{' '}
                including VAT
              </p>
              <Textarea
                label={
                  DECISION_COPY[decision.kind].needsNote
                    ? 'What would you like changed?'
                    : 'Anything to add? (optional)'
                }
                value={note}
                onChange={(event) => setNote(event.target.value)}
                error={noteError ?? undefined}
                required={DECISION_COPY[decision.kind].needsNote}
              />
            </>
          ) : null}
        </form>
      </Modal>
    </>
  );
}
