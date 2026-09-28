"use client";

// Section 06 — the closing beat, merging what used to be two sections.
//
// The old page ended with a booking slab and *then* a social grid, which meant
// the last thing before the footer was a row of thumbnails rather than an ask.
// Here the recent-installs strip and the invitation are one section: the work
// drifts past overhead, the ask sits underneath it, and the ground darkens
// into the footer.
//
// Two rows now, running against each other. One row reads as a slideshow; two
// counter-moving rows read as a wall of work going past, and the opposition is
// what makes the velocity coupling legible — flick the page and both rows
// visibly pull apart, stop and they settle back to their own pace. This is
// the only place on the page where scrolling changes the *speed* of something
// rather than its position.
//
// ── Second composition: the ask sits *in* the work, not under it ──
// The first arrangement stacked them — rows, then a rule, then the ask in two
// columns underneath. Two blocks that happened to share a background, and the
// page's last word was the weaker of the two: by the time you reached the
// booking copy the photographs had scrolled off and the section read as a
// contact panel with a decorative header.
//
// The rows now run full-bleed as the section's ground, and the ask is a solid
// forest panel that breaks into them from the left and overlaps the lower row
// — the same asymmetric overlap the landing hero and §01 use, applied to the
// close. The work keeps moving behind the thing it is evidence for, which is
// the whole argument of the section in one composition: *this is what we did;
// shall we do yours.*
//
// It is one panel in one colour, divided by a rule.
//
// Two earlier attempts got this wrong in opposite directions. First a 25%
// forest-light tint on the right half — transparent over a row of moving
// photographs, so the phone number and the email were legible only while a
// dark tile happened to be passing behind them. Then a solid forest-light
// fill, which was readable and introduced a second green: the panel stopped
// reading as one object and became two blocks that had been pushed together.
//
// The answer was never the fill. The two halves are the same forest and the
// division is a hairline — which is how every other pair of columns on this
// site is separated, costs no contrast at all, and leaves the panel one
// object. Nothing here is translucent, because nothing here needs to be: the
// separation was never doing the work the transparency was asked to do.
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowUpRight, Mail, Phone } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { InstagramIcon } from "@/components/shared/icons";
import { MagneticButton } from "@/components/shared/MagneticButton";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { fromOnScroll, observeScroll, useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE } from "@/lib/motion";
import type { Company, HomeContent, PortfolioItem } from "@/lib/content";

const ROW_SECONDS = [52, 64];

interface StudioInviteProps {
  items: PortfolioItem[];
  content: HomeContent["invite"];
  /** The number, the address and the Instagram handle, stated once. */
  company: Company;
}

export function StudioInvite({ items, content, company }: StudioInviteProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const instagram = company.socials.find((social) => social.id === "instagram");

  useGSAP(sectionRef, (section, reduced) => {
    if (reduced) return;

    const tracks = gsap.utils.toArray<HTMLElement>("[data-marquee-track]", section);
    if (!tracks.length) return;

    // Each track holds its run of images twice, so travelling exactly half its
    // width lands on a frame identical to the start — the loop point is
    // invisible without measuring anything.
    const loops = tracks.map((track, index) => {
      const reverse = track.dataset.reverse === "true";
      return gsap.fromTo(
        track,
        { xPercent: reverse ? -50 : 0 },
        {
          xPercent: reverse ? 0 : -50,
          duration: ROW_SECONDS[index % ROW_SECONDS.length],
          ease: "none",
          repeat: -1,
        },
      );
    });

    let settleTimer: number | undefined;

    const trigger = observeScroll({
      trigger: section,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => {
        // Speed responds to scroll velocity, but direction never does — each
        // row always runs its own way. Letting scroll-up flip the loop's
        // timeScale negative used to visibly reverse the row, and a
        // repeat:-1 tween running backwards doesn't wrap its loop point
        // cleanly, which is what produced the blank gap and slow catch-up
        // at the end of each cycle.
        const velocity = self.getVelocity();
        const boost = gsap.utils.clamp(1, 5, 1 + Math.abs(velocity) / 700);
        loops.forEach((loop) =>
          gsap.to(loop, { timeScale: boost, duration: 0.35, overwrite: true }),
        );
        tracks.forEach((track) =>
          gsap.to(track, {
            skewX: gsap.utils.clamp(-2.5, 2.5, velocity / -1200),
            duration: 0.4,
            overwrite: "auto",
          }),
        );

        // ScrollTrigger only reports while the page is moving, so the return
        // to resting speed has to be scheduled rather than driven.
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(() => {
          loops.forEach((loop) =>
            gsap.to(loop, { timeScale: 1, duration: 1.2, overwrite: true }),
          );
          tracks.forEach((track) =>
            gsap.to(track, { skewX: 0, duration: 0.6, overwrite: "auto" }),
          );
        }, 180);
      },
    });

    // Two matches now, not one: the mobile card carries its own copy of
    // this attribute (see the render below), and only one of the two is
    // ever actually laid out at a given width — the other is `display:
    // none` behind its `hidden lg:...` class. `offsetParent` filters that
    // one straight back out; handing ScrollTrigger a trigger element with
    // no box to measure is what was throwing "Cannot read properties of
    // undefined (reading 'end')" out of its own internal recalculation.
    const contacts = gsap.utils
      .toArray<HTMLElement>("[data-invite-contact]", section)
      .filter((el) => el.offsetParent !== null);
    if (contacts.length) {
      fromOnScroll(
        contacts,
        {
          opacity: 0,
          y: 30,
          duration: DUR.enter,
          ease: EASE.enter,
        },
        { trigger: contacts[0], start: "top 88%" },
      );
    }

    return () => {
      window.clearTimeout(settleTimer);
      trigger.kill();
      loops.forEach((loop) => loop.kill());
    };
  });

  // Row A takes the first half of the work, row B the second, so the two rows
  // are never showing the same photograph side by side.
  const half = Math.ceil(items.length / 2);
  const rows = [items.slice(0, half), items.slice(half)];

  return (
    <section
      ref={sectionRef}
      id="home-studio"
      aria-labelledby="invite-heading"
      className="relative overflow-hidden bg-enzo-dark scroll-mt-24"
    >
      <div className="pt-16 md:pt-24 lg:pb-8">
        <div className="shell mb-7 flex flex-wrap items-center justify-between gap-4">
          <span className="font-display text-[10px] font-semibold uppercase tracking-[0.28em] text-enzo-sage">
            {content.recentLabel}
          </span>
          <a
            href={instagram?.href ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="group/ig inline-flex min-h-11 items-center gap-2.5 rounded-full border border-enzo-cream/20 px-4 py-2 text-[13px] text-enzo-cream/80 transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
          >
            <InstagramIcon
              size={14}
              className="transition-transform duration-300 group-hover/ig:-rotate-12"
            />
            {instagram?.handle ?? instagram?.label}
          </a>
        </div>

        {items.length ? (
        <div
          aria-hidden="true"
          className="flex flex-col gap-3 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)] md:gap-4"
        >
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              data-marquee-track
              data-reverse={rowIndex === 1}
              className="flex w-max gap-3 will-change-transform md:gap-4"
            >
              {[...row, ...row].map((item, index) => (
                <div
                  key={`${item.id}-${index}`}
                  className="group/tile relative h-[clamp(130px,17vw,215px)] w-[clamp(190px,24vw,310px)] shrink-0 overflow-hidden rounded-[14px]"
                >
                  {/* Eager, not lazy: every tile here is duplicated into an
                      infinitely-looping row, so it's destined to scroll into
                      view repeatedly regardless of the visitor's actual
                      scroll position. Lazy-loading it meant the browser only
                      started fetching once the loop's second copy neared the
                      viewport, which is exactly the gap in the marquee the
                      loop point should be — the empty tile and the long
                      stall were the fetch, not a rendering bug. */}
                  <ImageWithFallback
                    src={item.image}
                    alt=""
                    loading="eager"
                    className="h-full w-full object-cover opacity-70 transition-all duration-500 ease-out group-hover/tile:scale-[1.06] group-hover/tile:opacity-100"
                  />
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-enzo-dark/80 to-transparent opacity-0 transition-opacity duration-500 group-hover/tile:opacity-100" />
                  <span className="pointer-events-none absolute inset-x-3 bottom-3 flex translate-y-1 items-center justify-between text-[10px] uppercase tracking-[0.2em] text-enzo-cream opacity-0 transition-all duration-500 group-hover/tile:translate-y-0 group-hover/tile:opacity-100">
                    <span>{item.location}</span>
                    <span className="font-display tabular-nums">{item.year}</span>
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
        ) : null}
      </div>

      {/* The ask, lifted into the rows above it. The negative top margin is
          the overlap; it only applies from `lg`, because below that the rows
          are short and an overlapping panel would cover most of them. */}
      <div className="relative shell pb-20 pt-12 md:pb-28 lg:-mt-24 lg:pt-0 xl:-mt-32">
        <h2 id="invite-heading" className="sr-only">
          {content.srHeading}
        </h2>

        {/* ── Desktop: one forest panel, divided by a hairline ── */}
        <div className="hidden gap-0 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,360px)]">
          <div className="rounded-l-[22px] bg-enzo-forest px-12 pb-14 pt-14">
            <SectionIntro
              tone="dark"
              index={content.index}
              label={content.label}
              datum={content.datum}
              lines={content.lines}
              lede={content.lede}
            />
            <MagneticButton href={content.ctaHref} className="-ml-5 mt-6">
              {content.ctaLabel}
            </MagneticButton>
          </div>

          <div
            data-invite-contact
            className="rounded-r-[22px] border-l border-enzo-cream/15 bg-enzo-forest px-10 pb-14 pt-14"
          >
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.28em] text-enzo-sand">
              {content.contact.label}
            </p>
            <div className="mt-5 flex flex-col gap-4">
              <a
                href={company.phone.href}
                className="group/link flex items-baseline justify-between gap-4 border-b border-enzo-cream/10 pb-3 text-enzo-cream transition-colors duration-300 hover:border-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
              >
                <span className="text-[15px]">{company.phone.display}</span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-enzo-cream/70 transition-colors duration-300 group-hover/link:text-enzo-sand">
                  {content.contact.callLabel}
                </span>
              </a>
              <a
                href={company.emailHref}
                className="group/link flex items-baseline justify-between gap-4 border-b border-enzo-cream/10 pb-3 text-enzo-cream transition-colors duration-300 hover:border-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
              >
                <span className="truncate text-[15px]">{company.email}</span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-enzo-cream/70 transition-colors duration-300 group-hover/link:text-enzo-sand">
                  {content.contact.emailLabel}
                </span>
              </a>
              <p className="text-[12.5px] leading-[1.65] text-enzo-cream/70">
                {content.contact.note}
              </p>
            </div>
          </div>
        </div>

        {/* ── Mobile: sand, not forest ──
            The desktop panel repeated here would be the third same-coloured
            block in a row on a phone — this card, stacked directly on the
            marquee rows above and the footer's own forest immediately
            below. Sand breaks the run instead of extending it: one warm,
            light beat between two dark grounds, built as its own card
            rather than the desktop grid narrowed into one column. */}
        <div
          data-invite-contact
          className="rounded-[26px] bg-enzo-sand px-6 pb-7 pt-8 sm:px-8 lg:hidden"
        >
          <SectionIntro
            index={content.index}
            label={content.label}
            datum={content.datum}
            lines={content.lines}
            lede={content.ledeShort}
          />

          <Link
            href={content.ctaHref}
            className="mt-6 flex items-center justify-between gap-3 rounded-full bg-enzo-forest py-2 pl-6 pr-2 text-[14.5px] font-semibold text-enzo-cream transition-transform duration-300 active:scale-[0.98]"
          >
            {content.ctaLabel}
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-enzo-cream text-enzo-forest">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>

          <div className="mt-6 border-t border-enzo-forest/15 pt-6">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.24em] text-enzo-forest/55">
              {content.contact.label}
            </p>
            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <a
                href={company.phone.href}
                className="flex items-center gap-2.5 rounded-2xl bg-enzo-forest/8 py-3.5 pl-4 pr-2 text-enzo-forest transition-colors duration-300 active:bg-enzo-forest/15"
              >
                <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="text-[13.5px] font-semibold">{content.contact.callLabel}</span>
              </a>
              <a
                href={company.emailHref}
                className="flex items-center gap-2.5 rounded-2xl bg-enzo-forest/8 py-3.5 pl-4 pr-2 text-enzo-forest transition-colors duration-300 active:bg-enzo-forest/15"
              >
                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="text-[13.5px] font-semibold">{content.contact.emailLabel}</span>
              </a>
            </div>
            <p className="mt-4 text-[12.5px] leading-[1.6] text-enzo-forest/70">
              {content.contact.noteMobile}
            </p>
          </div>
        </div>
      </div>

      {/* Seam into the footer's darker ground. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-enzo-footer-dark"
      />
    </section>
  );
}
