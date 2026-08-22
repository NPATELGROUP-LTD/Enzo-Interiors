"use client";

// Section 04 — the work as an index, not a gallery.
//
// A masonry wall of photographs tells you Enzo has taken photographs. A
// typeset index — room, category, place, year — tells you they have
// finished nine jobs in named Leicestershire suburbs, which is the
// claim that actually matters to somebody deciding who to let into their
// house. The photograph is still there; it just follows the pointer
// instead of taking up the page.
//
// Touch devices have no pointer to follow, so the same rows carry an
// inline thumbnail instead and nothing is hidden behind hover.
import { useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowUpRight } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionIntro } from "@/components/shared/SectionIntro";
import { Button } from "@/components/ui/Button";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";
import type { PortfolioItem } from "@/lib/content";

interface WorkIndexProps {
  items: PortfolioItem[];
}

export function WorkIndex({ items }: WorkIndexProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const followerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  useGSAP(
    sectionRef,
    (section, reduced, { desktop }) => {
      const rows = gsap.utils.toArray<HTMLElement>("[data-row-inner]", section);

      if (reduced) {
        gsap.set(rows, { opacity: 1, y: 0 });
      } else {
        gsap.from(rows, {
          opacity: 0,
          y: 24,
          duration: DUR.enter,
          ease: EASE.enter,
          stagger: 0.05,
          scrollTrigger: { trigger: section, start: REVEAL_START, once: true },
        });
      }

      const follower = followerRef.current;
      if (!follower || !desktop || reduced) return;

      const move = { duration: 0.55, ease: "power3" } as const;
      const xTo = gsap.quickTo(follower, "x", move);
      const yTo = gsap.quickTo(follower, "y", move);
      // Tilt tracks horizontal velocity, so the plate leans into the
      // direction of travel and settles level when the pointer stops.
      const rotateTo = gsap.quickTo(follower, "rotate", { duration: 0.8, ease: "power3" });
      let previousX: number | null = null;

      const onMove = (event: PointerEvent) => {
        xTo(event.clientX);
        yTo(event.clientY);
        const velocity = previousX === null ? 0 : event.clientX - previousX;
        previousX = event.clientX;
        rotateTo(gsap.utils.clamp(-10, 10, velocity * 0.6));
      };

      section.addEventListener("pointermove", onMove);
      return () => section.removeEventListener("pointermove", onMove);
    },
    { queries: { desktop: "(min-width: 1024px)" } },
  );

  // Follower visibility is a plain CSS transition rather than a tween, so
  // it can never fight the quickTo transforms writing to the same element.
  const followerVisible = hovered !== null;

  return (
    <section
      ref={sectionRef}
      aria-labelledby="work-heading"
      className="relative bg-enzo-white"
      onPointerLeave={() => setHovered(null)}
    >
      <div className="mx-auto max-w-[1400px] px-6 py-24 md:px-12 md:py-32">
        <h2 id="work-heading" className="sr-only">
          Recent work
        </h2>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <SectionIntro
            index="04"
            label="Work"
            datum={`${items.length} projects · Leicestershire`}
            lines={["Recent work,", "and where it lives."]}
            lede="Every project below was drawn, built and fitted by us — most of them within ten miles of the workshop."
          />
        </div>

        <ul className="mt-14 md:mt-16">
          {items.map((item, index) => (
            <li
              key={item.id}
              data-dimmed={hovered !== null && hovered !== index}
              className="border-t border-border/60 transition-opacity duration-300 last:border-b data-[dimmed=true]:opacity-40"
              onPointerEnter={() => setHovered(index)}
              onFocusCapture={() => setHovered(index)}
            >
              <Link
                href="/portfolio"
                data-row-inner
                data-cursor="view"
                className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:py-6 lg:grid-cols-[3rem_minmax(0,1fr)_9rem_10rem_4rem_1.5rem] lg:gap-x-8"
              >
                <span className="font-display text-[11px] font-semibold tabular-nums text-enzo-forest-light lg:text-[12px]">
                  {String(index + 1).padStart(2, "0")}
                </span>

                {/* Pointer-less devices keep the photograph in the row. */}
                <ImageWithFallback
                  src={item.image}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="col-start-3 row-span-2 row-start-1 h-14 w-16 rounded-lg object-cover lg:hidden"
                />

                <span className="min-w-0">
                  <span className="relative inline-block font-serif text-[1.3rem] font-normal leading-tight text-primary transition-transform duration-500 ease-out group-hover:translate-x-1.5 md:text-[1.6rem]">
                    {item.title}
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-0.5 left-0 block h-px w-full origin-left scale-x-0 bg-primary transition-transform duration-500 ease-out group-hover:scale-x-100"
                    />
                  </span>
                  <span className="mt-1 block text-[12px] text-muted-foreground lg:hidden">
                    {item.category} &middot; {item.location} &middot; {item.year}
                  </span>
                </span>

                <span className="hidden text-[13px] text-enzo-forest-light lg:block">
                  {item.category}
                </span>
                <span className="hidden text-[13px] text-muted-foreground lg:block">
                  {item.location}
                </span>
                <span className="hidden font-display text-[12px] tabular-nums text-muted-foreground lg:block">
                  {item.year}
                </span>
                <ArrowUpRight className="hidden h-4 w-4 shrink-0 -translate-x-1 text-enzo-forest-light opacity-0 transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:opacity-100 lg:block" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-wrap items-center gap-6">
          <Button asChild variant="outline">
            <Link href="/portfolio">View all {items.length} projects</Link>
          </Button>
          <p className="text-[13px] text-muted-foreground">
            Kitchens, bedrooms, wardrobes and media walls, 2024&ndash;2026.
          </p>
        </div>
      </div>

      {/* Pointer-follower plate. Fixed to the viewport and driven purely by
          transforms, so it never triggers layout while it tracks.
          Two nested elements on purpose: GSAP owns the outer element's
          transform exclusively, and the pop-in scale lives on the inner one.
          GSAP 3.11+ reads the independent `scale` property and folds it into
          the matrix it writes — so a CSS `scale` on the same node as a
          quickTo would be applied twice, shrinking the plate as it tracks. */}
      <div
        ref={followerRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-50 hidden h-[300px] w-[240px] transition-opacity duration-300 ease-out will-change-transform lg:block"
        style={{
          marginLeft: -120,
          marginTop: -150,
          opacity: followerVisible ? 1 : 0,
        }}
      >
        <div
          className="relative h-full w-full origin-center overflow-hidden rounded-[18px] shadow-[0_30px_60px_rgba(28,74,58,0.28)] transition-transform duration-300 ease-out"
          style={{ scale: followerVisible ? 1 : 0.85 }}
        >
          {items.map((item, index) => (
            <ImageWithFallback
              key={item.id}
              src={item.image}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out"
              style={{ opacity: hovered === index ? 1 : 0 }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
