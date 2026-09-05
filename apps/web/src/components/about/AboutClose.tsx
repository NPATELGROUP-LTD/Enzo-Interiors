"use client";

// /about §07 — the close.
//
// Four asks now exist on the site and each belongs to the page it ends:
// /services closes on a drawing sheet, a service page on a split with the
// room in it, /portfolio on the next number in the register. This one closes
// on the only thing an About page has actually earned the right to say —
// that you have now met them, so come and meet them properly.
//
// The mechanic is a single line of type that splits open on approach: two
// halves of a rule part to let the ask through. Small, and the last piece of
// motion on the page, so it does not have to compete with anything.
import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@/hooks/useGSAP";
import { DUR, EASE, REVEAL_START } from "@/lib/motion";

const PHONE_DISPLAY = "0116 XXX XXXX";
const PHONE_HREF = "tel:0116XXXXXXX";

export function AboutClose() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(sectionRef, (section, reduced) => {
    const lines = gsap.utils.toArray<HTMLElement>("[data-close-line]", section);
    const body = gsap.utils.toArray<HTMLElement>("[data-close-body]", section);
    const rules = gsap.utils.toArray<HTMLElement>("[data-close-rule]", section);

    if (reduced) {
      gsap.set(body, { opacity: 1, y: 0 });
      // `y: 0` as well as `yPercent: 0`: GSAP resolves the markup's
      // `translateY(100%)` to pixels on the computed matrix, so `yPercent: 0`
      // on its own leaves the headline parked inside its mask and a
      // reduced-motion visitor gets a section with no headline.
      gsap.set(lines, { yPercent: 0, y: 0 });
      gsap.set(rules, { scaleX: 1 });
      return;
    }

    gsap.set(lines, { yPercent: 100, y: 0 });

    const tl = gsap.timeline({ paused: true });

    // The two rules part from the centre outward, then the ask comes up
    // through the gap they leave.
    tl.to(rules, { scaleX: 1, duration: 1, ease: EASE.editorial })
      .to(
        lines,
        { yPercent: 0, duration: DUR.editorial, ease: EASE.editorial, stagger: 0.08 },
        0.35,
      )
      .to(
        body,
        { opacity: 1, y: 0, duration: DUR.enter, ease: EASE.enter, stagger: 0.08 },
        0.6,
      );

    // Attached only once the timeline is populated — see revealOnScroll
    // in hooks/useGSAP.ts for why the order matters.
    ScrollTrigger.create({
      trigger: section,
      start: REVEAL_START,
      once: true,
      animation: tl,
    });

    return () => {
      tl.kill();
    };
  });

  return (
    <section
      ref={sectionRef}
      id="about-close"
      aria-labelledby="about-close-heading"
      className="relative overflow-hidden bg-enzo-dark text-enzo-cream scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-24 sm:px-6 md:px-12 md:py-32">
        <div className="flex items-center gap-5">
          <span aria-hidden="true" className="h-px flex-1 overflow-hidden">
            <span
              data-close-rule
              className="block h-px origin-right bg-enzo-cream/20"
              style={{ transform: "scaleX(0)" }}
            />
          </span>
          <span className="font-display shrink-0 text-[10.5px] font-semibold uppercase tracking-[0.3em] text-enzo-sand">
            07 — Meet us
          </span>
          <span aria-hidden="true" className="h-px flex-1 overflow-hidden">
            <span
              data-close-rule
              className="block h-px origin-left bg-enzo-cream/20"
              style={{ transform: "scaleX(0)" }}
            />
          </span>
        </div>

        <h2
          id="about-close-heading"
          className="mx-auto mt-12 max-w-[16ch] text-center font-title font-semibold leading-[1.0] tracking-[-0.045em] md:mt-16"
          style={{ fontSize: "clamp(2.2rem, 5.4vw, 4.4rem)" }}
        >
          {["You have met us.", "Now let us meet", "your room."].map((line) => (
            <span key={line} className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
              <span
                data-close-line
                className="block"
                style={{ transform: "translateY(100%)" }}
              >
                {line}
              </span>
            </span>
          ))}
        </h2>

        <p
          data-close-body
          className="mx-auto mt-7 max-w-[48ch] text-center text-[15px] leading-[1.7] text-enzo-cream/70 opacity-0"
          style={{ transform: "translateY(14px)" }}
        >
          A free survey, in your own home, with nothing to sign at the end of
          it. We measure, we photograph, we tell you honestly what is worth
          doing — and then you decide.
        </p>

        <div
          data-close-body
          className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-5 opacity-0"
          style={{ transform: "translateY(14px)" }}
        >
          <Link
            href="/booking"
            className="group relative overflow-hidden rounded-full bg-enzo-cream px-9 py-4 text-[14.5px] font-medium text-enzo-forest transition-colors duration-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 origin-bottom scale-y-0 bg-enzo-sand transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-y-100"
            />
            <span className="relative">Book a free survey</span>
          </Link>
          <a
            href={PHONE_HREF}
            className="text-[14.5px] tabular-nums text-enzo-cream/70 underline decoration-enzo-cream/25 decoration-1 underline-offset-[6px] transition-colors duration-300 hover:text-enzo-cream hover:decoration-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-4 focus-visible:ring-offset-enzo-dark"
          >
            {PHONE_DISPLAY}
          </a>
        </div>

        <p
          data-close-body
          className="mt-10 text-center text-[12.5px] text-enzo-cream/65 opacity-0"
          style={{ transform: "translateY(14px)" }}
        >
          Rather see the work first?{" "}
          <Link
            href="/portfolio"
            className="underline decoration-enzo-cream/25 decoration-1 underline-offset-4 transition-colors duration-300 hover:text-enzo-sand hover:decoration-enzo-sand"
          >
            The whole archive
          </Link>
        </p>
      </div>
    </section>
  );
}
