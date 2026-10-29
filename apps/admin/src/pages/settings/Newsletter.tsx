import { DownloadSimple, Image as ImageIcon, PaperPlaneTilt, Plus, Trash } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';

import { MediaPicker } from '@/components/cms/MediaPicker';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FIELD_BASE,
  Input,
  Listbox,
  LoadingState,
  StatusTag,
  TableWrap,
  Tabs,
  Td,
  Th,
  type StatusTone,
} from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { useSort } from '@/hooks/useSort';
import { ApiError, api } from '@/lib/api';
import type { MediaAsset } from '@/types/cms';

/* The shapes apps/api/src/modules/newsletter serves. */
type SubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed';
interface Subscriber {
  id: string;
  email: string;
  status: SubscriberStatus;
  source: string | null;
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
}
interface Campaign {
  id: string;
  subject: string;
  html: string;
  status: 'draft' | 'sending' | 'sent';
  recipients: number;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
}

const DAY = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
const STAMP = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const HELP = 'mt-1 text-sm leading-relaxed text-ink-muted';
const SOURCE: Record<string, string> = { coming_soon: 'Coming-soon page', footer: 'Website footer' };
const SUBSCRIBER_TONE: Record<SubscriberStatus, [StatusTone, string]> = {
  confirmed: ['success', 'Confirmed'],
  pending: ['warning', 'Not confirmed yet'],
  unsubscribed: ['neutral', 'Unsubscribed'],
};
const CAMPAIGN_TONE: Record<Campaign['status'], [StatusTone, string]> = {
  draft: ['neutral', 'Draft'],
  sending: ['info', 'Sending'],
  sent: ['success', 'Sent'],
};

/**
 * Settings › Newsletter: who has signed up (double opt-in, so only confirmed
 * addresses are ever sent to), and the newsletters themselves, written in
 * HTML with a live preview.
 */
export function Newsletter() {
  const [tab, setTab] = useState<'subscribers' | 'campaigns'>('subscribers');
  return (
    <div className="max-w-5xl">
      <header>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Newsletter</h2>
        <p className={clsx(HELP, 'max-w-[62ch]')}>
          People sign up on the coming-soon page and in the website footer, then confirm by email. Newsletters go to
          confirmed subscribers only, each with its own unsubscribe link.
        </p>
      </header>
      <div className="mt-6">
        <Tabs
          tabs={[
            { id: 'subscribers', label: 'Subscribers' },
            { id: 'campaigns', label: 'Newsletters' },
          ]}
          active={tab}
          onChange={(id) => setTab(id as typeof tab)}
        />
      </div>
      {tab === 'subscribers' ? <Subscribers /> : <Campaigns />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Subscribers                                                                */
/* -------------------------------------------------------------------------- */

function Subscribers() {
  const toast = useToast();
  const list = useQuery<Subscriber[]>('/newsletter/subscribers');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<SubscriberStatus | 'all'>('all');
  const [removing, setRemoving] = useState<Subscriber | null>(null);
  const [exporting, setExporting] = useState(false);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (list.data ?? []).filter(
      (row) => (status === 'all' || row.status === status) && (!needle || row.email.includes(needle)),
    );
  }, [list.data, search, status]);
  const { rows: sortedRows, header } = useSort(rows, {
    email: (row) => row.email,
    status: (row) => row.status,
    signedUp: (row) => row.created_at,
    where: (row) => row.source,
  });

  if (list.error) return <ErrorState message={list.error} onRetry={list.refetch} />;
  if (!list.data) return <LoadingState label="Loading subscribers…" />;

  const count = (s: SubscriberStatus) => list.data!.filter((row) => row.status === s).length;

  const download = async () => {
    setExporting(true);
    try {
      const csv = await api.get<string>('/newsletter/subscribers.csv');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not export the list.');
    } finally {
      setExporting(false);
    }
  };

  const remove = async () => {
    const row = removing;
    setRemoving(null);
    if (!row) return;
    try {
      await api.delete(`/newsletter/subscribers/${row.id}`);
      list.setData((current) => (current ?? []).filter((item) => item.id !== row.id));
      toast.success(`${row.email} was removed.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not remove them.');
    }
  };

  if (list.data.length === 0) {
    return (
      <EmptyState
        title="No subscribers yet"
        message="Sign-ups from the coming-soon page and the website footer appear here once they arrive."
      />
    );
  }

  return (
    <section aria-label="Subscribers">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-ink-muted">
          <span className="tabular font-semibold text-ink">{count('confirmed')}</span> confirmed ·{' '}
          <span className="tabular">{count('pending')}</span> not confirmed yet ·{' '}
          <span className="tabular">{count('unsubscribed')}</span> unsubscribed
        </p>
        <Button icon={<DownloadSimple size={16} />} onClick={() => void download()} loading={exporting}>
          Export CSV
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Search by email</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email"
            className={FIELD_BASE}
          />
        </label>
        <label>
          <span className="sr-only">Show</span>
          <Listbox
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className={"w-auto"}
          >
            <option value="all">Everyone</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Not confirmed yet</option>
            <option value="unsubscribed">Unsubscribed</option>
          </Listbox>
        </label>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nobody matches that" message="Try another address, or show everyone." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th sort={header('email')}>Email</Th>
              <Th sort={header('status')}>Status</Th>
              <Th sort={header('signedUp')}>Signed up</Th>
              <Th sort={header('where')}>Where</Th>
              <Th>
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const [tone, label] = SUBSCRIBER_TONE[row.status];
              return (
                <tr key={row.id}>
                  <Td className="font-medium text-ink">{row.email}</Td>
                  <Td>
                    <StatusTag tone={tone}>{label}</StatusTag>
                  </Td>
                  <Td className="tabular text-ink-muted">{DAY.format(new Date(row.created_at))}</Td>
                  <Td className="text-ink-muted">{row.source ? (SOURCE[row.source] ?? row.source) : '—'}</Td>
                  <Td className="text-right">
                    <Button
                      variant="ghost"
                      icon={<Trash size={15} />}
                      aria-label={`Remove ${row.email}`}
                      onClick={() => setRemoving(row)}
                    >
                      Remove
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.email ?? ''}?`}
        message="Their address is deleted from the list for good. If they only want to stop the emails, the unsubscribe link in every newsletter does that."
        confirmLabel="Remove"
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                  */
/* -------------------------------------------------------------------------- */

function Campaigns() {
  const list = useQuery<Campaign[]>('/newsletter/campaigns');
  const [open, setOpen] = useState<string | 'new' | null>(null);

  // A newsletter going out updates its counts every few seconds.
  const sending = list.data?.some((row) => row.status === 'sending');
  const { refetch } = list;
  useEffect(() => {
    if (!sending) return undefined;
    const timer = window.setInterval(() => void refetch(), 3000);
    return () => window.clearInterval(timer);
  }, [sending, refetch]);

  if (list.error) return <ErrorState message={list.error} onRetry={list.refetch} />;
  if (!list.data) return <LoadingState label="Loading newsletters…" />;

  if (open) {
    const campaign = open === 'new' ? null : (list.data.find((row) => row.id === open) ?? null);
    return (
      <CampaignEditor
        key={open}
        campaign={campaign}
        onBack={() => setOpen(null)}
        onSaved={(row) => {
          list.setData((current) => [row, ...(current ?? []).filter((item) => item.id !== row.id)]);
          setOpen(row.id);
        }}
        onDeleted={(id) => {
          list.setData((current) => (current ?? []).filter((item) => item.id !== id));
          setOpen(null);
        }}
      />
    );
  }

  return (
    <section aria-label="Newsletters">
      <div className="mb-4 flex justify-end">
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setOpen('new')}>
          New newsletter
        </Button>
      </div>
      {list.data.length === 0 ? (
        <EmptyState
          title="No newsletters yet"
          message="Write the first one in HTML, send yourself a test, then send it to everyone who has confirmed."
          action={
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setOpen('new')}>
              New newsletter
            </Button>
          }
        />
      ) : (
        <ul className="rounded-card bg-surface p-1.5 shadow-soft">
          {list.data.map((row) => {
            const [tone, label] = CAMPAIGN_TONE[row.status];
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setOpen(row.id)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-[10px] px-3 py-3 text-left transition-colors hover:bg-ink/[0.03] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{row.subject}</span>
                    <span className="block text-[13px] text-ink-muted">
                      {row.status === 'draft'
                        ? `Edited ${STAMP.format(new Date(row.updated_at))}`
                        : `${row.sent_count} of ${row.recipients} sent${row.failed_count ? `, ${row.failed_count} failed` : ''}${row.sent_at ? ` · ${STAMP.format(new Date(row.sent_at))}` : ''}`}
                    </span>
                  </span>
                  <StatusTag tone={tone}>{label}</StatusTag>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Ready-made blocks, styled inline the way email needs, dropped in at the cursor. */
const SNIPPETS: Array<[string, string]> = [
  ['Heading', '<h2 style="margin:0 0 12px;font:600 24px/1.3 Georgia,serif;color:#102E2D">A heading</h2>\n'],
  ['Paragraph', '<p style="margin:0 0 16px">Some words.</p>\n'],
  [
    'Button',
    '<p style="margin:24px 0"><a href="https://" style="display:inline-block;background:#102E2D;color:#F2F0EB;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">Book a consultation</a></p>\n',
  ],
  [
    'Two columns',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>\n  <td width="50%" valign="top" style="padding-right:8px">Left</td>\n  <td width="50%" valign="top" style="padding-left:8px">Right</td>\n</tr></table>\n',
  ],
  ['Divider', '<hr style="border:0;border-top:1px solid #ECE9E2;margin:24px 0">\n'],
];

const escapeAttr = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** The preview: the same shell the API wraps each newsletter in (mail.service.ts layout). */
function previewDocument(subject: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeAttr(subject)}</title></head>
<body style="margin:0;background:#F2F0EB;font:16px/1.6 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2C2C2C">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden">
<div style="background:#102E2D;padding:24px 28px;font:600 20px Georgia,serif;color:#F2F0EB">Enzo Interiors</div>
<div style="padding:28px">${body}</div>
<div style="padding:16px 28px;border-top:1px solid #ECE9E2;font-size:12px;color:#8A9E8C">Enzo Interiors · Bespoke fitted furniture, Leicester<br>Unsubscribe</div>
</div></body></html>`;
}

function CampaignEditor({
  campaign,
  onBack,
  onSaved,
  onDeleted,
}: {
  campaign: Campaign | null;
  onBack: () => void;
  onSaved: (row: Campaign) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const [subject, setSubject] = useState(campaign?.subject ?? '');
  const [html, setHtml] = useState(campaign?.html ?? SNIPPETS.slice(0, 3).map(([, code]) => code).join(''));
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [picking, setPicking] = useState(false);
  const subscribers = useQuery<Subscriber[]>(campaign?.status === 'draft' ? '/newsletter/subscribers' : null);
  const assets = useQuery<MediaAsset[]>(picking ? '/cms/media' : null);
  const code = useRef<HTMLTextAreaElement>(null);
  /** Where the cursor was when the box last lost focus; null = never used, so add at the end. */
  const caret = useRef<[number, number] | null>(null);

  const readOnly = !!campaign && campaign.status !== 'draft';
  const dirty = !campaign || subject !== campaign.subject || html !== campaign.html;
  const confirmed = (subscribers.data ?? []).filter((row) => row.status === 'confirmed').length;

  const insert = (snippet: string) => {
    const box = code.current;
    const [at, end] = caret.current ?? [html.length, html.length];
    setHtml(html.slice(0, at) + snippet + html.slice(end));
    caret.current = [at + snippet.length, at + snippet.length];
    requestAnimationFrame(() => {
      box?.focus();
      box?.setSelectionRange(at + snippet.length, at + snippet.length);
    });
  };

  /** Saves if anything changed; the server's cleaned HTML replaces what is on screen. */
  const save = async (): Promise<Campaign | null> => {
    if (!subject.trim()) {
      toast.error('Give the newsletter a subject first.');
      return null;
    }
    if (campaign && !dirty) return campaign;
    setSaving(true);
    try {
      const body = { subject, html };
      const row = campaign
        ? await api.put<Campaign>(`/newsletter/campaigns/${campaign.id}`, body)
        : await api.post<Campaign>('/newsletter/campaigns', body);
      setHtml(row.html);
      onSaved(row);
      return row;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save the newsletter.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    const row = await save();
    if (!row) return;
    setTesting(true);
    try {
      const { to } = await api.post<{ to: string }>(`/newsletter/campaigns/${row.id}/test`);
      toast.success(`Test sent to ${to}.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not send the test.');
    } finally {
      setTesting(false);
    }
  };

  const send = async () => {
    setConfirmSend(false);
    const row = await save();
    if (!row) return;
    try {
      onSaved(await api.post<Campaign>(`/newsletter/campaigns/${row.id}/send`));
      toast.success('Sending now. It carries on even if you close the admin.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not start sending.');
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    if (!campaign) return onBack();
    try {
      await api.delete(`/newsletter/campaigns/${campaign.id}`);
      onDeleted(campaign.id);
      toast.success('Draft deleted.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not delete it.');
    }
  };

  return (
    <section aria-label={campaign ? campaign.subject : 'New newsletter'}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          ‹ All newsletters
        </Button>
        {readOnly ? (
          <StatusTag tone={CAMPAIGN_TONE[campaign.status][0]}>
            {campaign.status === 'sending'
              ? `Sending: ${campaign.sent_count} of ${campaign.recipients}`
              : `Sent to ${campaign.sent_count} of ${campaign.recipients}${campaign.failed_count ? `, ${campaign.failed_count} failed` : ''}`}
          </StatusTag>
        ) : (
          <div className="flex flex-wrap gap-2">
            {campaign ? (
              <Button variant="ghost" icon={<Trash size={15} />} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ) : null}
            <Button onClick={() => void save()} loading={saving} disabled={!dirty}>
              Save draft
            </Button>
            <Button onClick={() => void test()} loading={testing}>
              Send me a test
            </Button>
            <Button
              variant="primary"
              icon={<PaperPlaneTilt size={15} />}
              disabled={!campaign || !confirmed}
              title={!campaign ? 'Save it first.' : !confirmed ? 'Nobody has confirmed their subscription yet.' : undefined}
              onClick={() => setConfirmSend(true)}
            >
              Send to {confirmed} {confirmed === 1 ? 'subscriber' : 'subscribers'}
            </Button>
          </div>
        )}
      </div>

      <Input
        label="Subject"
        value={subject}
        maxLength={200}
        readOnly={readOnly}
        onChange={(event) => setSubject(event.target.value)}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="newsletter-html" className="text-sm font-semibold text-ink">
              Body (HTML)
            </label>
            {readOnly ? null : (
              <div className="flex flex-wrap gap-1">
                {SNIPPETS.map(([name, snippet]) => (
                  <Button key={name} variant="ghost" className="min-h-8 px-2 text-[12px]" onClick={() => insert(snippet)}>
                    {name}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  icon={<ImageIcon size={14} />}
                  className="min-h-8 px-2 text-[12px]"
                  onClick={() => setPicking(true)}
                >
                  Image
                </Button>
              </div>
            )}
          </div>
          <textarea
            id="newsletter-html"
            ref={code}
            value={html}
            readOnly={readOnly}
            spellCheck={false}
            onChange={(event) => setHtml(event.target.value)}
            onBlur={(event) => {
              caret.current = [event.target.selectionStart, event.target.selectionEnd];
            }}
            // A fixed height, not min-h: FIELD_BASE's pointer-fine:min-h-9 would win over it.
            className={clsx(FIELD_BASE, 'h-[28rem] resize-y py-2 font-mono text-[12.5px] leading-relaxed')}
          />
          <p className="text-xs text-ink-muted">
            Style with inline <code>style=&quot;…&quot;</code>, as email needs. Scripts, forms and non-web links are
            removed when you save. The logo, address and unsubscribe link are added around it.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-semibold text-ink">Preview</span>
          {/* sandbox with no permissions: nothing in the preview can run. */}
          <iframe
            title="Newsletter preview"
            sandbox=""
            srcDoc={previewDocument(subject, html)}
            className="min-h-[28rem] w-full flex-1 rounded-card bg-surface shadow-soft"
          />
        </div>
      </div>

      <MediaPicker
        open={picking}
        onClose={() => setPicking(false)}
        value={[]}
        multiple={false}
        title="Choose an image"
        onUploaded={() => void assets.refetch()}
        onChange={(ids) => {
          setPicking(false);
          const asset = (assets.data ?? []).find((row) => row.id === ids[ids.length - 1]);
          if (asset) {
            insert(
              `<img src="${escapeAttr(asset.src_resolved)}" alt="${escapeAttr(asset.alt)}" width="496" style="display:block;width:100%;height:auto;border-radius:8px;margin:0 0 16px">\n`,
            );
          }
        }}
      />
      <ConfirmDialog
        open={confirmSend}
        title={`Send to ${confirmed} ${confirmed === 1 ? 'subscriber' : 'subscribers'}?`}
        message="It goes out straight away and cannot be taken back. Send yourself a test first if you have not."
        confirmLabel="Send now"
        onConfirm={() => void send()}
        onCancel={() => setConfirmSend(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete this draft?"
        message="It has not been sent to anyone. This cannot be undone."
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}
