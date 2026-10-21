"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * What a visitor sees when a page throws: one plain sentence, a way to try
 * again, and the one place a person can always reach the studio. Shared by
 * app/error.tsx and app/booking/error.tsx.
 */
export function ErrorView({
  error,
  retry,
  title,
  message,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  title: string;
  message: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const button =
    "inline-flex min-h-12 items-center justify-center rounded-full px-6 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-forest/40";

  return (
    <section role="alert" className="bg-enzo-cream text-enzo-charcoal">
      <div className="mx-auto flex min-h-[80dvh] max-w-3xl flex-col justify-center px-6 py-32 md:px-12">
        <h1 className="max-w-[18ch] font-title text-[clamp(2.25rem,6vw,4rem)] font-medium leading-[1.04] tracking-[-0.03em] text-balance text-enzo-forest">
          {title}
        </h1>
        <p className="mt-6 max-w-[48ch] text-base leading-relaxed text-enzo-charcoal/75">{message}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className={`${button} bg-enzo-forest text-enzo-cream hover:bg-enzo-forest-light`}>
            Try again
          </button>
          <Link href="/contact" className={`${button} border border-enzo-forest/30 text-enzo-forest hover:bg-enzo-forest/5`}>
            Contact us
          </Link>
        </div>
      </div>
    </section>
  );
}
