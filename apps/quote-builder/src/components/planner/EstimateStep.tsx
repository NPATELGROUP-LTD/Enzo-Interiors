"use client";

import { Check } from "lucide-react";
import { plural, pounds, poundsExact } from "@/lib/format";
import { siteHref } from "@/lib/site";
import type { Estimate } from "@/lib/pricing";
import { resolveBoard } from "@/lib/pricing";
import type { Catalogue, Plan } from "@/lib/types";
import { Disclaimer, PriceRange } from "../EstimateSlip";
import { SheetDiagram } from "../SheetDiagram";
import { Button, Swatch, buttonClass } from "../ui";
import { PlanCanvas, type CanvasItem } from "./PlanCanvas";

export function EstimateStep({
  plan,
  catalogue,
  estimate,
  items,
  studio,
  savedReference,
  onSave,
  onBack,
}: {
  plan: Plan;
  catalogue: Catalogue;
  estimate: Estimate;
  items: CanvasItem[];
  studio: boolean;
  savedReference: string | null;
  onSave: () => void;
  onBack: () => void;
}) {
  const roomType = catalogue.roomTypes.find((r) => r.id === plan.room.type);
  const empty = plan.units.length === 0;

  if (empty) {
    return (
      <div className="shell py-16">
        <h1 className="text-[2rem]">Nothing to price yet</h1>
        <p className="mt-3 max-w-[52ch] text-[15px] text-muted-foreground">
          Place at least one unit on your plan and the estimate appears here, with how every board is cut.
        </p>
        <Button className="mt-6" onClick={onBack}>
          Back to the plan
        </Button>
      </div>
    );
  }

  return (
    <div className="lg:h-full lg:overflow-y-auto">
      <div className="shell py-8 md:py-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
          <div>
            <h1 className="text-[clamp(1.6rem,2.6vw,2.1rem)] font-medium">
              Your {roomType?.singular.toLowerCase() ?? "room"}, estimated
            </h1>
            <PriceRange estimate={estimate} className="mt-4 text-[clamp(2.8rem,6vw,4.75rem)] text-primary" />
            <p className="mt-3 text-[15px] text-muted-foreground">
              For {plural(plan.units.length, "unit")} in the finishes you chose, cut from {plural(estimate.sheetCount, "whole sheet")} of board.
            </p>
            <Disclaimer className="mt-6 max-w-[62ch] rounded-xl bg-card p-4 text-[13.5px]" />

            {savedReference ? (
              <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <Check size={18} aria-hidden="true" className="text-primary" />
                <p className="text-[14px]">
                  Saved as <span className="font-display font-semibold tabular-nums text-primary">{savedReference}</span>. Mention it when you book and we&rsquo;ll bring your plan to the consultation.
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              {!savedReference && <Button onClick={onSave}>Save this estimate</Button>}
              <a href={siteHref(`/booking?service=${plan.room.type}`)} className={buttonClass(savedReference ? "primary" : "secondary")}>
                Book a free consultation
              </a>
              <Button variant="ghost" onClick={onBack}>
                Back to the plan
              </Button>
            </div>

            {studio && (
              <dl className="mt-8 grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 rounded-xl bg-enzo-forest p-5 text-[13.5px] text-enzo-cream">
                <dt className="col-span-2 pb-1 text-enzo-sand">Staff view</dt>
                <dt className="text-enzo-cream/75">Boards</dt>
                <dd className="text-right font-display tabular-nums">{pounds(estimate.boardsCostPence)}</dd>
                <dt className="text-enzo-cream/75">Hardware and fitting</dt>
                <dd className="text-right font-display tabular-nums">{pounds(estimate.extrasCostPence)}</dd>
                <dt className="text-enzo-cream/75">Cost</dt>
                <dd className="text-right font-display tabular-nums">{pounds(estimate.costPence)}</dd>
                <dt className="text-enzo-cream/75">Margin at {catalogue.settings.marginPct}%</dt>
                <dd className="text-right font-display tabular-nums">{pounds(estimate.marginPence)}</dd>
                <dt className="text-enzo-sand">Price before range</dt>
                <dd className="text-right font-display tabular-nums text-enzo-sand">{pounds(estimate.pricePence)}</dd>
              </dl>
            )}
          </div>

          <figure className="rounded-[20px] border border-border/70 bg-background p-3">
            <div className="aspect-[4/3]">
              <PlanCanvas room={plan.room} items={items} readOnly />
            </div>
            <figcaption className="px-2 pb-1 pt-2 text-[12px] text-muted-foreground">Your plan, as priced</figcaption>
          </figure>
        </div>

        <section aria-labelledby="units-breakdown" className="mt-16 border-t border-border/70 pt-8">
          <h2 id="units-breakdown" className="text-[1.6rem]">
            What&rsquo;s in it
          </h2>
          <div className="relative mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
              <thead>
                <tr className="text-[12.5px] text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-normal">Unit</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Width</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Finishes</th>
                  <th scope="col" className="py-2 text-right font-normal">About</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const line = estimate.lines.find((l) => l.unitId === item.unit.id);
                  return (
                    <tr key={item.unit.id} className="border-t border-border/70 align-top">
                      <td className="py-3 pr-4 font-medium">{item.template.name}</td>
                      <td className="py-3 pr-4 font-display tabular-nums">{item.variant.widthMm} mm</td>
                      <td className="py-3 pr-4">
                        <ul className="flex flex-col gap-1.5">
                          {item.template.slots.map((slot) => {
                            const board = resolveBoard(catalogue, item.template, slot.key, item.unit.materials);
                            return board ? (
                              <li key={slot.key} className="flex items-center gap-2 text-[13px]">
                                <Swatch board={board} className="h-4 w-4 rounded" />
                                <span className="text-muted-foreground">{slot.label}:</span> {board.name}
                              </li>
                            ) : null;
                          })}
                        </ul>
                      </td>
                      <td className="py-3 text-right font-display tabular-nums">
                        {line ? pounds(Math.round(line.pricePence / 1000) * 1000) : "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 max-w-[70ch] text-[12.5px] leading-relaxed text-muted-foreground">
            Each unit carries its share of the sheets it is cut from, so units that share a board cost less than they
            would on their own.
          </p>
        </section>

        <section aria-labelledby="sheets-heading" className="mt-16 border-t border-border/70 pt-8">
          <div className="max-w-[66ch]">
            <h2 id="sheets-heading" className="text-[1.6rem]">
              How your boards are cut
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
              Boards are bought as whole sheets. We fit as many of your pieces onto each sheet as we can, and the
              hatched areas are the offcuts left over — which is why a price is counted in sheets rather than in
              square metres.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-12">
            {estimate.boards.map((usage) => (
              <div key={usage.board.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <Swatch board={usage.board} className="h-8 w-8" />
                  <h3 className="font-sans text-[16px] font-semibold tracking-normal">{usage.board.name}</h3>
                  <span className="font-display text-[13px] tabular-nums text-muted-foreground">
                    {plural(usage.sheetCount, "sheet")}
                    {studio ? `, ${poundsExact(usage.board.pricePence)} each` : ""}
                  </span>
                </div>
                <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {usage.nest.sheets.map((sheet, i) => (
                    <SheetDiagram
                      key={i}
                      board={usage.board}
                      sheet={sheet}
                      caption={`Sheet ${i + 1} of ${usage.nest.sheets.length}`}
                    />
                  ))}
                </div>
                {usage.nest.oversize.length > 0 && (
                  <p className="mt-3 text-[13px] text-muted-foreground">
                    Plus {plural(usage.nest.oversize.reduce((n, o) => n + o.boards, 0), "sheet")} for{" "}
                    {usage.nest.oversize.map((o) => o.piece.label.toLowerCase()).join(", ")}, which {usage.nest.oversize.length === 1 ? "is" : "are"} longer than one sheet and will be jointed.
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
