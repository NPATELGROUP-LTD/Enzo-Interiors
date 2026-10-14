"use client";

// §C1 — the masthead, and the three ways in.
//
// ── What this replaces ──
// A breadcrumb, the words "Get In Touch" at 4rem, and then a map beside a
// form. Every part of that was borrowed: the heading said nothing the nav
// had not already said, and the page made you scroll before it told you a
// single useful thing.
//
// This opens on the decision the visitor actually has to make — which of
// three ways in suits them — and answers the question they are really
// asking before they pick one: *when will somebody get back to me*. So each
// route carries a real datum rather than an icon in a circle: the form
// answers same working day, the phone says whether it is being answered
// right now, the email is just the address, written out.
//
// The open/closed line is live (see lib/studio-hours), which is why this is
// a Client Component: a clock read during render would be one answer on the
// server and another in the browser. It renders the place until it mounts,
// then the status — never a wrong answer, and never a hydration mismatch.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import { getStudioStatus, type StudioStatus } from "@/lib/studio-hours";
import { OpeningHoursList } from "@/components/shared/OpeningHoursList";
import { cn } from "@/lib/utils";
import type { Company, ContactPageContent, ContactRouteContent } from "@/lib/content";

/** A route with its value and href resolved, whichever way they were authored. */
interface ContactRoute {
  /** Sheet-style index — "01", "02", "03". */
  index: string;
  label: string;
  /** The thing itself: a number, an address, a call to fill the docket. */
  value: string;
  /** What it costs the visitor, in time. */
  datum: string;
  href: string;
  /** Internal anchors route through next/link; tel:/mailto: do not. */
  external?: boolean;
}

export function ContactMasthead({
  content,
  company,
}: {
  content: ContactPageContent["masthead"];
  company: Company;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const hours = company.hours;

  // After mount, and then on the hour-boundary rhythm — a visitor who
  // leaves the page open through 17:00 should not be told for the rest of
  // the evening that the workshop is open.
  useEffect(() => {
    const tick = () => setStatus(getStudioStatus(hours));
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [hours]);

  // Two of the three routes name a field of the company record rather than
  // repeating the number or the address in this page's copy.
  const sources: Record<string, { value: string; href: string }> = {
    phone: { value: company.phone.display, href: company.phone.href },
    email: { value: company.email, href: company.emailHref },
  };
  const authored: ContactRouteContent[] = content.routes;
  const routes: ContactRoute[] = authored.map((route) => ({
    index: route.index,
    label: route.label,
    datum: route.datum,
    value: route.value ?? (route.valueSource ? sources[route.valueSource]?.value : "") ?? "",
    href: route.href ?? (route.hrefSource ? sources[route.hrefSource]?.href : "") ?? "",
    external: route.external,
  }));

  useGSAP(sectionRef, (section, reduced) => {
    const meta = gsap.utils.toArray<HTMLElement>("[data-meta]", section);
    const lines = gsap.utils.toArray<HTMLElement>("[data-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-body]", section);
    const rule = section.querySelector<HTMLElement>("[data-rule]");

    if (reduced) {
      gsap.set([...meta, ...body], { opacity: 1, y: 0 });
      gsap.set(lines, { opacity: 1, yPercent: 0, y: 0 });
      if (rule) gsap.set(rule, { scaleX: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ delay: 0.12 });

    tl.to(meta, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.05 })
      .to(rule, { scaleX: 1, duration: 0.9, ease: EASE.editorial }, 0.05)
      .to(
        lines,
        { yPercent: 0, opacity: 1, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.085 },
        0.1,
      )
      .to(body, { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.07 }, 0.5);

    return () => {
      tl.kill();
    };
  });

  return (
    <section
      ref={sectionRef}
      id="contact-masthead"
      aria-labelledby="contact-heading"
      className="relative overflow-hidden bg-background text-primary scroll-mt-24"
    >
      <div className="shell pb-16 pt-[7.5rem] md:pb-20 md:pt-[9rem]">
        {/* The sheet rule, carrying the live status where a service page
            carries its category. */}
        <div className="flex items-center gap-3 sm:gap-4">
          <span
            data-meta
            className="font-display shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-forest-light opacity-0"
            style={{ transform: "translateY(8px)" }}
          >
            {content.index}
          </span>
          <span
            data-meta
            className="font-display shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.3em] text-primary/80 opacity-0"
            style={{ transform: "translateY(8px)" }}
          >
            {content.label}
          </span>

          <span aria-hidden="true" className="relative h-px flex-1 overflow-hidden">
            <span
              data-rule
              className="absolute inset-0 block origin-left bg-primary/25"
              style={{ transform: "scaleX(0)" }}
            />
          </span>

          <span
            data-meta
            className="flex shrink-0 items-center gap-2 text-[11px] tabular-nums text-foreground/80 opacity-0"
            style={{ transform: "translateY(8px)" }}
          >
            {status && (
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  status.open ? "bg-enzo-forest-light" : "bg-foreground/25",
                )}
              />
            )}
            {status ? status.label : company.region}
          </span>
        </div>

        {/* Masthead, alternating sides — the same two-line device the
            service heroes use, so the pages read as one publication. */}
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-end lg:gap-14">
          <h1
            id="contact-heading"
            className="font-title font-semibold leading-[0.86] tracking-[-0.06em]"
            style={{ fontSize: "clamp(2.9rem, 9vw, 7.5rem)" }}
          >
            {content.title.map((line, i) => (
              <span
                key={line}
                className={cn(
                  "block overflow-hidden pb-[0.08em] -mb-[0.08em]",
                  i % 2 === 1 && "text-right",
                )}
              >
                <span
                  data-line
                  className="block opacity-0"
                  style={{ transform: "translateY(100%)" }}
                >
                  {line}
                </span>
              </span>
            ))}
          </h1>

          <p
            data-body
            className="max-w-[42ch] text-[15px] leading-[1.7] text-muted-foreground opacity-0 lg:pb-3 lg:text-right"
            style={{ transform: "translateY(14px)" }}
          >
            {content.lede}
          </p>
        </div>

        {/* ── Three ways in ──
            One ruled row per route on a phone, three columns from `md`.
            Every cell is the whole target, so the tap area is the plate
            rather than the four words inside it. */}
        <ul
          data-body
          className="mt-12 grid gap-px overflow-hidden border-t border-border/70 opacity-0 md:mt-16 md:grid-cols-3"
          style={{ transform: "translateY(14px)" }}
        >
          {routes.map((route) => {
            // ── The hover ──
            // A background wash was the first attempt and it was the wrong
            // instrument: `hover:bg-card` is cream on cream, too faint to
            // read as feedback and just muddy enough to look like a
            // rendering fault, and it fought the cell rules either side of
            // it. This uses the language the rest of the page already
            // speaks — a rule that draws itself. The hairline over the cell
            // fills forest from the left, the value takes the same colour,
            // and the arrow steps right. Nothing moves the type, so no line
            // reflows under the cursor.
            const inner = (
              <>
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100"
                />

                <span className="flex items-baseline gap-3">
                  <span className="font-display text-[10px] font-semibold tabular-nums tracking-[0.2em] text-enzo-forest-light">
                    {route.index}
                  </span>
                  <span className="font-display text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    {route.label}
                  </span>
                </span>

                <span className="mt-4 flex items-baseline gap-2">
                  <span className="font-title text-[1.25rem] font-semibold leading-[1.2] tracking-[-0.03em] text-primary transition-colors duration-300 group-hover:text-enzo-forest-light sm:text-[1.4rem]">
                    {route.value}
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-[1rem] leading-none text-enzo-sage transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-1.5 group-focus-visible:translate-x-1.5"
                  >
                    →
                  </span>
                </span>

                <span className="mt-2 block text-[12.5px] text-muted-foreground">
                  {route.datum}
                </span>
              </>
            );

            const className =
              "group relative block h-full border-b border-border/70 pt-6 pb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:border-b-0 md:px-6 md:first:pl-0 md:last:pr-0";

            return (
              <li key={route.index} className="relative">
                {route.external ? (
                  <a href={route.href} className={className}>
                    {inner}
                  </a>
                ) : (
                  <Link href={route.href} className={className}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        {/* The whole week, with each day's own note, under the routes. */}
        <div data-body className="mt-12 max-w-xl opacity-0" style={{ transform: "translateY(14px)" }}>
          <OpeningHoursList label={content.hoursLabel ?? "Opening hours"} rows={hours.rows} note={hours.note} />
        </div>
      </div>
    </section>
  );
}
