"use client";

// Section 05 — the boilerplate's testimonial wall, in the Enzo palette.
//
// ── This is a faithful port, not a reinterpretation ──
// Three attempts at replacing it — three static cards, a transcript, a framed
// wall on forest — were all rejected, and rightly: the original works because
// the movement itself is the argument. Nine reviews drifting past reads as a
// lot of people; nine reviews ruled down a page reads as a list. So the
// geometry, the timings and the fade are the boilerplate's own, matched
// number for number:
//
//   columns          3, the second running against the other two
//   durations        15s / 19s / 17s   (never round multiples — the three
//                                       stay permanently out of phase, so the
//                                       wall never resolves into a pattern)
//   travel           y: 0% → -50% on a list rendered twice, linear, infinite
//   gaps             16px between cards, 24px between columns
//   height           capped at 740px
//   fade             transparent → 25% → 75% → transparent
//   card             white, 16px radius, 24px padding, a soft low shadow
//
// Only the colours change, and only to tokens that already existed: the
// boilerplate's #FAFAF7 / #1C4A3A / #C4B8A8 / #8A9E8C / #2C2C2C are literally
// --enzo-white / --enzo-forest / --border / --enzo-sage / --enzo-charcoal. The
// one value with no Enzo equivalent was the amber star, which becomes sand —
// the palette's own warm metallic and the nearest thing it has to gold.
//
// ── Two departures, both required rather than preferred ──
// 1. The ground is cream, not the boilerplate's near-white. §04 immediately
//    above is already #FAFAF7, and two sections sharing an exact background
//    stop being two sections. Cream is a half-step warmer and keeps the seam.
// 2. There is a pause control, and `prefers-reduced-motion` gets a static
//    grid. WCAG 2.2.2 requires a way to stop anything that moves
//    automatically for more than five seconds; the boilerplate had none. The
//    loop is a CSS keyframe rather than a JS tween precisely so that pausing
//    is one property (`animation-play-state`) and the motion itself is
//    untouched — same easing, same duration, same distance.
import { useMemo, useState } from "react";
import { Pause, Play, Star } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";
import { fill, type HomeContent, type Testimonial } from "@/lib/content";

/** The boilerplate's own three durations, in seconds. */
const COLUMN_SECONDS = [15, 19, 17];

/** Splits the published reviews into three columns, round-robin. */
function toColumns(items: Testimonial[], count = 3): Testimonial[][] {
  const columns: Testimonial[][] = Array.from({ length: count }, () => []);
  // Round-robin rather than three consecutive slices. The boilerplate sliced
  // 0-3 / 3-6 / 6-9 because it knew there were exactly nine; the client
  // authors these, and with seven reviews slicing gives 3 / 3 / 1 and a
  // visibly short third column. Dealing them out keeps the columns within one
  // card of each other at any count.
  items.forEach((item, index) => columns[index % count]!.push(item));
  return columns;
}

export function ClientVoices({
  testimonials,
  content,
}: {
  testimonials: Testimonial[];
  content: HomeContent["voices"];
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const columns = useMemo(() => toColumns(testimonials), [testimonials]);

  if (!testimonials.length) return null;

  const still = reducedMotion || paused;

  return (
    <section
      id="home-reviews"
      aria-labelledby="voices-heading"
      className="relative overflow-hidden bg-background scroll-mt-24"
    >
      <div className="shell py-20 md:py-28">
        <h2 id="voices-heading" className="sr-only">
          {content.srHeading}
        </h2>

        {/* The heading is the site's own device — the measuring rule with
            its index, label and datum, and the lede ranged to the right of
            it — the same SectionIntro every other section on this page opens
            with. The boilerplate centred a chip and a title here; that read
            as a component borrowed from somewhere else the moment it sat
            under §04's ruled heading.

            The default split needs no custom template: the wall below is
            three equal columns filling the shell, so its outer edges are the
            shell's outer edges, which is exactly where the heading starts and
            the lede ends. */}
        <SectionIntro
          layout="split"
          index={content.index}
          label={content.label}
          datum={fill(content.datum, { count: testimonials.length })}
          lines={content.lines}
          lede={content.lede}
        />

        {/* ── The wall ──
            The fade is the boilerplate's: transparent to solid across the top
            quarter and back out across the bottom quarter. That is a far wider
            and softer ramp than a tight edge fade, and it is why cards seem to
            surface and sink rather than being cut off. Dropped entirely under
            reduced motion, where nothing moves and a fade would only make the
            first and last rows harder to read. */}
        <div
          className={cn(
            "mt-12 flex justify-center gap-6 md:mt-16",
            !reducedMotion && "max-h-[740px] overflow-hidden",
          )}
          style={
            reducedMotion
              ? undefined
              : {
                  maskImage:
                    "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent, black 25%, black 75%, transparent)",
                }
          }
        >
          {columns.map((column, columnIndex) => {
            if (!column.length) return null;
            // Rendered twice and travelling exactly half its own height, so
            // the second copy arrives where the first began and the loop has
            // no seam.
            const looped = reducedMotion ? column : [...column, ...column];
            const reverse = columnIndex === 1;
            return (
              <div
                key={columnIndex}
                className={cn(
                  "min-w-0 flex-1 overflow-hidden",
                  columnIndex === 1 && "hidden md:block",
                  columnIndex === 2 && "hidden lg:block",
                )}
              >
                <div
                  className="flex flex-col gap-4"
                  style={
                    reducedMotion
                      ? undefined
                      : {
                          animation: `${
                            reverse ? "voices-scroll-reverse" : "voices-scroll"
                          } ${COLUMN_SECONDS[columnIndex % COLUMN_SECONDS.length]}s linear infinite`,
                          animationPlayState: paused ? "paused" : "running",
                        }
                  }
                >
                  {looped.map((testimonial, index) => (
                    <figure
                      key={`${testimonial.name}-${index}`}
                      // The duplicated half is decoration: a screen reader
                      // should be told about nine people, not eighteen.
                      aria-hidden={index >= column.length ? true : undefined}
                      className="rounded-2xl bg-enzo-white p-6 shadow-[0_2px_16px_rgba(16,46,45,0.05)]"
                    >
                      <div className="flex gap-1" aria-label={content.ratingLabel}>
                        {Array.from({ length: 5 }, (_, star) => (
                          <Star
                            key={star}
                            aria-hidden="true"
                            className="h-4 w-4 fill-enzo-sand text-enzo-sand"
                          />
                        ))}
                      </div>

                      <blockquote className="mt-3 text-[14px] leading-relaxed text-enzo-charcoal">
                        {testimonial.text}
                      </blockquote>

                      <figcaption className="mt-4 flex items-center gap-3">
                        <ImageWithFallback
                          src={testimonial.image}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                        <span className="min-w-0">
                          <cite className="block truncate text-[13px] font-semibold not-italic text-enzo-forest">
                            {testimonial.name}
                          </cite>
                          {/* forest-light, not the boilerplate's sage: sage on
                              a near-white card measures 2.4:1 and this is 11px
                              type. Same role in the palette, enough contrast
                              to actually be read. */}
                          <span className="block truncate text-[11px] text-enzo-forest-light">
                            {testimonial.role}
                          </span>
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {!reducedMotion && (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-pressed={paused}
              className="inline-flex items-center gap-2.5 rounded-full border border-border px-5 py-2.5 text-[12.5px] font-medium text-primary transition-colors duration-300 hover:border-primary hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {still ? (
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {still ? content.playLabel : content.pauseLabel}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
