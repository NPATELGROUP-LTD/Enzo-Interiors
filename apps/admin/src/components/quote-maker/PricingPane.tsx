import { useEffect, useMemo, useState } from 'react';

import { Button, Input, Select } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { money } from '@/lib/format';

import { BOARD_ROLES, ROLE_LABEL, type Breakdown, type Pricing, type StockItem, type UnitTemplate } from './plan';

const FIELDS: Array<{ key: Exclude<keyof Pricing, 'defaults'>; label: string; hint: string; step: number; max: number }> = [
  { key: 'margin_pct', label: 'Margin (%)', hint: 'On top of boards, fittings and labour.', step: 0.5, max: 500 },
  { key: 'hourly_rate', label: 'Fitting rate (£/h)', hint: 'Times each unit’s fitting hours.', step: 0.5, max: 1000 },
  { key: 'range_low_pct', label: 'Range below (%)', hint: 'How far under the total the range starts.', step: 0.5, max: 50 },
  { key: 'range_high_pct', label: 'Range above (%)', hint: 'How far over it the range ends.', step: 0.5, max: 100 },
  { key: 'round_to', label: 'Round range to (£)', hint: 'e.g. 50 shows £1,450 – £1,700.', step: 1, max: 1000 },
  { key: 'kerf_mm', label: 'Saw cut (mm)', hint: 'Lost between pieces on a sheet.', step: 0.5, max: 20 },
  { key: 'edge_trim_mm', label: 'Edge trim (mm)', hint: 'Cut off each sheet edge first.', step: 1, max: 100 },
];
const NUMBERS = ['margin_pct', 'range_low_pct', 'range_high_pct', 'kerf_mm', 'edge_trim_mm', 'round_to', 'hourly_rate'] as const;

/** Pricing settings (Admin): margin, labour rate, range, cutting allowances and the default board per role. VAT is Settings › VAT. */
export function PricingPane({ pricing, items, onSaved }: { pricing: Pricing; items: StockItem[]; onSaved: (p: Pricing) => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Pricing>(pricing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const defaults = Object.fromEntries(BOARD_ROLES.map((r) => [r, form.defaults[r] || null]));
      const saved = await api.put<Pricing>('/quote-maker/pricing', { ...form, defaults });
      toast.success('Pricing saved. Every price uses it from now on.');
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <section className="rounded-card bg-surface p-4 shadow-soft">
            <h2 className="text-base font-semibold text-ink">Default boards</h2>
            <p className="mb-3 text-xs text-ink-muted">
              What a unit is made of unless it, or the customer, picks another. A board needs its sheet size in Inventory; until a role has one, units that use it are not priced.
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {BOARD_ROLES.map((role) => {
                const choices = items.filter((i) => i.active && i.type === 'Sheet' && i.board_role === role && i.length_mm && i.width_mm);
                return (
                  <Select
                    key={role}
                    label={ROLE_LABEL[role]}
                    value={form.defaults[role] ?? ''}
                    hint={choices.length ? undefined : `No ${ROLE_LABEL[role].toLowerCase()} boards with a size yet.`}
                    onChange={(e) => setForm((f) => ({ ...f, defaults: { ...f.defaults, [role]: e.target.value || null } }))}
                  >
                    <option value="">None</option>
                    {choices.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.length_mm} × {i.width_mm})
                      </option>
                    ))}
                  </Select>
                );
              })}
            </div>
          </section>

          <Example form={form} />
        </div>

        <section className="rounded-card bg-surface p-4 shadow-soft">
          <h2 className="mb-3 text-base font-semibold text-ink">Working</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {FIELDS.map((f) => (
              <Input
                key={f.key}
                label={f.label}
                hint={f.hint}
                type="number"
                inputMode="decimal"
                min={f.key === 'round_to' ? 1 : 0}
                max={f.max}
                step={f.step}
                required
                value={form[f.key]}
                onChange={(e) => setForm((p) => ({ ...p, [f.key]: Number(e.target.value) }))}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-muted">VAT comes from Settings › VAT. Board and fitting costs come from each item’s quote cost in Inventory, else its average cost.</p>
        </section>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={saving}>
          Save pricing
        </Button>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </div>
    </form>
  );
}

/**
 * One real unit priced by the API with the numbers as typed (nothing is saved to see it), so a change
 * to the margin or the rounding shows what it does to an actual price. The default boards count once saved.
 */
function Example({ form }: { form: Pricing }) {
  const templates = useQuery<UnitTemplate[]>('/quote-maker/templates');
  const unit = useMemo(() => {
    const list = templates.data ?? [];
    const t = list.find((x) => x.active && x.mount === 'floor' && !x.problems.length) ?? list.find((x) => x.active && x.mount !== 'gap' && !x.problems.length);
    const v = t?.variants.find((x) => x.width_mm === 600) ?? t?.variants[0];
    return t && v ? { template: t, variant: v } : null;
  }, [templates.data]);
  const numbers = JSON.stringify(NUMBERS.map((k) => form[k]));
  const [result, setResult] = useState<{ data: Breakdown | null; error: string | null }>({ data: null, error: null });

  useEffect(() => {
    if (!unit) return;
    let live = true;
    const preview = Object.fromEntries(JSON.parse(numbers).map((value: number, i: number) => [NUMBERS[i], value]));
    const timer = window.setTimeout(() => {
      api
        .post<Breakdown>('/quote-maker/breakdown', { units: [{ template_id: unit.template.id, variant_id: unit.variant.id }], preview })
        .then((data) => live && setResult({ data, error: null }))
        .catch((caught) => live && setResult({ data: null, error: caught instanceof ApiError ? caught.message : 'Could not work it out.' }));
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [unit, numbers]);

  const b = result.data;
  return (
    <section aria-labelledby="qm-example" className="rounded-card bg-surface p-4 shadow-soft">
      <h2 id="qm-example" className="text-base font-semibold text-ink">Example price</h2>
      {!unit ? (
        <p className="mt-1 text-sm text-ink-muted">{templates.data ? 'No unit is ready to price yet. Choose the default boards and give them a cost in Inventory.' : 'Loading…'}</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-ink-muted">
            One {unit.variant.width_mm} mm {unit.template.name.toLowerCase()}, worked out with the numbers as typed. Default boards count once you save.
          </p>
          {result.error ? (
            <p role="alert" className="text-sm text-danger">{result.error}</p>
          ) : !b ? (
            <p className="text-sm text-ink-muted">Working it out…</p>
          ) : (
            <div className="tabular grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
              <span className="text-ink-muted">Boards, fittings and labour</span>
              <span className="text-right">{money(b.cost)}</span>
              <span className="text-ink-muted">Margin {b.margin_pct}%</span>
              <span className="text-right">{money(b.margin)}</span>
              <span className="text-ink-muted">VAT {b.vat_rate}%</span>
              <span className="text-right">{money(b.vat)}</span>
              <span className="border-t border-border pt-1.5 font-semibold">Total</span>
              <span className="border-t border-border pt-1.5 text-right font-semibold">{money(b.gross)}</span>
              <span className="text-ink-muted">Website range</span>
              <span className="text-right font-semibold text-green-900">{b.unpriced.length ? 'Not priced' : `${money(b.low)} – ${money(b.high)}`}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
