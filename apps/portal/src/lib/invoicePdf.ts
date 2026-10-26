import type { jsPDF } from 'jspdf';

import { DEFAULT_ISSUER } from '@/components/invoice/InvoiceSheet';
import { date, money } from '@/lib/format';
import type { Invoice } from '@/types/api';

/*
 * The invoice as a real PDF (text you can select, search and copy), laid out
 * like components/invoice/InvoiceSheet: letterhead, green band, who and what,
 * itemised list, totals, payment schedule. Keep the two in step.
 * ponytail: the standard PDF fonts (Helvetica, Times) stand in for Inter and Palatino.
 */

type Rgb = [number, number, number];
const FOREST: Rgb = [23, 60, 48];
const INK: Rgb = [30, 36, 32];
const MUTED: Rgb = [104, 112, 102];
const RULE: Rgb = [220, 224, 216];
const WASH: Rgb = [242, 244, 239];
const SAND: Rgb = [236, 231, 220];
const CREAM: Rgb = [243, 239, 228];
const CREAM_DIM: Rgb = [177, 177, 167];
const RED: Rgb = [155, 59, 47];

/** One point in millimetres. */
const PT = 25.4 / 72;
/** A4 and the sheet's padding. */
const L = 15;
const R = 195;
const W = R - L;
const TOP = 12;
/** Content stops here; the footer sits below it. */
const BOTTOM = 279;
const LINE = 1.35;

/** The standard fonts cover Latin-1 and common punctuation; anything else would print as noise. */
const clean = (value: string): string => value.replace(/[^\n\x20-\x7e\xa0-\xff–—‘’“”•…€]/g, '?');
const lineHeight = (size: number): number => size * PT * LINE;

export function buildInvoicePdf(JsPdf: typeof jsPDF, invoice: Invoice, logo: string | null): jsPDF {
  const issuer = invoice.issuer ?? DEFAULT_ISSUER;
  const items = invoice.items ?? [];
  const schedule = invoice.payment_schedule ?? [];
  const discount = invoice.discount ?? 0;
  const subtotal = invoice.subtotal_amount ?? invoice.net_amount;

  const pdf = new JsPdf({ unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: `Invoice ${invoice.number}`, author: issuer.name });
  pdf.setLineHeightFactor(LINE);
  let y = TOP;

  const font = (face: 'helvetica' | 'times', style: 'normal' | 'bold' | 'italic', size: number, color: Rgb) => {
    pdf.setFont(face, style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
  };
  const wrap = (value: string, width: number): string[] => pdf.splitTextToSize(clean(value), width) as string[];
  const put = (value: string | string[], x: number, top: number, align: 'left' | 'right' | 'center' = 'left') =>
    pdf.text(Array.isArray(value) ? value : clean(value), x, top, { baseline: 'top', align });
  const width = (value: string): number => pdf.getTextWidth(clean(value));
  const fill = (x: number, top: number, w: number, h: number, color: Rgb) => {
    pdf.setFillColor(...color);
    pdf.rect(x, top, w, h, 'F');
  };
  const rule = (x1: number, x2: number, at: number, thickness: number, color: Rgb) => {
    pdf.setDrawColor(...color);
    pdf.setLineWidth(thickness);
    pdf.line(x1, at, x2, at);
  };
  const newPage = () => {
    pdf.addPage();
    y = TOP;
  };
  /** Starts a new page unless `height` still fits. Returns whether it did. */
  const room = (height: number): boolean => {
    if (y + height <= BOTTOM) return true;
    newPage();
    return false;
  };

  // Letterhead: logo left, company right.
  const logoHeight = (40 * 324) / 640;
  if (logo) pdf.addImage(logo, 'PNG', L, y, 40, logoHeight);
  font('helvetica', 'bold', 11.5, FOREST);
  put(issuer.name, R, y, 'right');
  font('helvetica', 'normal', 8.5, MUTED);
  const contact = [...issuer.address, issuer.phone, issuer.email];
  let issuerBottom = y + lineHeight(11.5) * (1.5 / LINE) + 1;
  for (const line of contact) {
    put(line, R, issuerBottom, 'right');
    issuerBottom += 8.5 * PT * 1.5;
  }
  y = Math.max(y + logoHeight, issuerBottom) + 5;

  // The green band: title and stamp left, number and dates right.
  const bandHeight = 2.6 * 2 + 20 * PT * 1.1;
  fill(0, y, 210, bandHeight, FOREST);
  font('times', 'bold', 20, CREAM);
  put('Invoice', L, y + 3.2);
  if (invoice.status === 'Draft' || invoice.status === 'Paid') {
    font('times', 'bold', 20, CREAM);
    const stampX = L + width('Invoice') + 3;
    font('helvetica', 'bold', 8, CREAM);
    const stampWidth = width(invoice.status) + 4.8;
    pdf.setDrawColor(...CREAM);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(stampX, y + bandHeight / 2 - 2.5, stampWidth, 5, 1, 1, 'S');
    put(invoice.status, stampX + stampWidth / 2, y + bandHeight / 2 - 1.5, 'center');
  }
  const facts: Array<[string, string]> = [
    ['Number', invoice.number],
    ['Issued', date(invoice.created_at)],
    [invoice.paid_at ? 'Paid' : 'Due', date(invoice.paid_at ?? invoice.due_date)],
  ];
  const widths = facts.map(([label, value]) => {
    font('helvetica', 'normal', 8.5, CREAM_DIM);
    const a = width(label);
    font('helvetica', 'bold', 8.5, CREAM);
    return Math.max(a, width(value));
  });
  let x = R - widths.reduce((sum, w) => sum + w, 0) - 7 * (facts.length - 1);
  facts.forEach(([label, value], index) => {
    font('helvetica', 'normal', 8.5, CREAM_DIM);
    put(label, x, y + 2.5);
    font('helvetica', 'bold', 8.5, CREAM);
    put(value, x, y + 2.5 + lineHeight(8.5));
    x += widths[index]! + 7;
  });
  y += bandHeight + 3.5;

  // Who and what: two columns of label/value pairs.
  const column = (x0: number, kicker: string, pairs: Array<[string, string, boolean]>): number => {
    let at = y;
    font('helvetica', 'italic', 8.5, MUTED);
    put(kicker, x0, at);
    at += lineHeight(8.5) + 1.5;
    font('helvetica', 'normal', 9, MUTED);
    const gap = Math.max(...pairs.map(([label]) => width(label))) + 4;
    for (const [label, value, strong] of pairs) {
      font('helvetica', strong ? 'bold' : 'normal', 9, INK);
      const lines = wrap(value, 85 - gap);
      font('helvetica', 'normal', 9, MUTED);
      put(label, x0, at);
      font('helvetica', strong ? 'bold' : 'normal', 9, INK);
      put(lines, x0 + gap, at);
      at += lines.length * lineHeight(9) + 0.8;
    }
    return at - 0.8;
  };
  const left = column(L, 'Submitted to', [
    ['Customer', invoice.client_name, true],
    ['Phone', invoice.client_phone || 'N/A', false],
    ['Email', invoice.client_email || 'N/A', false],
  ]);
  const right = column(110, 'Job', [
    ['Job name', invoice.job_name || invoice.project_name || '—', true],
    ['Address', invoice.job_address || '—', false],
  ]);
  y = Math.max(left, right) + 3;
  rule(L, R, y, 0.3, RULE);

  if (invoice.job_notes) {
    y += 2.5;
    font('helvetica', 'italic', 8.5, MUTED);
    put('Job notes', L, y);
    y += lineHeight(8.5) + 1.5;
    font('helvetica', 'normal', 9, INK);
    const notes = wrap(invoice.job_notes, W);
    put(notes, L, y);
    y += notes.length * lineHeight(9);
  }

  // Itemised list.
  y += 4.5;
  font('times', 'bold', 14, FOREST);
  put('Itemised list', L, y);
  y += lineHeight(14) + 2;

  const cols = { item: L, detail: L + 72, qty: L + 138, total: L + 152 } as const;
  const head = () => {
    const h = lineHeight(8.5) + 1.8;
    fill(L, y, W, h, SAND);
    font('helvetica', 'bold', 8.5, FOREST);
    put('Item', cols.item + 2, y + 0.9);
    put('Description', cols.detail + 2, y + 0.9);
    put('Qty', cols.total - 2, y + 0.9, 'right');
    put('Total', R - 2, y + 0.9, 'right');
    y += h;
  };
  /** A row that needs `height`; a new page repeats the column heads. */
  const rowRoom = (height: number) => {
    if (!room(height)) head();
  };
  head();

  if (items.length === 0) {
    rowRoom(lineHeight(9) + 1.8);
    font('helvetica', 'normal', 9, INK);
    put(invoice.project_name ?? 'Work as agreed', cols.item + 2, y + 0.9);
    put(money(subtotal), R - 2, y + 0.9, 'right');
    y += lineHeight(9) + 1.8;
    rule(L, R, y, 0.25, RULE);
  }
  items.forEach((item, index) => {
    font('helvetica', 'normal', 9, INK);
    const description = wrap(item.description, cols.detail - cols.item - 4);
    font('helvetica', 'normal', 9, MUTED);
    const detail = wrap(item.detail ?? '', cols.qty - cols.detail - 4);
    const h = Math.max(description.length, detail.length, 1) * lineHeight(9) + 1.8;
    // A section heading never ends a page: it moves with its first row.
    const sectionHeight = item.section && item.section !== items[index - 1]?.section ? lineHeight(9) + 2.5 : 0;
    rowRoom(sectionHeight + h);
    if (sectionHeight) {
      fill(L, y, W, sectionHeight, WASH);
      font('helvetica', 'bold', 9, FOREST);
      put(item.section!, L + 2, y + 1.6);
      y += sectionHeight;
    }
    font('helvetica', 'normal', 9, INK);
    put(description, cols.item + 2, y + 0.9);
    font('helvetica', 'normal', 9, MUTED);
    put(detail, cols.detail + 2, y + 0.9);
    font('helvetica', 'normal', 9, INK);
    put(String(Number(item.quantity)), cols.total - 2, y + 0.9, 'right');
    if (item.unit_price > 0) put(money(Math.round(item.quantity * item.unit_price * 100) / 100), R - 2, y + 0.9, 'right');
    y += h;
    rule(L, R, y, 0.25, RULE);
  });

  // Totals, kept together at the right.
  const totals: Array<[string, string, Rgb]> = [['Total project value', money(subtotal), INK]];
  if (discount > 0) totals.push(['Discount', `-${money(discount)}`, RED]);
  if (invoice.vat_rate > 0) totals.push([`VAT at ${invoice.vat_rate}%`, money(invoice.vat_amount), INK]);
  const row = lineHeight(9) + 1.6;
  y += 3;
  room(totals.length * row + 2 + lineHeight(11.5) + 0.8);
  const boxX = R - 82;
  for (const [label, value, color] of totals) {
    font('helvetica', 'normal', 9, color);
    put(label, boxX + 2, y + 0.8);
    put(value, R - 2, y + 0.8, 'right');
    y += row;
  }
  rule(boxX, R, y, 0.4, FOREST);
  font('helvetica', 'bold', 11.5, FOREST);
  put(discount > 0 && invoice.vat_rate <= 0 ? 'After discount' : 'Total payable', boxX + 2, y + 2);
  put(money(invoice.amount), R - 2, y + 2, 'right');
  y += 2 + lineHeight(11.5) + 0.8;

  // Payment schedule, kept together.
  if (schedule.length > 0) {
    y += 4;
    const rows = schedule.map((entry) => {
      font('helvetica', 'normal', 9, INK);
      const label = wrap(entry.label, 118);
      return { label, entry, h: label.length * lineHeight(9) + 1.8 };
    });
    room(lineHeight(11) + 1.5 + rows.reduce((sum, r) => sum + r.h, 0));
    font('times', 'bold', 11, FOREST);
    put('Payment schedule', L, y);
    y += lineHeight(11) + 1.5;
    for (const { label, entry, h } of rows) {
      font('helvetica', 'normal', 9, INK);
      put(label, L + 2, y + 0.9);
      font('helvetica', 'normal', 9, MUTED);
      if (entry.date) put(date(entry.date), L + 122, y + 0.9);
      font('helvetica', 'normal', 9, INK);
      put(money(entry.amount), R - 2, y + 0.9, 'right');
      y += h;
      rule(L, R, y, 0.25, RULE);
    }
  }

  // Footer at the foot of the last page.
  const footer = 297 - 10 - lineHeight(8);
  font('helvetica', 'normal', 8, MUTED);
  put(`Please quote ${invoice.number} with your payment.`, L, footer);
  put(`Thank you for choosing ${issuer.name.replace(/\s*(LTD|Ltd|Limited)\.?$/, '')}.`, R, footer, 'right');
  return pdf;
}
