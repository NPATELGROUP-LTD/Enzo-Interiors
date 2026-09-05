/**
 * Money handling for the prototype datastore.
 *
 * The schema doc is emphatic that monetary columns are `decimal`, never
 * `float` (Backend Schema section 6; CLAUDE.md "Don'ts"). JSON has no decimal
 * type, so every monetary value here is a `number` that is forced back to
 * exactly 2 decimal places on every write and after every arithmetic step.
 *
 * That is NOT the same guarantee as a real decimal type — it is float
 * arithmetic with aggressive rounding, which is adequate for a prototype whose
 * totals are in the low thousands but is NOT adequate for production. When the
 * Prisma/PostgreSQL layer lands, these columns become `Decimal(12,2)` and this
 * module goes away rather than being ported. Do not let it become the
 * long-term answer.
 *
 * Every arithmetic path that produces a stored monetary value must funnel
 * through `money()` so rounding happens once per step rather than accumulating.
 */

/** Round to exactly 2dp, the precision of every `decimal(n,2)` column. */
export function money(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Refusing to store a non-finite monetary value: ${value}`);
  }
  // Nudge by EPSILON before rounding so that values such as 1.005, which are
  // stored as 1.00499999... in binary float, still round up the way an
  // accountant expects rather than silently down.
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Multiply a quantity by a unit price, rounded to 2dp. */
export function lineTotal(quantity: number, unitPrice: number): number {
  return money(quantity * unitPrice);
}

/** Sum monetary values, rounding once at the end. */
export function sum(values: number[]): number {
  return money(values.reduce((total, value) => total + value, 0));
}

/**
 * Apply a VAT percentage (e.g. 20 for 20%) to a net subtotal.
 * Returns the VAT amount only, not the gross.
 */
export function vatAmount(subtotal: number, vatRatePercent: number): number {
  return money(subtotal * (vatRatePercent / 100));
}

/** Gross total = net subtotal + VAT at the given percentage rate. */
export function grossTotal(subtotal: number, vatRatePercent: number): number {
  return money(subtotal + vatAmount(subtotal, vatRatePercent));
}
