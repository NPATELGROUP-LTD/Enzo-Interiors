import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { date, money } from '@/lib/format';
import type { Invoice, InvoiceIssuer, InvoiceItem, Quote } from '@/types/api';

import './invoice-sheet.css';

/*
 * The invoice as the client gets it: one A4 sheet, the same layout as the
 * business's paper invoice (letterhead, green band, who and what, job notes,
 * itemised list in sections, totals, payment schedule). Copied as is in
 * apps/admin and apps/portal; keep the two in step. A quote is the same sheet
 * (`kind="quote"`, from `quoteSheet`): same letterhead, no bank details or stages.
 */

export type SheetKind = 'invoice' | 'quote';

/** A quote as the sheet's record. A client's quote shows its lines and prices, never cost or margin. */
export function quoteSheet(quote: Quote): Invoice {
  return {
    id: quote.id,
    number: quote.number,
    client_id: quote.client_id,
    project_id: quote.project_id,
    amount: quote.amount,
    vat_rate: quote.vat_rate,
    status: quote.status as unknown as Invoice['status'],
    due_date: quote.valid_until ?? '',
    paid_at: null,
    created_at: quote.created_at,
    items: quote.items.map(({ id, description, section, detail, quantity, unit_price, position }) => ({ id, description, section, detail, quantity, unit_price, position })),
    client_name: quote.client_name,
    project_name: quote.project_name,
    subtotal_amount: quote.subtotal_amount,
    discount: quote.discount,
    net_amount: quote.net_amount,
    vat_amount: quote.vat_amount,
    is_overdue: false,
    days_overdue: 0,
    job_name: quote.title,
    job_address: quote.job_address,
    job_notes: quote.notes,
    payment_schedule: [],
    client_email: quote.client_email,
    client_phone: quote.client_phone,
    issuer: quote.issuer,
    stages: [],
    bank_details: null,
  };
}

/** Used until an invoice from the API brings the CMS company details. */
export const DEFAULT_ISSUER: InvoiceIssuer = {
  name: 'Enzo Interiors LTD.',
  address: ['51 Forest Road, Leicester,', 'LE5 0DW, United Kingdom'],
  phone: '077 77 333 052',
  email: 'info@enzointeriors.co.uk',
};

/** 210mm at 96dpi. */
const SHEET_PX = 793.7;

const qty = (value: number) => String(Number(value));
/** Display only: the API's figures (subtotal, VAT, amount) are the ones that count. */
const lineTotal = (item: Pick<InvoiceItem, 'quantity' | 'unit_price'>) => Math.round(item.quantity * item.unit_price * 100) / 100;

/** `editBody`: the item rows (`<tr>`s) in place of the invoice's own, so staff can edit the lines on the sheet itself. Unused in the portal. */
export function InvoiceSheet({ invoice, editBody, kind = 'invoice' }: { invoice: Invoice; editBody?: ReactNode; kind?: SheetKind }) {
  const quote = kind === 'quote';
  const stamp = (quote ? ['Draft', 'Accepted', 'Declined'] : ['Draft', 'Paid']).includes(invoice.status) ? invoice.status : null;
  const issuer = invoice.issuer ?? DEFAULT_ISSUER;
  const items = invoice.items ?? [];
  const schedule = invoice.payment_schedule ?? [];
  const stages = invoice.stages ?? [];
  const bank = invoice.bank_details;
  const discount = invoice.discount ?? 0;
  const subtotal = invoice.subtotal_amount ?? invoice.net_amount;

  return (
    <article className="inv-sheet" aria-label={`${quote ? 'Quote' : 'Invoice'} ${invoice.number}`}>
      <header className="inv-head">
        <img className="inv-logo" src="/invoice-logo.png" alt="Enzo Interiors" />
        <address className="inv-issuer">
          <strong>{issuer.name}</strong>
          {issuer.address.map((line) => (
            <Fragment key={line}>
              {line}
              <br />
            </Fragment>
          ))}
          {issuer.phone}
          <br />
          {issuer.email}
        </address>
      </header>

      <div className="inv-band">
        <h1 className="inv-serif">
          {quote ? 'Quote' : 'Invoice'}
          {stamp ? <span className="inv-stamp">{stamp}</span> : null}
        </h1>
        <dl>
          <div>
            <dt>Number</dt>
            <dd>{invoice.number}</dd>
          </div>
          <div>
            <dt>Issued</dt>
            <dd>{date(invoice.created_at)}</dd>
          </div>
          {quote && !invoice.due_date ? null : (
            <div>
              <dt>{quote ? 'Valid until' : invoice.paid_at ? 'Paid' : 'Due'}</dt>
              <dd>{date(invoice.paid_at ?? invoice.due_date)}</dd>
            </div>
          )}
        </dl>
      </div>

      <section className="inv-parties">
        <div>
          <dl className="inv-pairs">
            <dt>Customer</dt>
            <dd className="inv-strong">{invoice.client_name}</dd>
            <dt>Phone</dt>
            <dd>{invoice.client_phone || 'N/A'}</dd>
            <dt>Email</dt>
            <dd>{invoice.client_email || 'N/A'}</dd>
          </dl>
        </div>
        <div>
          <dl className="inv-pairs">
            <dt>Job name</dt>
            <dd className="inv-strong">{invoice.job_name || invoice.project_name || '—'}</dd>
            <dt>Address</dt>
            <dd>{invoice.job_address || '—'}</dd>
          </dl>
        </div>
      </section>

      {invoice.job_notes ? (
        <section className="inv-notes">
          <p className="inv-kicker">{quote ? 'Notes' : 'Job notes'}</p>
          <p>{invoice.job_notes}</p>
        </section>
      ) : null}

      <h2 className="inv-h2 inv-serif">Itemised list</h2>
      <table className="inv-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Description</th>
            <th scope="col" className="inv-right inv-col-qty">
              Qty
            </th>
            <th scope="col" className={editBody && quote ? 'inv-right inv-col-wide' : 'inv-right inv-col-total'}>
              Total
            </th>
          </tr>
        </thead>
        <tbody className={editBody ? 'inv-edit' : undefined}>
          {editBody ? (
            editBody
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={3}>{quote ? 'Installation charges' : (invoice.project_name ?? 'Work as agreed')}</td>
              <td className="inv-right inv-num">{money(subtotal)}</td>
            </tr>
          ) : (
            items.map((item, index) => (
              <Fragment key={item.id}>
                {item.section && item.section !== items[index - 1]?.section ? (
                  <tr className="inv-section">
                    <th colSpan={4} scope="rowgroup">
                      {item.section}
                    </th>
                  </tr>
                ) : null}
                <tr>
                  <td>{item.description}</td>
                  <td className="inv-detail">{item.detail}</td>
                  <td className="inv-right inv-num">{qty(item.quantity)}</td>
                  <td className="inv-right inv-num">{item.unit_price > 0 ? money(lineTotal(item)) : ''}</td>
                </tr>
              </Fragment>
            ))
          )}
        </tbody>
      </table>

      <table className="inv-totals">
        <tbody>
          <tr>
            <th scope="row">Total project value</th>
            <td className="inv-num">{money(subtotal)}</td>
          </tr>
          {discount > 0 ? (
            <tr className="inv-discount">
              <th scope="row">Discount</th>
              <td className="inv-num">−{money(discount)}</td>
            </tr>
          ) : null}
          {invoice.vat_rate > 0 ? (
            <tr>
              <th scope="row">VAT at {invoice.vat_rate}%</th>
              <td className="inv-num">{money(invoice.vat_amount)}</td>
            </tr>
          ) : null}
          <tr className="inv-payable">
            <th scope="row">{discount > 0 && invoice.vat_rate <= 0 ? 'After discount' : quote ? 'Total' : 'Total payable'}</th>
            <td className="inv-num">{money(invoice.amount)}</td>
          </tr>
        </tbody>
      </table>

      {schedule.length > 0 ? (
        <section className="inv-schedule">
          <h3 className="inv-serif">Payment schedule</h3>
          <table className="inv-table">
            <tbody>
              {schedule.map((row, index) => (
                <tr key={index}>
                  <td>{row.label}</td>
                  <td className="inv-detail inv-num">{row.date ? date(row.date) : ''}</td>
                  <td className="inv-right inv-num inv-col-total">{money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {stages.length > 0 ? (
        <section className="inv-stages">
          <h3 className="inv-serif">Payment stages</h3>
          <table className="inv-table">
            <tbody>
              {stages.map((stage) => (
                <tr key={stage.id}>
                  <td>
                    {stage.label}
                    {stage.mode === 'percent' ? <span className="inv-detail"> · {Number(stage.value)}%</span> : null}
                    {stage.due_note ? <span className="inv-detail"> · {stage.due_note}</span> : null}
                  </td>
                  <td className="inv-stage-state inv-num">
                    {stage.paid_at ? (
                      <>
                        <svg className="inv-tick" viewBox="0 0 12 12" aria-hidden="true">
                          <path d="M2 6.5 5 9.5 10 3" />
                        </svg>
                        Paid {date(stage.paid_at)}
                      </>
                    ) : (
                      'Due'
                    )}
                  </td>
                  <td className="inv-right inv-num inv-col-total">{money(stage.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoice.status !== 'Paid' && (invoice.paid_amount ?? 0) > 0 ? (
            <p className="inv-balance">
              Paid so far {money(invoice.paid_amount ?? 0)} · Balance due <strong>{money(invoice.balance_amount ?? 0)}</strong>
            </p>
          ) : null}
        </section>
      ) : null}

      {bank ? (
        <section className="inv-bank">
          <h3 className="inv-serif">Pay by bank transfer</h3>
          <dl className="inv-pairs">
            <dt>Account name</dt>
            <dd className="inv-strong">{bank.account_name}</dd>
            <dt>Bank</dt>
            <dd>{bank.bank_name}</dd>
            <dt>Sort code</dt>
            <dd className="inv-num">{bank.sort_code}</dd>
            <dt>Account number</dt>
            <dd className="inv-num">{bank.account_number}</dd>
            <dt>Reference</dt>
            <dd>{invoice.number}</dd>
          </dl>
          {bank.reference_note ? <p className="inv-bank-note">{bank.reference_note}</p> : null}
        </section>
      ) : null}

      <footer className="inv-foot">
        <span>{quote ? `Please quote ${invoice.number} when you reply.` : `Please quote ${invoice.number} with your payment.`}</span>
        <span>Thank you for choosing {issuer.name.replace(/\s*(LTD|Ltd|Limited)\.?$/, '')}.</span>
      </footer>
    </article>
  );
}

/** One A4 page's height in CSS pixels (297mm). */
const PAGE_PX = 1122.5;
const ZOOM_STEPS = [0.6, 0.8, 1, 1.25, 1.5, 2, 2.5];
/** Blocks the preview never cuts through (the printed copy keeps them whole the same way). */
const UNBREAKABLE = '.inv-table tr, .inv-totals, .inv-schedule, .inv-bank, .inv-parties, .inv-notes';

/**
 * Where each preview page starts: A4 height apart, pulled up to the top of any
 * block that would straddle the cut. A block taller than a page is cut anyway.
 */
function pageStarts(sheet: HTMLElement): number[] {
  const box = sheet.getBoundingClientRect();
  const k = box.height / (sheet.offsetHeight || 1); // CSS zoom scales rects, not offsets
  const blocks = [...sheet.querySelectorAll(UNBREAKABLE)].map((el) => {
    const r = el.getBoundingClientRect();
    return { top: (r.top - box.top) / k, bottom: (r.bottom - box.top) / k };
  });
  const total = sheet.offsetHeight;
  const starts = [0];
  for (;;) {
    const start = starts[starts.length - 1]!;
    const limit = start + PAGE_PX;
    if (limit >= total - 1) return starts;
    const straddling = blocks.filter((b) => b.top > start + 1 && b.top < limit && b.bottom > limit);
    starts.push(straddling.length ? Math.min(...straddling.map((b) => b.top)) : limit);
  }
}

/**
 * The sheet on screen, one whole page at a time. It opens fitted to its column
 * (never larger), with Previous/Next page when the content runs past one A4
 * page, and zoom: past "fit" the page scrolls sideways and down inside its own
 * box. Pages are cut at A4 height, moved up to the top of any row or block that
 * would straddle the cut (pageStarts); the printed copy (InvoicePrint) does the same by CSS.
 */
export function InvoicePreview({ invoice, editBody, kind }: { invoice: Invoice; editBody?: ReactNode; kind?: SheetKind }) {
  const frame = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [step, setStep] = useState(2);
  const [page, setPage] = useState(0);
  const [starts, setStarts] = useState<number[]>([0]);
  const [total, setTotal] = useState(PAGE_PX);
  const pages = starts.length;
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      // Editing on a phone keeps the sheet at full size (it scrolls sideways) so the fields stay readable.
      if (entry) setFit(editBody && entry.contentRect.width < 600 ? 1 : Math.min(1, entry.contentRect.width / SHEET_PX));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [editBody !== undefined]);
  useEffect(() => {
    const element = sheet.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const next = pageStarts(element);
      setStarts((old) => (old.length === next.length && old.every((v, i) => Math.abs(v - next[i]!) < 1) ? old : next));
      setTotal(element.offsetHeight);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const current = Math.min(page, pages - 1);
  const scale = fit * ZOOM_STEPS[step]!;
  const tool =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-[7px] px-2 text-sm font-semibold text-ink hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div ref={frame} className="inv-frame" data-editing={editBody ? '' : undefined}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2" role="toolbar" aria-label="Preview">
        <div className="flex items-center gap-1">
          <button type="button" className={tool} aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
            ‹
          </button>
          <span className="tabular min-w-20 text-center text-[13px] text-ink-muted" aria-live="polite">
            Page {current + 1} of {pages}
          </span>
          <button type="button" className={tool} aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            ›
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className={tool} aria-label="Zoom out" disabled={step === 0} onClick={() => setStep(step - 1)}>
            −
          </button>
          <button type="button" className={tool + ' min-w-14 text-[13px]'} aria-label="Fit the page to the width" onClick={() => setStep(2)}>
            {step === 2 ? 'Fit' : `${Math.round(ZOOM_STEPS[step]! * 100)}%`}
          </button>
          <button type="button" className={tool} aria-label="Zoom in" disabled={step === ZOOM_STEPS.length - 1} onClick={() => setStep(step + 1)}>
            +
          </button>
        </div>
      </div>
      <div className="inv-viewport">
        <div className="inv-pane" style={{ zoom: scale }}>
          <div style={{ height: PAGE_PX, overflow: 'hidden', background: '#fff' }}>
            {/* Only this page's slice shows: from its start to the next page's start. */}
            <div style={{ height: Math.min(PAGE_PX, (starts[current + 1] ?? total) - starts[current]!), overflow: 'hidden' }}>
              <div ref={sheet} style={{ transform: `translateY(-${starts[current]}px)` }}>
                <InvoiceSheet invoice={invoice} editBody={editBody} kind={kind} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * What the printer gets while this is mounted: every invoice on its own A4
 * page, and nothing else from the app (invoice-sheet.css, @media print).
 */
export function InvoicePrint({ invoices, kind }: { invoices: Invoice[]; kind?: SheetKind }) {
  return createPortal(
    <div className={invoices.length === 1 ? 'inv-print inv-one' : 'inv-print'}>
      {invoices.map((invoice) => (
        <InvoiceSheet key={invoice.id} invoice={invoice} kind={kind} />
      ))}
    </div>,
    document.body,
  );
}

/** Print once the logo is decoded, so the first page is never printed without it. */
export async function printWhenReady(): Promise<void> {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const images = [...document.querySelectorAll<HTMLImageElement>('.inv-print img')];
  await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
  window.print();
}
