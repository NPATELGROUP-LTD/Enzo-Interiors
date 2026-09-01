"use client";

// /services/[category] §A2 — the schedule of works.
//
// The old page put the description in one column and a tick-list in the
// other: two grey blocks of equal weight, and the ticks read as marketing
// bullets rather than as a specification.
//
// A joiner's schedule numbers every item and rules a leader line to it, so
// that is the form here — and because the items are numbered, a service
// with fourteen of them still reads as a document rather than as a wall.
// Beside it sits the same procedurally drawn plan the /services index uses
// (RoomPlan), mounted on a dark plate like a drawing pinned above a bench,
// which is what ties the two pages together visually.
import { useRef, useState } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE, REVEAL_START } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";
import { RoomPlan } from "../RoomPlan";

interface ServiceScheduleProps {
  service: ServiceDetail;
  id: string;
}

export function ServiceSchedule({ service, id }: ServiceScheduleProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const plate = section.querySelector<HTMLElement>("[data-schedule-plate]");
    const overview = section.querySelector<HTMLElement>("[data-schedule-overview]");
    const rows = gsap.utils.toArray<HTMLElement>("[data-schedule-row]", section);

    if (reduced) {
      gsap.set([plate, overview, ...rows].filter(Boolean), { opacity: 1, y: 0, scale: 1 });
      return;
    }

    if (plate) {
      gsap.from(plate, {
        opacity: 0,
        y: 32,
        scale: 0.97,
        duration: 1,
        ease: EASE.editorial,
        scrollTrigger: { trigger: plate, start: "top 88%", once: true },
      });
    }
    if (overview) {
      gsap.from(overview, {
        opacity: 0,
        y: 20,
        duration: 0.8,
        ease: EASE.enter,
        scrollTrigger: { trigger: overview, start: REVEAL_START, once: true },
      });
    }
    if (rows.length) {
      // Rows arrive from the left, which is the direction a leader line is
      // ruled — the list writing itself out rather than fading up.
      gsap.from(rows, {
        opacity: 0,
        x: -18,
        duration: 0.6,
        ease: EASE.enter,
        stagger: 0.045,
        scrollTrigger: { trigger: rows[0], start: REVEAL_START, once: true },
      });
    }
  });

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="service-schedule-heading"
      className="relative bg-background scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="service-schedule-heading" className="sr-only">
          What is included
        </h2>

        <SectionIntro
          layout="split"
          index="A2"
          label="Schedule"
          datum={`${service.features.length} line items`}
          lines={["Specified", "line by line."]}
          lede={service.heroDesc}
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] lg:gap-16">
          {/* ── Drawing plate ── */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div
              data-schedule-plate
              className="overflow-hidden rounded-[18px] bg-enzo-dark p-4"
            >
              <div className="aspect-[4/3] w-full">
                <RoomPlan
                  slug={service.slug}
                  image={service.image}
                  caption={service.category}
                  className="h-full w-full"
                />
              </div>
            </div>
            <p
              data-schedule-overview
              className="mt-6 text-[14.5px] leading-[1.75] text-muted-foreground"
            >
              {service.overview}
            </p>
          </div>

          {/* ── Schedule ── */}
          <ol className="grid gap-x-10 sm:grid-cols-2 lg:gap-x-14">
            {service.features.map((feature, index) => {
              const isOn = hovered === index;
              return (
                <li
                  key={feature}
                  data-schedule-row
                  onPointerEnter={() => setHovered(index)}
                  onPointerLeave={() => setHovered(null)}
                  className="group relative border-t border-border/60 py-4"
                >
                  <div className="flex items-baseline gap-4">
                    <span
                      className="font-display shrink-0 text-[10.5px] font-semibold tabular-nums tracking-[0.14em] transition-colors duration-300"
                      style={{
                        color: isOn ? "var(--enzo-forest)" : "var(--muted-foreground)",
                      }}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="flex-1 text-[14.5px] leading-[1.55] tracking-[-0.01em] transition-[color,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{
                        color: isOn ? "var(--enzo-forest)" : "var(--foreground)",
                        transform: isOn ? "translateX(6px)" : "translateX(0)",
                      }}
                    >
                      {feature}
                    </span>
                  </div>
                  {/* The leader line being ruled in under the item. */}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 block h-px origin-left bg-primary transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ transform: `scaleX(${isOn ? 1 : 0})` }}
                  />
                </li>
              );
            })}
            <li aria-hidden="true" className="border-t border-border/60 sm:col-span-2" />
          </ol>
        </div>
      </div>
    </section>
  );
}
