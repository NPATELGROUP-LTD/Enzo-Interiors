import { useEffect, useState } from 'react';

import { Button, ErrorState, Input, LoadingState } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';

/**
 * Settings › VAT: the rate a new quote or invoice starts with (the editor can
 * still change it per document). Saved quotes and invoices keep the rate they
 * were made with. 0% until the studio is VAT-registered.
 */
export function VatSettings() {
  const toast = useToast();
  const settings = useQuery<{ vat_rate: number }>('/settings/vat');
  const [rate, setRate] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) setRate(String(settings.data.vat_rate));
  }, [settings.data]);

  if (settings.error) return <ErrorState message={settings.error} onRetry={settings.refetch} />;
  if (rate === null || !settings.data) return <LoadingState label="Loading VAT…" />;

  const value = Number(rate);
  const dirty = rate.trim() !== '' && value !== settings.data.vat_rate;

  const save = async () => {
    if (rate.trim() === '' || !Number.isFinite(value) || value < 0 || value > 100 || Math.round(value * 100) !== value * 100) {
      setError('Enter a rate from 0 to 100, with at most two decimals.');
      return;
    }
    setError(undefined);
    setSaving(true);
    try {
      settings.setData(await api.put('/settings/vat', { vat_rate: value }));
      toast.success(value === 0 ? 'VAT is off for new quotes and invoices.' : `New quotes and invoices start at ${value}% VAT.`);
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save the VAT rate.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">VAT</h2>
          <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-muted">
            The rate every new quote and invoice starts with, and the one the website&rsquo;s quote maker uses. Leave it at 0%
            until the studio is VAT-registered. Quotes and invoices already made keep their own rate.
          </p>
        </div>
        <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </header>

      <form
        className="mt-6 max-w-xs"
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty) void save();
        }}
      >
        <Input
          label="VAT rate (%)"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="0.01"
          value={rate}
          error={error}
          hint={value === 0 ? 'Off: quotes and invoices show no VAT line.' : 'The UK standard rate is 20%.'}
          onChange={(event) => setRate(event.target.value)}
        />
      </form>
    </div>
  );
}
