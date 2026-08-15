"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { Handshake, MapPin, Wrench } from "lucide-react";
import { ImageWithFallback } from "@/components/shared/ImageWithFallback";
import { SectionLabel } from "@/components/shared/SectionLabel";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useStaggerReveal } from "@/hooks/useStaggerReveal";

const WhyEnzoScene = dynamic(() => import("./WhyEnzoScene"), {
  ssr: false,
  loading: () => null,
});

const SAGE_KITCHEN =
  "https://images.unsplash.com/photo-1721522282337-6b6d3e366463?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBraXRjaGVuJTIwc2FnZSUyMGdyZWVuJTIwZml0dGVkfGVufDF8fHx8MTc3MjM5ODIzMnww&ixlib=rb-4.1.0&q=80&w=1080";

export function WhyEnzoBento() {
  const gridRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(gridRef);
  // The 3D accent is desktop-only — purely decorative, not worth a WebGL
  // context on mobile GPUs/battery. Below md, the tile shows a plain stat.
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <section className="bg-enzo-forest py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12">
        <SectionLabel text="Why Choose Us" light />
        <h2
          className="mt-4 text-center text-enzo-cream"
          style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}
        >
          A Different Kind of Interior Company.
        </h2>

        <div ref={gridRef} className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <div className="relative min-h-[300px] overflow-hidden rounded-2xl md:col-span-2 md:row-span-2">
            <ImageWithFallback
              src={SAGE_KITCHEN}
              alt="Bespoke manufacturing"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            <div className="relative z-10 flex h-full flex-col justify-end p-8">
              <h3 className="text-enzo-cream" style={{ fontSize: "1.6rem" }}>
                Bespoke Manufacturing
              </h3>
              <p className="mt-2 max-w-sm text-[14px] text-enzo-cream/80">
                Every piece is designed and manufactured to your exact specifications.
              </p>
            </div>
          </div>

          <div className="flex min-h-[180px] flex-col justify-between rounded-2xl border border-enzo-forest-light/60 bg-enzo-sage/20 p-8">
            <Handshake size={32} className="text-enzo-sage" />
            <div>
              <h4 className="mt-4 text-enzo-cream" style={{ fontSize: "1.1rem" }}>
                Free Consultation
              </h4>
              <p className="mt-1 text-[13px] text-enzo-sage">We come to you. No obligation.</p>
            </div>
          </div>

          <div className="flex min-h-[180px] flex-col justify-between rounded-2xl bg-card p-8">
            <MapPin size={32} className="text-primary" />
            <div>
              <h4 className="mt-4 text-primary" style={{ fontSize: "1.1rem" }}>
                Leicester Based
              </h4>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Proudly serving Leicestershire.
              </p>
            </div>
          </div>

          <div className="relative flex min-h-[180px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-enzo-forest-light bg-enzo-forest-light/40 p-8">
            {isDesktop && (
              <div className="absolute inset-0 opacity-70" aria-hidden="true">
                <WhyEnzoScene />
              </div>
            )}
            <span
              className="relative z-10 font-serif text-enzo-cream"
              style={{ fontSize: "4rem", fontWeight: 300 }}
            >
              100%
            </span>
            <p className="relative z-10 mt-2 text-[13px] text-enzo-sage">Client Satisfaction</p>
          </div>

          <div className="flex min-h-[180px] flex-col justify-between rounded-2xl border border-enzo-forest-light/60 bg-enzo-forest p-8">
            <Wrench size={32} className="text-enzo-sage" />
            <div>
              <h4 className="mt-4 text-enzo-cream" style={{ fontSize: "1.1rem" }}>
                Installed by Experts
              </h4>
              <p className="mt-1 text-[13px] text-enzo-sage">
                Our skilled team handles every detail.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
