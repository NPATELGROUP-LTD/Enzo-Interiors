"use client";

// "What's included" — layout 3 of 4: THE COURSES (media walls).
//
// Replaces a bento grid of bays. That grid was twice reworked and never got
// past "cards with numbers on them": the shape said nothing about the
// product, so no amount of shelf lines and recessed shadows was going to
// rescue it.
//
// A media wall is built up in courses off the plasterboard, so the section
// builds one. Each included item is a full-width course; they lay
// themselves from the bottom up as you scroll, arriving from alternating
// sides the way a course is actually offered up to the wall. Each course
// carries perpend joints at an offset from the course below, which is what
// makes the stack read as masonry rather than as a list with borders.
//
// The joints are positional, not semantic — a decorative bond pattern —
// and the item text sits in the course, so nothing here claims that item
// seven is physically at that height on your wall.
//
// Ground: cream. It sits between a forest hero and the near-black model.
import { useRef } from "react";
import gsap from "gsap";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { useGSAP } from "@/hooks/useGSAP";
import { EASE } from "@/lib/motion";
import type { ServiceDetail } from "@/lib/content";

/** Perpend offsets, cycled — a stretcher bond rather than stacked joints. */
const BOND = [0.18, 0.52, 0.34, 0.68, 0.44, 0.26];

export function IncludedCourses({
  service,
  id,
}: {
  service: ServiceDetail;
  id: string;
}) {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const courses = gsap.utils.toArray<HTMLElement>("[data-course]", section);
    if (!courses.length) return;

    if (reduced) {
      gsap.set(courses, { opacity: 1, x: 0, rotate: 0 });
      return;
    }

    // Each course is triggered on itself rather than on the wall, so the
    // stack genuinely lays as you descend instead of playing one canned
    // stagger the moment the section's top edge appears.
    courses.forEach((course, index) => {
      gsap.from(course, {
        opacity: 0,
        x: index % 2 === 0 ? -70 : 70,
        rotate: index % 2 === 0 ? -1.2 : 1.2,
        duration: 0.72,
        ease: EASE.editorial,
        scrollTrigger: { trigger: course, start: "top 92%", once: true },
      });
    });
  });

  const total = service.features.length;

  return (
    <section
      ref={sectionRef}
      id={id}
      aria-labelledby="included-heading"
      className="relative overflow-hidden bg-background scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="included-heading" className="sr-only">
          What is included
        </h2>

        <SectionIntro
          layout="split"
          index="A2"
          label="Courses"
          datum={`${total} in the build-up`}
          lines={["Laid course", "by course."]}
          lede={service.overview}
        />

        {/* The wall. Reversed in the DOM so the first item is the bottom
            course — you read a wall from the ground up, and the scroll
            trigger then fires them in laying order. */}
        <div className="mx-auto mt-14 max-w-5xl md:mt-20">
          {[...service.features].reverse().map((feature, reversedIndex) => {
            const index = total - 1 - reversedIndex;
            const bond = BOND[index % BOND.length];
            return (
              <article
                key={feature}
                data-course
                className="group relative mb-[3px] flex items-center gap-5 overflow-hidden rounded-[3px] bg-card px-5 py-5 transition-colors duration-400 last:mb-0 hover:bg-muted md:gap-8 md:px-8"
                style={{
                  // Light falls down a wall face: each course is fractionally
                  // darker at its top edge, which is what gives the stack
                  // depth without a drop shadow under every row.
                  boxShadow:
                    "inset 0 5px 10px -8px rgba(28,44,36,0.45), inset 0 0 0 1px rgba(28,44,36,0.05)",
                }}
              >
                {/* Perpend joints, offset course to course. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 w-px bg-primary/[0.07]"
                  style={{ left: `${bond * 100}%` }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 w-px bg-primary/[0.07]"
                  style={{ left: `${Math.min(0.94, bond + 0.31) * 100}%` }}
                />

                <span className="font-display relative w-8 shrink-0 text-[10.5px] font-semibold tabular-nums tracking-[0.16em] text-enzo-forest-light">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <p className="relative flex-1 text-[15px] font-medium leading-[1.4] tracking-[-0.015em] text-primary md:text-[16px]">
                  {feature}
                </p>

                {/* The bed joint under the course, struck flush on hover. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-enzo-sand transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100"
                />
              </article>
            );
          })}

          {/* The floor the wall stands on. */}
          <span
            aria-hidden="true"
            className="mt-1 block h-px w-full bg-primary/25"
          />
        </div>
      </div>
    </section>
  );
}
