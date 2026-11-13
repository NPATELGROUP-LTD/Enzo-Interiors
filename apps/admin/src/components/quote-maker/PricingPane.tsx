import { useState } from 'react';

import { Button, Input, Select } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';

import { BOARD_ROLES, ROLE_LABEL, type Pricing, type StockItem } from './plan';

const FIELDS: Array<{ key: Exclude<keyof Pricing, 'defaults'>; label: string; hint: string; step: number; max: number }> = [
  { key: 'margin_pct', label: 'Margin (%)', hint: 'Added on top of boards, fittings and labour.', step: 0.5, max: 500 },
  { key: 'hourly_rate', label: 'Fitting rate (£ per hour)', hint: 'Times each unit’s fitting hours.', step: 0.5, max: 1000 },
  { key: 'range_low_pct', label: 'Range below (%)', hint: 'How far under the worked total the website range starts.', step: 0.5, max: 50 },
  { key: 'range_high_pct', label: 'Range above (%)', hint: 'How far over it the range ends.', step: 0.5, max: 100 },
  { key: 'round_to', label: 'Round the range to (£)', hint: 'e.g. 50 shows £1,450 – £1,700.', step: 1, max: 1000 },
  { key: 'kerf_mm', label: 'Saw cut (mm)', hint: 'Lost between pieces on a sheet.', step: 0.5, max: 20 },
  { key: 'edge_trim_mm', label: 'Edge trim (mm)', hint: 'Cut off each sheet edge before nesting.', step: 1, max: 100 },
];

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
      className="flex max-w-3xl flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <section className="rounded-card bg-surface p-4 shadow-soft">
        <h2 className="text-base font-semibold text-ink">Default boards</h2>
        <p className="mb-3 text-sm text-ink-muted">
          What a unit is made of unless it, or the customer, picks another. A board needs its sheet size in Inventory. Until a role has one, units that use it are not priced.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {BOARD_ROLES.map((role) => {
            const choices = items.filter((i) => i.active && i.type === 'Sheet' && i.board_role === role && i.length_mm && i.width_mm);
            return (
              <Select
                key={role}
                label={ROLE_LABEL[role]}
                value={form.defaults[role] ?? ''}
                hint={choices.length ? undefined : `No ${ROLE_LABEL[role].toLowerCase()} boards with a size in Inventory yet.`}
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

      <section className="rounded-card bg-surface p-4 shadow-soft">
        <h2 className="mb-3 text-base font-semibold text-ink">Working</h2>
        <div className="grid gap-3 sm:grid-cols-2">
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

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={saving}>
          Save pricing
        </Button>
        {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      </div>
    </form>
  );
}
