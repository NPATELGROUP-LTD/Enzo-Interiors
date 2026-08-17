"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollReveal } from "@/components/shared/ScrollReveal";
import { SectionLabel } from "@/components/shared/SectionLabel";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    num: "01",
    title: "Consultation",
    desc: "We visit your home, discuss your vision, and take measurements.",
  },
  {
    num: "02",
    title: "Design & Approval",
    desc: "We create 3D designs for your review and refine until perfect.",
  },
  {
    num: "03",
    title: "Installation",
    desc: "Our expert team installs everything to the highest standard.",
  },
];

export function ProcessTimeline() {
  const lineRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const line = lineRef.current;
    const section = sectionRef.current;
    if (!line || !section) return;

    const tween = gsap.fromTo(
      line,
      { scaleX: 0 },
      {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: "top 70%",
          end: "bottom 60%",
          scrub: 0.5,
        },
      },
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <section className="bg-muted py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12">
        <ScrollReveal>
          <SectionLabel text="Our Process" />
          <h2
            className="mt-4 text-center text-primary"
            style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
          >
            How It Works
          </h2>
        </ScrollReveal>
        <div ref={sectionRef} className="relative mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="absolute left-[16%] right-[16%] top-16 hidden h-px bg-border md:block">
            <div
              ref={lineRef}
              className="h-full w-full origin-left bg-primary"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
          {STEPS.map((step, i) => (
            <ScrollReveal key={step.num} delay={i * 0.15}>
              <div className="relative text-center">
                <div className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary font-serif text-[14px] text-primary-foreground">
                  {step.num}
                </div>
                <h3 className="mt-6 text-primary" style={{ fontSize: "1.3rem" }}>
                  {step.title}
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-[14px] text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
