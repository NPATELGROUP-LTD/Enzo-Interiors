import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { date, money } from '@/lib/format';
import type { Invoice, InvoiceIssuer, InvoiceItem } from '@/types/api';

import './invoice-sheet.css';

/*
 * The invoice as the client gets it: one A4 sheet, the same layout as the
 * business's paper invoice (letterhead, green band, who and what, job notes,
 * itemised list in sections, totals, payment schedule). Copied as is in
 * apps/admin and apps/portal; keep the two in step.
 */

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

export function InvoiceSheet({ invoice }: { invoice: Invoice }) {
  const issuer = invoice.issuer ?? DEFAULT_ISSUER;
  const items = invoice.items ?? [];
  const schedule = invoice.payment_schedule ?? [];
  const discount = invoice.discount ?? 0;
  const subtotal = invoice.subtotal_amount ?? invoice.net_amount;

  return (
    <article className="inv-sheet" aria-label={`Invoice ${invoice.number}`}>
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
          Invoice
          {invoice.status === 'Draft' ? <span className="inv-stamp">Draft</span> : null}
          {invoice.status === 'Paid' ? <span className="inv-stamp">Paid</span> : null}
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
          <div>
            <dt>{invoice.paid_at ? 'Paid' : 'Due'}</dt>
            <dd>{date(invoice.paid_at ?? invoice.due_date)}</dd>
          </div>
        </dl>
      </div>

      <section className="inv-parties">
        <div>
          <p className="inv-kicker">Submitted to</p>
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
          <p className="inv-kicker">Job</p>
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
          <p className="inv-kicker">Job notes</p>
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
            <th scope="col" className="inv-right inv-col-total">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={3}>{invoice.project_name ?? 'Work as agreed'}</td>
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
            <th scope="row">{discount > 0 && invoice.vat_rate <= 0 ? 'After discount' : 'Total payable'}</th>
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

      <footer className="inv-foot">
        <span>Please quote {invoice.number} with your payment.</span>
        <span>Thank you for choosing {issuer.name.replace(/\s*(LTD|Ltd|Limited)\.?$/, '')}.</span>
      </footer>
    </article>
  );
}

/** One sheet on screen, scaled down to fit its column (never up). */
export function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const frame = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setZoom(Math.min(1, entry.contentRect.width / SHEET_PX));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={frame} className="inv-frame">
      <div style={{ zoom }}>
        <InvoiceSheet invoice={invoice} />
      </div>
    </div>
  );
}

/**
 * What the printer gets while this is mounted: every invoice on its own A4
 * page, and nothing else from the app (invoice-sheet.css, @media print).
 */
export function InvoicePrint({ invoices }: { invoices: Invoice[] }) {
  return createPortal(
    <div className="inv-print">
      {invoices.map((invoice) => (
        <InvoiceSheet key={invoice.id} invoice={invoice} />
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
