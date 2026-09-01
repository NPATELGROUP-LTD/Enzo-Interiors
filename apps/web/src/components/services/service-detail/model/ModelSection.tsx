"use client";

// The frame the four A3 models share: heading, stage, one control, caption.
//
// Only the *model* differs between service pages — the section around it
// stays constant so the four pages still feel like one site, and so a new
// model is one file rather than one file plus a section rebuild.
//
// Exactly one control per model, always a labelled text button. These
// sections replaced the material swatch walls, which were four different
// ways of showing the same list of finish names; the model is the object,
// and the control is the single thing you can do to it.
import type { ReactNode } from "react";
import { SectionIntro } from "@/components/shared/SectionIntro";

interface ModelSectionProps {
  id: string;
  label: string;
  lines: string[];
  lede: string;
  stage: ReactNode;
  control: { label: string; onClick: () => void; pressed: boolean };
  caption: string;
}

export function ModelSection({
  id,
  label,
  lines,
  lede,
  stage,
  control,
  caption,
}: ModelSectionProps) {
  return (
    <section
      id={id}
      aria-labelledby="model-heading"
      className="relative bg-enzo-dark scroll-mt-24"
    >
      <div className="mx-auto max-w-[1500px] px-5 py-20 sm:px-6 md:px-12 md:py-28">
        <h2 id="model-heading" className="sr-only">
          The model
        </h2>

        <SectionIntro
          layout="split"
          tone="dark"
          index="A3"
          label={label}
          datum="drag to turn"
          lines={lines}
          lede={lede}
        />

        <div className="mt-12 rounded-[20px] bg-enzo-forest/25">{stage}</div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[12.5px] text-enzo-cream/45">{caption}</p>
          <button
            type="button"
            onClick={control.onClick}
            aria-pressed={control.pressed}
            className="rounded-full border border-enzo-cream/25 px-6 py-2.5 text-[13.5px] text-enzo-cream transition-colors duration-300 hover:border-enzo-sand hover:text-enzo-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-enzo-sand focus-visible:ring-offset-2 focus-visible:ring-offset-enzo-dark"
          >
            {control.label}
          </button>
        </div>
      </div>
    </section>
  );
}
