import type { Pence } from "./types";

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const GBP_EXACT = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER = new Intl.NumberFormat("en-GB");

export const pounds = (pence: Pence) => GBP.format(Math.round(pence / 100));
export const poundsExact = (pence: Pence) => GBP_EXACT.format(pence / 100);
export const mm = (value: number) => `${NUMBER.format(Math.round(value))} mm`;
export const metres = (valueMm: number) => `${(valueMm / 1000).toFixed(1)} m`;
export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** Light or dark text for a label printed on a board swatch. */
export function inkFor(hex: string): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.replace(/./g, (c) => c + c) : value;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return "#2C2C2C";
  const channel = (shift: number) => {
    const c = ((n >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.36 ? "#2C2C2C" : "#F2F0EB";
}
