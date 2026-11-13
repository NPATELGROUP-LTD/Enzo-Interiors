import { Warning } from '@phosphor-icons/react';
import { useState } from 'react';

import { money } from '@/lib/format';

import type { Breakdown, StockItem } from './plan';

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** The API's working for a design: what the visitor would see, and the cost, margin and sheets behind it. */
export function BreakdownPanel({ breakdown, error, items }: { breakdown: Breakdown | null; error: string | null; items: Map<string, StockItem> }) {
  const [open, setOpen] = useState<string | null>(null);
  if (error) return <p className="rounded-card bg-warning-bg p-3 text-sm text-warning">{error}</p>;
  if (!breakdown) return <p className="text-sm text-ink-muted">Add units to see the price.</p>;
  const b = breakdown;
  const unpriced = b.unpriced.length > 0;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="rounded-card bg-green-900 p-4 text-on-primary">
        <p className="text-xs font-semibold uppercase tracking-wide text-on-primary/70">Website range{b.vat_rate ? `, inc. ${pct(b.vat_rate)} VAT` : ''}</p>
        <p className="tabular mt-1 text-2xl font-semibold">{unpriced ? 'Not priced' : `${money(b.low)} – ${money(b.high)}`}</p>
        <p className="tabular mt-1 text-xs text-on-primary/75">Worked total {money(b.gross)}</p>
      </div>

      {unpriced ? (
        <p className="flex gap-2 rounded-card bg-warning-bg p-3 text-warning">
          <Warning size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            These cost £0, so a visitor sees no price: <strong>{b.unpriced.join(', ')}</strong>. Give them a quote cost in Inventory.
          </span>
        </p>
      ) : null}
      {b.warnings.map((w) => (
        <p key={w} className="rounded-card bg-warning-bg p-3 text-warning">{w}</p>
      ))}

      <dl className="tabular grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
        <dt className="text-ink-muted">Boards</dt>
        <dd className="text-right">{money(b.boards.reduce((s, x) => s + x.cost, 0))}</dd>
        <dt className="text-ink-muted">Hardware</dt>
        <dd className="text-right">{money(b.hardware.reduce((s, x) => s + x.cost, 0))}</dd>
        <dt className="text-ink-muted">Labour, {b.labour.hours} h</dt>
        <dd className="text-right">{money(b.labour.cost)}</dd>
        {b.extras?.length ? (
          <>
            <dt className="text-ink-muted">Other work</dt>
            <dd className="text-right">{money(b.extras.reduce((s, x) => s + x.cost, 0))}</dd>
          </>
        ) : null}
        <dt className="border-t border-border pt-1.5 font-semibold">Cost</dt>
        <dd className="border-t border-border pt-1.5 text-right font-semibold">{money(b.cost)}</dd>
        <dt className="text-ink-muted">Margin {pct(b.margin_pct)}</dt>
        <dd className="text-right">{money(b.margin)}</dd>
        <dt className="text-ink-muted">Net</dt>
        <dd className="text-right">{money(b.net)}</dd>
        <dt className="text-ink-muted">VAT {pct(b.vat_rate)}</dt>
        <dd className="text-right">{money(b.vat)}</dd>
        <dt className="border-t border-border pt-1.5 font-semibold">Total</dt>
        <dd className="border-t border-border pt-1.5 text-right font-semibold">{money(b.gross)}</dd>
      </dl>

      {b.boards.length ? (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">Sheets</h3>
          <ul className="flex flex-col gap-1">
            {b.boards.map((board) => {
              const item = items.get(board.item_id);
              const shown = open === board.item_id;
              return (
                <li key={board.item_id} className="rounded-control border border-border">
                  <button
                    type="button"
                    aria-expanded={shown}
                    onClick={() => setOpen(shown ? null : board.item_id)}
                    className="tabular flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left pointer-fine:min-h-9"
                  >
                    <span className="truncate">{board.name}</span>
                    <span className="shrink-0 text-ink-muted">
                      {board.sheets} × · {money(board.cost)}
                    </span>
                  </button>
                  {shown ? (
                    <div className="grid grid-cols-2 gap-2 border-t border-border p-2">
                      {board.layout.map((sheet, i) => (
                        <Sheet key={i} length={item?.length_mm ?? 2800} width={item?.width_mm ?? 2070} sheet={sheet} n={i + 1} />
                      ))}
                      {board.oversize.map((o) => (
                        <p key={o.label} className="col-span-2 text-xs text-warning">
                          {o.label} ({o.length_mm} × {o.width_mm}) is bigger than a sheet: {o.boards} boards, jointed.
                        </p>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {b.hardware.length ? (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">Hardware</h3>
          <ul className="tabular flex flex-col gap-0.5">
            {b.hardware.map((h) => (
              <li key={h.item_id} className="flex justify-between gap-2">
                <span className="truncate">{h.qty} × {h.name}</span>
                <span className="text-ink-muted">{money(h.cost)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Sheet({ length, width, sheet, n }: { length: number; width: number; sheet: Breakdown['boards'][number]['layout'][number]; n: number }) {
  const used = Math.round((sheet.used_area / (length * width)) * 100);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${length} ${width}`} className="w-full rounded-[4px] bg-surface-muted" role="img" aria-label={`Sheet ${n}: ${sheet.placements.length} pieces, ${used}% used`}>
        <rect width={length} height={width} className="fill-none stroke-border" strokeWidth={12} />
        {sheet.placements.map((p, i) => (
          <g key={i}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} className="fill-green-100 stroke-green-900" strokeWidth={6} />
            {p.w > 300 && p.h > 140 ? (
              <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={70} className="fill-green-900">
                {p.label}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      <figcaption className="tabular mt-0.5 text-[11px] text-ink-muted">
        Sheet {n} · {used}% used
      </figcaption>
    </figure>
  );
}
