import { useEffect, useRef, useState } from 'react';

import { documentPdf } from '@/lib/api';

/**
 * A PDF drawn page by page onto canvases, for browsers that cannot show one in a frame (phones). pdf.js is
 * loaded only when this opens. Canvases carry no save or print toolbar, which is what view-only needs.
 */
export function PdfPages({ id }: { id: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [pdfjs, worker, data] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
          documentPdf(id),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const pdf = await pdfjs.getDocument({ data }).promise;
        const width = host.current?.clientWidth ?? 320;
        for (let number = 1; number <= Math.min(pdf.numPages, 50); number += 1) {
          const page = await pdf.getPage(number);
          if (cancelled || !host.current) return;
          const base = page.getViewport({ scale: 1 });
          const ratio = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText = 'width:100%;height:auto;background:#fff;margin-bottom:8px;border-radius:6px';
          host.current.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        }
        if (!cancelled) setState('ready');
      } catch {
        if (!cancelled) setState('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      {state === 'loading' ? <p className="py-6 text-center text-sm text-ink-muted">Opening the PDF…</p> : null}
      {state === 'failed' ? <p className="text-ink">Could not open this PDF. Try again, or ask the studio to send it another way.</p> : null}
      <div ref={host} className="max-h-[70dvh] overflow-y-auto" />
    </>
  );
}
