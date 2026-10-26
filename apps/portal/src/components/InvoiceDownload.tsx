import { DownloadSimple } from '@phosphor-icons/react';
import { useState } from 'react';

import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { Invoice } from '@/types/api';

/**
 * Saves the invoice as `<number>.pdf`, straight to the device: a real PDF with
 * selectable text (lib/invoicePdf.ts). The PDF library loads on the first Download only.
 */
async function downloadInvoicePdf(invoice: Invoice): Promise<void> {
  const [{ jsPDF }, { buildInvoicePdf }, logo] = await Promise.all([import('jspdf'), import('@/lib/invoicePdf'), loadLogo()]);
  buildInvoicePdf(jsPDF, invoice, logo).save(`${invoice.number}.pdf`);
}

/** The letterhead logo as a data URL; no logo is better than no PDF. */
async function loadLogo(): Promise<string | null> {
  try {
    const blob = await (await fetch('/invoice-logo.png')).blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function InvoiceDownloadButton({ invoice, className }: { invoice: Invoice; className?: string }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const download = async () => {
    setPending(true);
    try {
      await downloadInvoicePdf(invoice);
    } catch {
      toast.error('Could not make the PDF. Use Print and choose Save as PDF instead.');
    } finally {
      setPending(false);
    }
  };
  return (
    <Button
      variant="secondary"
      className={className}
      icon={<DownloadSimple size={16} aria-hidden="true" />}
      loading={pending}
      onClick={download}
      aria-label={`Download invoice ${invoice.number} as a PDF`}
    >
      Download
    </Button>
  );
}
