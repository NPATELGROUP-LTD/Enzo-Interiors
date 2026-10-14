import { Prisma } from '@prisma/client';

/**
 * Invoice arithmetic, in exact decimals (never JS floats).
 *
 * Line prices are NET (ex-VAT). Each line is rounded to the penny, the lines
 * are added (the subtotal), the discount (a fixed £ amount) comes off that
 * BEFORE VAT, VAT is the discounted net times the rate rounded once, and the
 * gross total is net + VAT. Discounting before VAT is how a UK trade discount
 * works: VAT is charged on what the customer actually pays. A line priced 0 (a
 * quantity-only materials row) adds nothing. The gross total is what
 * invoices.amount stores, so every reader that already treats `amount` as the
 * payable keeps working.
 */
const D = Prisma.Decimal;
type Dec = Prisma.Decimal;

const pennies = (value: Prisma.Decimal.Value): Dec => new D(value).toDecimalPlaces(2, D.ROUND_HALF_UP);

export interface Line {
  quantity: number;
  unit_price: number;
}

export interface Totals {
  /** The lines added up, before the discount. */
  subtotal: number;
  discount: number;
  /** subtotal - discount: what VAT is charged on. Negative = the discount is too big (the caller refuses it). */
  net: number;
  vat: number;
  gross: number;
}

export const lineTotal = (line: Line): Dec => pennies(new D(line.quantity).mul(line.unit_price));

export function totalsOf(lines: Line[], vatRate: number, discount = 0): Totals {
  const subtotal = lines.reduce<Dec>((total, line) => total.add(lineTotal(line)), new D(0));
  const net = subtotal.sub(pennies(discount));
  const vat = pennies(net.mul(vatRate).div(100));
  return {
    subtotal: subtotal.toNumber(),
    discount: pennies(discount).toNumber(),
    net: net.toNumber(),
    vat: vat.toNumber(),
    gross: net.add(vat).toNumber(),
  };
}

/** An invoice without lines (stored before lines existed): split its stored gross amount. */
export function splitGross(gross: number, vatRate: number): Totals {
  const net = pennies(new D(gross).div(new D(vatRate).div(100).add(1)));
  return { subtotal: net.toNumber(), discount: 0, net: net.toNumber(), vat: new D(gross).sub(net).toNumber(), gross };
}

/** Exact sum of money values. */
export function sumMoney(values: number[]): number {
  return values.reduce<Dec>((total, value) => total.add(value), new D(0)).toNumber();
}

/**
 * Milliseconds past the end of the due day (due_date is a timestamp at midnight
 * UTC; an invoice is late after the end of that day). Zero or less = not late.
 */
export const lateMs = (dueDate: string, now = Date.now()): number =>
  now - new Date(`${dueDate.slice(0, 10)}T23:59:59.999Z`).getTime();

/** invoices.amount is DECIMAL(12,2): anything at or over this does not fit. */
export const MAX_AMOUNT = 10_000_000_000;
