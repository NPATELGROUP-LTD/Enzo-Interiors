import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';

import { cn } from '../lib/utils';
import { Dialog, DialogContent, DialogTitle } from './dialog';

export interface GalleryImage {
  id: string;
  src: string;
  alt: string;
  caption?: React.ReactNode;
}

export interface GalleryProps {
  images: GalleryImage[];
  /** Column count at the widest breakpoint. */
  columns?: number;
  className?: string;
}

/**
 * Masonry image grid with a click-to-open lightbox.
 *
 * Used by: apps/web (Portfolio gallery), apps/portal (project before/after
 * images).
 * Variants: `columns` (responsive — collapses to fewer columns at narrower
 * widths automatically).
 * A11y: every image requires real `alt` text (required field on
 * `GalleryImage`, not optional) — this is a portfolio of real project
 * photography, not decorative.
 * Brief v6 deviations: none — new composition. Uses `react-responsive-
 * masonry` (a `Boilerplate`-branch dependency) rather than a custom CSS
 * grid, since true masonry (variable-height tiles) isn't expressible in
 * pure CSS grid without JS measurement.
 */
function Gallery({ images, columns = 3, className }: GalleryProps) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  return (
    <div data-slot="gallery" className={className}>
      <ResponsiveMasonry columnsCountBreakPoints={{ 350: 1, 750: 2, 1024: columns }}>
        <Masonry gutter="12px">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setOpenIndex(index)}
              className="block w-full overflow-hidden rounded-xl outline-none transition-opacity duration-[160ms] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <img src={image.src} alt={image.alt} className="w-full" />
            </button>
          ))}
        </Masonry>
      </ResponsiveMasonry>

      <Lightbox images={images} index={openIndex} onClose={() => setOpenIndex(null)} onNavigate={setOpenIndex} />
    </div>
  );
}

export interface LightboxProps {
  images: GalleryImage[];
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

/**
 * Modal image viewer with prev/next keyboard navigation — used internally
 * by `Gallery`, exported separately in case a single-image preview (not a
 * full grid) needs the same viewer.
 */
function Lightbox({ images, index, onClose, onNavigate }: LightboxProps) {
  const open = index !== null;
  const image = index !== null ? images[index] : null;

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && index !== null && index > 0) onNavigate(index - 1);
      if (e.key === 'ArrowRight' && index !== null && index < images.length - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, index, images.length, onNavigate]);

  if (!image || index === null) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl gap-2 p-2">
        <DialogTitle className="sr-only">{image.alt}</DialogTitle>
        <div className="relative">
          <img src={image.src} alt={image.alt} className="max-h-[70vh] w-full rounded-lg object-contain" />
          {index > 0 ? (
            <button
              type="button"
              onClick={() => onNavigate(index - 1)}
              aria-label="Previous image"
              className={cn(
                'absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 outline-none transition-opacity duration-[160ms] hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              )}
            >
              <ChevronLeft className="size-5" />
            </button>
          ) : null}
          {index < images.length - 1 ? (
            <button
              type="button"
              onClick={() => onNavigate(index + 1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 outline-none transition-opacity duration-[160ms] hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ChevronRight className="size-5" />
            </button>
          ) : null}
        </div>
        {image.caption ? <p className="px-2 pb-1 text-[13px] text-muted-foreground">{image.caption}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

export { Gallery, Lightbox };
