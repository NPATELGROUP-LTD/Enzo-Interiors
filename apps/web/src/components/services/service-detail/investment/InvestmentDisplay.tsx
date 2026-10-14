"use client";

// Investment — layout 3 of 4: THE DISPLAY.  (Media Walls)
//
// The thing being priced is a screen, so the price is shown on one: the
// specifications are inputs down the left, like sources, and the one you
// select is shown large in a dark frame with its range counting up inside
// it. Choosing costs one click and the frame re-prices in place, so the
// comparison happens on a single surface rather than across three cards.
//
// ── Second pass: the holes ──
// The first version of this laid out correctly and *measured* badly. Three
// separate problems, all the same problem:
//
//   1. The room-size switch floated alone on a full-width row above the
//      whole thing, so the section opened with a control, a wide band of
//      empty warm grey, and only then the content it controls.
//   2. The two columns were independent boxes of unrelated height. The left
//      one ran out after three specification rows and a footnote; the right
//      one was locked to a 16:9 aspect ratio. On a wide screen that left a
//      ~200px pocket of dead ground under the left column, which is the gap
//      in the screenshot.
//   3. Inside the frame, an aspect-ratio box with `justify-between` and only
//      three things in it pushed a hole through the middle: the figure sat
//      at the top, the feature strip at the bottom, and half the screen was
//      an empty black rectangle.
//
// All three are fixed the same way — by making the section one object
// instead of a stack of independent ones. Both controls live in the left
// rail so it has real content to fill its height; the two columns stretch to
// a shared height (`items-stretch`) so neither can end above the other; and
// the frame drops its aspect ratio for a flex column whose middle band —
// what actually moves the figure — grows to take up whatever height the
// rail sets. Nothing is centred into a void any more, because there is no
// void to centre into.
//
// ── The middle band is content, not packing ──
// "What moves this figure" earns its place: it is the honest answer to the
// question a range provokes, and it is the one thing that stops an indicative
// number reading as a quotation. It is also fixed domain copy, not invented
// per-service data — see WHAT_MOVES_IT.
//
// Ground: warm grey, with the frame itself near-black — the only place on a
// service page where a panel goes darker than its section.
import { useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { estimateQuote, type RoomSize } from "@/lib/quote-estimate";
import { cn } from "@/lib/utils";
import {
  fill,
  type InvestmentVariantContent,
  type PricingTier,
  type ServiceDetailContent,
  type SharedContent,
} from "@/lib/content";
import { QuoteTriggerButton } from "../../shared/QuoteRequestModal";
import { RoomSizeControl } from "./RoomSizeControl";
import { RollingFigure } from "./RollingFigure";
import { GBP } from "@/lib/service-metrics";

// "What moves the figure" is copy about the trade rather than per-service
// data — the client authors tiers and features, and would not author this —
// but it is still copy, so it lives with the rest of this layout's words in
// src/data/pages/service-detail.json. A range with nothing explaining its
// width is a range nobody trusts.

export function InvestmentDisplay({
  category,
  pricing,
  id,
  content,
  common,
  roomSizeContent,
}: {
  category: string;
  pricing: PricingTier[];
  id: string;
  content: InvestmentVariantContent;
  common: ServiceDetailContent["investment"];
  roomSizeContent: SharedContent["roomSize"];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [roomSize, setRoomSize] = useState<RoomSize>("medium");
  const {
    specificationLabel = "",
    frameHeader = "",
    roomLabel = "",
    movesLabel = "",
    moves = [],
  } = content;
  // Middle specification by position — a rule rather than a hardcoded index,
  // so it still points at something sensible with two tiers or five.
  const [selected, setSelected] = useState(() =>
    Math.floor((pricing.length - 1) / 2),
  );

  const tier = pricing[selected] ?? pricing[0];

  useGSAP(sectionRef, (section, reduced) => {
    const frame = section.querySelector<HTMLElement>("[data-display-frame]");
    const inputs = gsap.utils.toArray<HTMLElement>("[data-display-input]", section);

    if (reduced) {
      if (frame) gsap.set(frame, { clipPath: "inset(0% 0% 0% 0%)" });
      gsap.set(inputs, { opacity: 1, x: 0 });
      return;
    }

    revealOnScroll(
      section,
      (timeline) => {
        // The frame comes on the way the hero's aperture does — a slit that
        // opens — so the two sections on this page that show a screen agree
        // about what a screen does.
        timeline
          .fromTo(
            frame,
            { clipPath: "inset(50% 0% 50% 0%)" },
            { clipPath: "inset(0% 0% 0% 0%)", duration: 0.85, ease: EASE.editorial },
          )
          .from(
            inputs,
            { opacity: 0, x: -18, duration: 0.55, ease: EASE.enter, stagger: 0.06 },
            0.2,
          );
      },
      { start: REVEAL_START },
    );
  });

  if (!pricing.length || !tier) return null;

  const estimate = estimateQuote({
    category,
    tier: tier.tier,
    basePriceLabel: tier.from,
    roomSize,
  });
  const estimateLabel = estimate
    ? `${GBP.format(estimate.low)} – ${GBP.format(estimate.high)}`
    : undefined;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="investment-heading"
      className="relative overflow-hidden bg-muted scroll-mt-24"
    >
      <div className="shell py-20 md:py-28">
        <h2 id="investment-heading" className="sr-only">
          {common.srHeading}
        </h2>

        <SectionIntro
          layout="split"
          index={common.index}
          label={content.label}
          datum={fill(content.datum, { count: pricing.length })}
          lines={content.lines}
          lede={content.lede}
        />

        {/* `items-stretch` is the fix for the dead pocket: the rail and the
            frame are two cells of one row, so whichever is taller sets the
            height and the other fills it. Neither can end early any more. */}
        <div className="mt-12 grid items-stretch gap-8 md:mt-14 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-10">
          {/* ── The rail: both controls, one column ── */}
          <div className="flex flex-col">
            <div className="border-t border-border/70 pt-6">
              <RoomSizeControl
                value={roomSize}
                onChange={setRoomSize}
                content={roomSizeContent}
              />
            </div>

            <div
              role="radiogroup"
              aria-label={specificationLabel}
              className="mt-8 flex flex-1 flex-col"
            >
              <span className="font-display block text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-forest-light">
                {specificationLabel}
              </span>

              {/* flex-1 on the list and on each row: three tiers spread to
                  fill the rail's height instead of clustering at the top
                  with the footnote stranded halfway down. */}
              <div className="mt-4 flex flex-1 flex-col border-t border-border/70">
                {pricing.map((entry, index) => {
                  const on = index === selected;
                  return (
                    <button
                      key={entry.tier}
                      data-display-input
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSelected(index)}
                      className={cn(
                        "flex flex-1 items-center gap-4 border-b border-border/70 px-3 py-5 text-left transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                        on ? "bg-background" : "hover:bg-background/60",
                      )}
                    >
                      {/* The input's own lamp — lit when it is the one on
                          screen, which is the whole state of this control. */}
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full transition-colors duration-300"
                        style={{
                          backgroundColor: on
                            ? "var(--enzo-forest)"
                            : "color-mix(in srgb, var(--foreground) 20%, transparent)",
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block font-title text-[1.05rem] font-semibold tracking-[-0.02em] transition-colors duration-300",
                            on ? "text-primary" : "text-foreground/70",
                          )}
                        >
                          {entry.tier}
                        </span>
                        <span className="mt-1 block text-[12px] text-muted-foreground">
                          {fill(common.fromLabel, { price: entry.from })}
                        </span>
                      </span>
                      <span
                        className="font-display shrink-0 text-[10px] font-semibold tabular-nums tracking-[0.18em] transition-colors duration-300"
                        style={{
                          color: on
                            ? "var(--enzo-forest-light)"
                            : "color-mix(in srgb, var(--foreground) 30%, transparent)",
                        }}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-6 max-w-[38ch] text-[12.5px] leading-[1.7] text-muted-foreground">
                {content.footnote}
              </p>
            </div>
          </div>

          {/* ── The frame ──
              A flex column, not an aspect-ratio box. Header, figure, the
              band that grows, then the actions on the base rule. */}
          <div
            data-display-frame
            className="relative flex min-h-[30rem] flex-col overflow-hidden rounded-[18px] bg-enzo-dark p-6 text-enzo-cream sm:p-8 md:p-10"
            style={{ clipPath: "inset(50% 0% 50% 0%)" }}
          >
            {/* Scanline wash. Very low contrast — it is the difference
                between a dark box and a screen, and any more than this is a
                costume. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, rgba(242,240,235,0.05) 0 1px, transparent 1px 4px)",
              }}
            />

            <div className="relative flex items-start justify-between gap-6">
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.26em] text-enzo-sand">
                {fill(frameHeader, {
                  index: String(selected + 1).padStart(2, "0"),
                  tier: tier.tier,
                })}
              </span>
              <span className="font-display text-[10px] font-semibold uppercase tracking-[0.24em] text-enzo-cream/65">
                {fill(roomLabel, { size: roomSizeContent.sizes[roomSize] })}
              </span>
            </div>

            <div className="relative mt-8">
              <p
                className="font-title font-semibold leading-[1.02] tabular-nums tracking-[-0.045em]"
                style={{ fontSize: "clamp(2rem, 4.6vw, 3.5rem)" }}
              >
                {estimate ? (
                  <>
                    <RollingFigure value={estimate.low} />
                    <span className="px-2 font-normal text-enzo-cream/65">–</span>
                    <RollingFigure value={estimate.high} />
                  </>
                ) : (
                  common.onApplication
                )}
              </p>
              <p className="mt-3 max-w-[46ch] text-[14px] leading-[1.6] text-enzo-cream/70">
                {tier.desc}
              </p>
            </div>

            {/* The band that takes up the slack. Three reasons a range is a
                range — which is what a visitor is silently asking the moment
                they see two numbers with a dash between them. */}
            <div className="relative mt-9 flex-1 border-t border-enzo-cream/12 pt-6">
              <span className="font-display block text-[10px] font-semibold uppercase tracking-[0.24em] text-enzo-cream/55">
                {movesLabel}
              </span>
              <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-3">
                {moves.map((reason) => (
                  <div key={reason.label}>
                    <dt className="flex items-baseline gap-2 text-[13px] font-medium text-enzo-cream">
                      <span aria-hidden="true" className="h-px w-3 shrink-0 bg-enzo-sand" />
                      {reason.label}
                    </dt>
                    <dd className="mt-1.5 pl-5 text-[12.5px] leading-[1.55] text-enzo-cream/60">
                      {reason.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="relative mt-8 border-t border-enzo-cream/12 pt-6">
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="text-[12.5px] text-enzo-cream/75"
                  >
                    {feature}
                  </li>
                ))}
              </ul>

              <QuoteTriggerButton
                quoteInfo={{ tier: tier.tier, estimateLabel }}
                className="mt-6 w-full rounded-full bg-enzo-cream py-3.5 text-[14px] font-medium text-enzo-forest transition-colors duration-300 hover:bg-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark sm:w-auto sm:px-10"
              >
                {common.quoteLabel}
              </QuoteTriggerButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
