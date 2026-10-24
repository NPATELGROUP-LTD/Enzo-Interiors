import { DownloadSimple } from '@phosphor-icons/react';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { InvoiceSheet } from '@/components/invoice/InvoiceSheet';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import type { Invoice } from '@/types/api';

/**
 * Saves the invoice as `<number>.pdf`, straight to the device: the A4 sheet,
 * drawn off screen at full size whatever the screen, as an image on A4 pages.
 * The two libraries load on the first Download only.
 * ponytail: an image PDF (text not selectable); render it on the server if that matters.
 */
async function downloadInvoicePdf(invoice: Invoice): Promise<void> {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0';
  document.body.append(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<InvoiceSheet invoice={invoice} />));
    const sheet = host.firstElementChild as HTMLElement;
    await Promise.all([...sheet.querySelectorAll('img')].map((image) => image.decode().catch(() => undefined)));
    // The sheet's fonts are the system's; the web-font CSS is off limits to fetch (CSP).
    const image = await toJpeg(sheet, {
      pixelRatio: 2,
      quality: 0.92,
      backgroundColor: '#ffffff',
      skipFonts: true,
      style: { boxShadow: 'none', margin: '0' },
    });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const height = (sheet.offsetHeight / sheet.offsetWidth) * 210;
    // A long invoice runs on: each page shows the next 297 mm of the same image.
    for (let top = 0; top < height - 1; top += 297) {
      if (top > 0) pdf.addPage();
      pdf.addImage(image, 'JPEG', 0, -top, 210, height);
    }
    pdf.save(`${invoice.number}.pdf`);
  } finally {
    root.unmount();
    host.remove();
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
