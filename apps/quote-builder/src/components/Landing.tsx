"use client";

// Two ways to a price, each introduced by the drawing it produces: a wall
// run with one dimension for the quick estimate, a room plan for the
// planner. Both drawings are rendered from the live catalogue.
import Link from "next/link";
import { useMemo } from "react";
import { buildQuickPlan, fillRun } from "@/lib/quick";
import { findTemplate, findVariant, slotColours } from "@/lib/pricing";
import { useCatalogue } from "@/lib/store";
import { Disclaimer } from "./EstimateSlip";
import { PlanCanvas, type CanvasItem } from "./planner/PlanCanvas";
import { RunElevation } from "./quick/RunElevation";
import { ToolShell } from "./ToolShell";
import { buttonClass } from "./ui";

export function Landing() {
  const catalogue = useCatalogue();

  const sample = useMemo(() => {
    const plan = buildQuickPlan(catalogue, { roomType: "kitchens", lengthMm: 3000, frontBoardId: "brd-mdf-sage", includeUpper: true });
    const room = { ...plan.room, shape: "L" as const, widthMm: 4200, depthMm: 3600, cut: { widthMm: 1500, depthMm: 1300, corner: "br" as const } };
    const items: CanvasItem[] = plan.units.flatMap((unit) => {
      const template = findTemplate(catalogue, unit.templateId);
      const variant = findVariant(template, unit.variantId);
      return template && variant ? [{ unit: { ...unit, x: unit.x + 300 }, template, variant, colours: slotColours(catalogue, template, unit.materials) }] : [];
    });
    return { room, items };
  }, [catalogue]);

  const base = catalogue.units.find((u) => u.id === catalogue.roomTypes[0]?.quickFill.templateId);

  return (
    <ToolShell section="Price your room">
      <div className="shell py-10 md:py-16">
        <h1 className="max-w-[16ch] text-[clamp(2.4rem,5vw,4.25rem)]">What would it cost to fit your room?</h1>
        <p className="mt-5 max-w-[56ch] text-[16px] leading-relaxed text-muted-foreground">
          Every piece of furniture we make is cut from whole sheets of board, so that is how we estimate it. Pick the
          route that suits how much you know about your room.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Link
            href="/quick"
            className="group flex flex-col rounded-[20px] border border-border/70 bg-card p-6 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-8"
          >
            <div className="flex h-56 items-end justify-center md:h-64" aria-hidden="true">
              {base && (
                <RunElevation
                  catalogue={catalogue}
                  main={{ template: base, sizes: fillRun(base, 3000), materials: { front: "brd-oak-veneer" } }}
                  upper={null}
                  lengthMm={3000}
                  className="h-full w-full"
                />
              )}
            </div>
            <h2 className="mt-8 text-[1.6rem]">Quick estimate</h2>
            <p className="mt-2 max-w-[44ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Tell us the room, how much wall gets furniture and the finish you like. About a minute.
            </p>
            <span className={`${buttonClass("secondary")} mt-6 self-start group-hover:border-primary`}>Get a quick estimate</span>
          </Link>

          <Link
            href="/plan"
            className="group flex flex-col rounded-[20px] border border-border/70 bg-card p-6 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-8"
          >
            <div className="h-56 md:h-64" aria-hidden="true">
              <PlanCanvas room={sample.room} items={sample.items} readOnly />
            </div>
            <h2 className="mt-8 text-[1.6rem]">Plan it yourself</h2>
            <p className="mt-2 max-w-[44ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Draw your room, place units where you want them, choose finishes and see in 3D how it comes together,
              and exactly how every board is cut. About ten minutes.
            </p>
            <span className={`${buttonClass("primary")} mt-6 self-start`}>Open the room planner</span>
          </Link>
        </div>

        <div className="mt-14 flex flex-wrap items-start justify-between gap-6 border-t border-border/70 pt-6">
          <Disclaimer className="max-w-[70ch]" />
          <Link href="/admin" className="touch-target text-[12.5px] text-muted-foreground underline underline-offset-4 hover:text-primary">
            Studio catalogue (staff)
          </Link>
        </div>
      </div>
    </ToolShell>
  );
}
