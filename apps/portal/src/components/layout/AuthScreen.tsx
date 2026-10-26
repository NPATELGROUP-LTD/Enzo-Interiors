import type { ReactNode } from 'react';

import { LegalLinks } from './LegalLinks';

/**
 * The Enzo script mark, drawn in the current text colour.
 *
 * public/enzo-mark.png is used as a mask rather than an image, so the one file
 * reads correctly on the light and dark surfaces and on a photo, and follows
 * `color` like an icon does. apps/admin has its own copy of this file.
 */
export function EnzoMark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        aspectRatio: '480 / 243',
        WebkitMask: 'url(/enzo-mark.png) center / contain no-repeat',
        mask: 'url(/enzo-mark.png) center / contain no-repeat',
      }}
    />
  );
}

/**
 * The signed-out screens: sign in, forgot password, set a password. A form on
 * the left and the studio's photograph on the right, as in the admin.
 */
export function AuthScreen({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh bg-surface lg:grid-cols-[minmax(28rem,36rem)_1fr]">
      <main className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-3 text-green-900 dark:text-ink">
          <EnzoMark className="h-8" />
          <span className="sr-only">Enzo Interiors</span>
        </div>

        <div className="mx-auto my-auto w-full max-w-sm py-10">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
          <p className="mt-1.5 text-ink-muted">{lede}</p>
          <div className="mt-7">{children}</div>
        </div>

        <div className="text-xs text-ink-muted">
          <LegalLinks />
          <p>
            Enzo Interiors client portal. Made by{' '}
            <a
              href="https://www.npatelgroup.ltd"
              target="_blank"
              rel="noopener"
              className="font-semibold hover:text-ink hover:underline"
            >
              NPATEL GROUP LTD
            </a>
          </p>
        </div>
      </main>

      {/* Decorative, so empty alt. */}
      <aside className="relative hidden overflow-hidden bg-green-900 lg:sticky lg:top-0 lg:block lg:h-dvh">
        <img src="/login.jpeg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 max-w-xl p-10 text-white">
          <EnzoMark className="mb-5 h-10" />
          <p className="text-2xl font-semibold leading-snug tracking-tight">
            Your kitchen, wardrobe or media wall, from first sketch to final fitting.
          </p>
        </div>
      </aside>
    </div>
  );
}

/** The error line every auth form shows above its button. */
export function FormError({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-control bg-danger-bg px-3 py-2 text-danger">
      {message}
    </p>
  ) : null;
}
