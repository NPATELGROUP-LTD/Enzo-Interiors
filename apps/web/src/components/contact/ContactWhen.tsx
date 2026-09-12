"use client";

// §C3 — if you wrote today, when would you have the room?
//
// ── What this replaces, and why ──
// Two versions have failed here, and both failed the same way: they answered
// a question the page had already answered.
//
// First, a grid of towns with drive times. The footer carries the territory
// on every page and the masthead says Leicester and Leicestershire, so it was
// the third statement of one fact. Then, the ninety minutes of the survey
// broken into four proportional phases — better content, wrong section: what
// happens *during* a visit belongs on a page about the work, and by the time
// somebody has scrolled to C3 they have already decided whether to write. It
// was reassurance offered to a person who was no longer asking for it.
//
// The question actually left unanswered at the bottom of a contact page is
// the one nobody types into the form: *if I send this now, when do I get my
// room?* Everything else on this site is about how well the work is done.
// This is the only place that says when.
//
// ── The figures are read off the services, not written ──
// Each bar's length is the service's own authored lead time, parsed by
// getServiceMetrics — the same field the /services comparison matrix uses. So
// the chart cannot drift from the rest of the site: change a lead time in the
// Content Manager and this moves with it, and a service published without a
// parseable timeline is listed with its text rather than being given an
// invented bar. Nothing here is a promise we made up to fill a chart.
//
// ── The layout is the data ──
// One shared week axis, one row per discipline, and every bar starts at the
// same zero — so the comparison is immediate and honest: the longest bar is
// the longest job, at a glance, with no numbers to read first. The two fixed
// stages before the build (survey, then drawings and sign-off) are drawn as a
// lighter leader on the front of every bar, because they are the same for
// everyone and they are the part people do not know is there.
//
// Below `md` the axis is dropped and each row becomes a ruled line with its
// figure at the end — a bar chart at 375px is four stubs.
//
// Ground: forest. The one full-strength colour on the page, and this section
// can carry it: short labels, big numbers, nothing to type into.
import { useRef } from "react";
import gsap from "gsap";
import { revealOnScroll, useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import { fill, type ContactPageContent } from "@/lib/content";

export interface LeadTime {
  /** Discipline name, e.g. "Kitchens". */
  label: string;
  /** The authored lead-time string, e.g. "4-6 weeks". */
  timeline: string;
  /** Upper bound in weeks, parsed from `timeline`. Null when unparseable. */
  weeks: number | null;
}

/** Weeks before anything is built: the survey, then drawings and sign-off. */
const SURVEY_WEEKS = 0.4;
const DESIGN_WEEKS = 1;
const LEADER = SURVEY_WEEKS + DESIGN_WEEKS;

export function ContactWhen({
  leadTimes,
  content,
}: {
  leadTimes: LeadTime[];
  content: ContactPageContent["when"];
}) {
  const sectionRef = useRef<HTMLElement>(null);

  const measured = leadTimes.filter((entry) => entry.weeks !== null);
  // The axis runs to the longest job plus its leader, rounded up to a whole
  // week so the gridlines land on integers.
  const span = Math.max(
    4,
    Math.ceil(Math.max(...measured.map((entry) => entry.weeks ?? 0), 0) + LEADER),
  );
  const ticks = Array.from({ length: span + 1 }, (_, week) => week).filter(
    // A gridline every week is noise past about eight; every other one keeps
    // the axis readable at any span.
    (week) => (span > 8 ? week % 2 === 0 : true),
  );

  useGSAP(sectionRef, (section, reduced) => {
    const lead = gsap.utils.toArray<HTMLElement>("[data-lead]", section);
    const bars = gsap.utils.toArray<HTMLElement>("[data-bar]", section);
    const rows = gsap.utils.toArray<HTMLElement>("[data-row]", section);
    const axis = gsap.utils.toArray<HTMLElement>("[data-axis]", section);
    if (!rows.length) return;

    if (reduced) {
      gsap.set([...lead, ...rows], { opacity: 1, y: 0 });
      gsap.set([...bars, ...axis], { scaleX: 1, opacity: 1 });
      return;
    }

    revealOnScroll(
      section,
      (timeline) => {
        timeline
          .from(lead, { opacity: 0, y: 20, duration: 0.7, ease: EASE.enter, stagger: 0.08 })
          .from(axis, { opacity: 0, duration: 0.6, ease: EASE.enter, stagger: 0.03 }, 0.15)
          .from(rows, { opacity: 0, y: 16, duration: 0.5, ease: EASE.enter, stagger: 0.08 }, 0.2)
          // The bars run out left to right, which is the direction time
          // travels on the axis they are sitting on.
          .from(
            bars,
            {
              scaleX: 0,
              transformOrigin: "0% 50%",
              duration: 0.9,
              ease: EASE.editorial,
              stagger: 0.09,
            },
            0.3,
          );
      },
      { start: REVEAL_START },
    );
  });

  if (!leadTimes.length) return null;

  return (
    <section
      ref={sectionRef}
      id={content.id}
      aria-labelledby="when-heading"
      className="relative bg-enzo-forest scroll-mt-24"
    >
      <div className="shell py-20 md:py-28">
        <div className="grid gap-5 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-end lg:gap-16">
          <div>
            <span
              data-lead
              className="font-display flex items-baseline gap-3 text-[10.5px] font-semibold uppercase tracking-[0.28em] text-enzo-sand"
            >
              <span>{content.index}</span>
              <span className="text-enzo-cream/70">{content.label}</span>
            </span>

            <h2
              id="when-heading"
              data-lead
              className="mt-5 max-w-[16ch] font-title font-semibold leading-[1.02] tracking-[-0.04em] text-enzo-cream sm:mt-6"
              style={{ fontSize: "clamp(2rem, 4.6vw, 3.4rem)" }}
            >
              {content.heading}
            </h2>
          </div>

          <p
            data-lead
            className="text-[14.5px] leading-[1.7] text-enzo-cream/65 sm:text-[15px] lg:pb-2"
          >
            {content.lede}
          </p>
        </div>

        {/* ── The chart ── */}
        <div className="mt-12 md:mt-16">
          {/* The week axis. Desktop only — see the note at the top. */}
          <div className="relative hidden md:block" aria-hidden="true">
            <div className="ml-[13rem] flex justify-between border-b border-enzo-cream/15 pb-2">
              {ticks.map((week) => (
                <span
                  key={week}
                  data-axis
                  className="font-display text-[10px] font-semibold tabular-nums tracking-[0.14em] text-enzo-cream/45"
                >
                  {week === 0 ? content.axisStart : fill(content.axisWeek, { week })}
                </span>
              ))}
            </div>
          </div>

          <ol className="md:mt-1">
            {leadTimes.map((entry) => {
              const total = entry.weeks === null ? null : entry.weeks + LEADER;
              const pct = total === null ? 0 : (total / span) * 100;
              const leaderPct = total === null ? 0 : (LEADER / total) * 100;
              return (
                <li
                  key={entry.label}
                  data-row
                  className="flex flex-col gap-2 border-b border-enzo-cream/12 py-5 first:border-t md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:items-center md:gap-0 md:border-t-0 md:py-4 md:first:border-t-0"
                >
                  <div className="flex items-baseline justify-between gap-4 md:block">
                    <span className="text-[15px] leading-tight text-enzo-cream md:text-[14.5px]">
                      {entry.label}
                    </span>
                    <span className="font-display shrink-0 text-[11px] tabular-nums tracking-[0.1em] text-enzo-sand md:hidden">
                      {entry.timeline}
                    </span>
                  </div>

                  {total === null ? (
                    // No parseable lead time: say so in words rather than
                    // drawing a bar we cannot stand behind.
                    <span className="text-[13px] text-enzo-cream/60 md:pl-1">
                      {entry.timeline}
                    </span>
                  ) : (
                    <div className="relative flex items-center gap-3">
                      <span
                        className="relative block h-3 overflow-hidden rounded-[2px] md:h-3.5"
                        style={{ width: `${pct}%` }}
                      >
                        <span
                          data-bar
                          className="absolute inset-0 block origin-left bg-enzo-sand"
                        >
                          {/* Survey and drawings — the same for every room,
                              and the part nobody counts. */}
                          <span
                            className="absolute inset-y-0 left-0 block bg-enzo-cream/35"
                            style={{ width: `${leaderPct}%` }}
                          />
                        </span>
                      </span>
                      <span className="font-display hidden shrink-0 text-[11.5px] tabular-nums tracking-[0.08em] text-enzo-cream/80 md:block">
                        {entry.timeline}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Key. Two swatches, because the bar has two parts and one of them
              is the point being made. */}
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-enzo-cream/12 pt-5">
            <span className="flex items-center gap-2.5 text-[12.5px] text-enzo-cream/70">
              <span aria-hidden="true" className="block h-2.5 w-6 rounded-[1px] bg-enzo-cream/35" />
              {content.keyLeader}
            </span>
            <span className="flex items-center gap-2.5 text-[12.5px] text-enzo-cream/70">
              <span aria-hidden="true" className="block h-2.5 w-6 rounded-[1px] bg-enzo-sand" />
              {content.keyBuild}
            </span>
            <span className="text-[12.5px] text-enzo-cream/50">
              {content.keyNote}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
