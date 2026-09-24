"use client";

// The 404, split out from app/not-found.tsx so the copy can be fetched.
//
// `router.back()` needs the client; the words and links do not. The route
// file is a Server Component that reads them from the CMS and hands them
// here, the arrangement every other page on this site uses.
//
// Set over the first frame of the hero's kitchen: the same room as the home
// page, before anything is built in it. "This room doesn't exist — yet."

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, MoveLeft, Phone } from "lucide-react";
import type { SiteContent } from "@/lib/content";

export interface NotFoundLink {
  label: string;
  href: string;
  tagline: string;
}

export function NotFoundView({
  content,
  background,
  links,
  phone,
}: {
  content: SiteContent["notFound"];
  background: string;
  links: NotFoundLink[];
  phone: { display: string; href: string };
}) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const rise = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <main className="relative isolate flex min-h-dvh items-end overflow-hidden bg-enzo-forest text-enzo-cream md:items-center">
      {/* The empty room. Decorative: the heading says what it means. */}
      {background ? (
        // eslint-disable-next-line @next/next/no-img-element -- one full-bleed backdrop from storage
        <img
          src={background}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-45"
        />
      ) : null}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-enzo-forest via-enzo-forest/85 to-enzo-forest/40 md:bg-gradient-to-r md:from-enzo-forest md:via-enzo-forest/80 md:to-transparent"
      />

      <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-28 md:px-12 md:py-24">
        <motion.p
          {...rise(0)}
          className="font-display text-[clamp(5rem,16vw,11rem)] font-semibold leading-none tracking-tight text-enzo-sand/35 tabular-nums"
          aria-hidden
        >
          {content.figure}
        </motion.p>

        <motion.p {...rise(0.08)} className="mt-6 text-[12px] font-medium uppercase tracking-[0.22em] text-enzo-sage">
          {content.eyebrow}
        </motion.p>
        <motion.h1
          {...rise(0.14)}
          className="mt-3 max-w-2xl font-title text-[clamp(2rem,5vw,3.5rem)] font-semibold leading-[1.05] tracking-tight"
        >
          {content.heading}
        </motion.h1>
        <motion.p {...rise(0.2)} className="mt-5 max-w-xl text-[16px] leading-relaxed text-enzo-cream/75">
          {content.body}
        </motion.p>

        <motion.div {...rise(0.26)} className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-enzo-cream px-6 py-3 text-[14px] font-medium text-enzo-forest transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-forest"
          >
            {content.homeLabel}
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full border border-enzo-cream/30 px-6 py-3 text-[14px] transition-colors hover:border-enzo-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand"
          >
            <MoveLeft size={16} aria-hidden /> {content.backLabel}
          </button>
          <a
            href={phone.href}
            className="inline-flex items-center gap-2 px-2 py-3 text-[14px] text-enzo-cream/80 underline-offset-4 hover:text-enzo-cream hover:underline"
          >
            <Phone size={15} aria-hidden /> {phone.display}
          </a>
        </motion.div>

        {links.length ? (
          <motion.nav
            {...rise(0.32)}
            aria-label={content.linksLabel}
            className="mt-14 grid max-w-3xl gap-px overflow-hidden rounded-2xl border border-enzo-cream/15 bg-enzo-cream/15 sm:grid-cols-3"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex flex-col gap-1 bg-enzo-forest/90 px-5 py-4 transition-colors hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-enzo-sand"
              >
                <span className="flex items-center justify-between text-[15px] font-medium">
                  {link.label}
                  <ArrowRight
                    size={15}
                    aria-hidden
                    className="text-enzo-sage transition-transform group-hover:translate-x-0.5"
                  />
                </span>
                <span className="text-[13px] leading-snug text-enzo-cream/60">{link.tagline}</span>
              </Link>
            ))}
          </motion.nav>
        ) : null}

        <p className="mt-12 text-[12px] uppercase tracking-[0.22em] text-enzo-cream/40">{content.wordmark}</p>
      </div>
    </main>
  );
}
