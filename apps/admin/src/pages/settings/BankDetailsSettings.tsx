import { useEffect, useState } from 'react';

import { Button, ErrorState, Input, LoadingState, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import type { BankDetails } from '@/types/api';

const EMPTY = { account_name: '', bank_name: '', sort_code: '', account_number: '', reference_note: '' };
type Form = typeof EMPTY;

const fromSaved = (saved: BankDetails | null): Form => (saved ? { ...saved, reference_note: saved.reference_note ?? '' } : EMPTY);

/**
 * Settings › Bank details: one block, printed on every invoice sheet and PDF so
 * clients know where to pay. It is sent only inside signed-in invoice views and
 * never reaches the public website. There is no online payment.
 */
export function BankDetailsSettings() {
  const toast = useToast();
  const settings = useQuery<{ bank_details: BankDetails | null }>('/settings/bank-details');
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) setForm(fromSaved(settings.data.bank_details));
  }, [settings.data]);

  if (settings.error) return <ErrorState message={settings.error} onRetry={settings.refetch} />;
  if (!form || !settings.data) return <LoadingState label="Loading bank details…" />;

  const dirty = JSON.stringify(form) !== JSON.stringify(fromSaved(settings.data.bank_details));
  const set = (change: Partial<Form>) => setForm({ ...form, ...change });

  const save = async () => {
    const next: typeof errors = {};
    if (!form.account_name.trim()) next.account_name = 'Enter the account name.';
    if (!form.bank_name.trim()) next.bank_name = 'Enter the bank name.';
    if (!/^\d{6}$/.test(form.sort_code.replace(/[\s-]/g, ''))) next.sort_code = 'A sort code is 6 digits, e.g. 12-34-56.';
    if (!/^\d{8}$/.test(form.account_number.replace(/\s/g, ''))) next.account_number = 'An account number is 8 digits.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      settings.setData(await api.put('/settings/bank-details', form));
      toast.success('Bank details saved. New and existing invoices show them.');
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save the bank details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Bank details</h2>
          <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-muted">
            Printed on every invoice sheet and PDF so clients know where to send payment. They are shown only to signed-in
            clients on their own invoices, never on the website. Payment itself happens outside the platform.
          </p>
        </div>
        <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Input
          label="Account name"
          value={form.account_name}
          maxLength={120}
          error={errors.account_name}
          onChange={(event) => set({ account_name: event.target.value })}
        />
        <Input
          label="Bank name"
          value={form.bank_name}
          maxLength={120}
          error={errors.bank_name}
          onChange={(event) => set({ bank_name: event.target.value })}
        />
        <Input
          label="Sort code"
          value={form.sort_code}
          inputMode="numeric"
          maxLength={8}
          placeholder="12-34-56"
          error={errors.sort_code}
          onChange={(event) => set({ sort_code: event.target.value })}
        />
        <Input
          label="Account number"
          value={form.account_number}
          inputMode="numeric"
          maxLength={8}
          placeholder="12345678"
          error={errors.account_number}
          onChange={(event) => set({ account_number: event.target.value })}
        />
      </div>
      <div className="mt-4">
        <Textarea
          label="Payment reference note"
          hint="Printed under the bank details, e.g. “Please use the invoice number as the payment reference.” Optional."
          value={form.reference_note}
          maxLength={200}
          rows={3}
          onChange={(event) => set({ reference_note: event.target.value })}
        />
      </div>
    </div>
  );
}
