"use client";

// The simplified estimate: three answers, a live range. It prices through
// the same catalogue and sheet maths as the planner — the run is filled
// with the room's standard unit — so the two tools never disagree, and
// "refine it in the planner" opens exactly the units just priced.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { metres, plural } from "@/lib/quote-builder/format";
import { makeId, makeReference } from "@/lib/quote-builder/ids";
import { buildQuickPlan, fillRun } from "@/lib/quote-builder/quick";
import { estimatesStore, planStore, useCatalogue, useHydrated } from "@/lib/quote-builder/store";
import type { RoomTypeId } from "@/lib/quote-builder/types";
import { Disclaimer, PriceRange } from "../EstimateSlip";
import { ToolShell } from "../ToolShell";
import { Button, NumberInput, Swatch, Toggle, buttonClass } from "../ui";
import { useEstimate } from "../useEstimate";
import { RunElevation, type Run } from "./RunElevation";

const MIN_RUN = 1200;
const MAX_RUN = 8000;

export function QuickEstimate() {
  const catalogue = useCatalogue();
  const hydrated = useHydrated();
  const router = useRouter();
  const fronts = catalogue.boards.filter((b) => b.category === "front");

  const [roomType, setRoomType] = useState<RoomTypeId>("kitchens");
  const [lengthMm, setLengthMm] = useState(3600);
  const [frontId, setFrontId] = useState(fronts[0]?.id ?? "");
  const [includeUpper, setIncludeUpper] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);

  const room = catalogue.roomTypes.find((r) => r.id === roomType);
  const hasUpper = Boolean(room?.quickFill.upperTemplateId);
  const input = { roomType, lengthMm, frontBoardId: frontId, includeUpper: includeUpper && hasUpper };
  const plan = useMemo(
    () => buildQuickPlan(catalogue, input),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the fields of `input` are listed individually.
    [catalogue, roomType, lengthMm, frontId, includeUpper, hasUpper],
  );
  const estimate = useEstimate(plan.units, catalogue);

  const runFor = (templateId: string | undefined): Run | null => {
    const template = catalogue.units.find((u) => u.id === templateId);
    if (!template) return null;
    const materials = plan.units.find((u) => u.templateId === template.id)?.materials ?? {};
    return { template, sizes: fillRun(template, lengthMm), materials };
  };
  const main = runFor(room?.quickFill.templateId);
  const upper = input.includeUpper ? runFor(room?.quickFill.upperTemplateId) : null;
  const front = catalogue.boards.find((b) => b.id === frontId);

  const change = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value);
    setSaved(null);
  };

  const save = () => {
    const reference = makeReference();
    estimatesStore.update((list) => [
      {
        id: makeId("est"),
        reference,
        createdAt: new Date().toISOString(),
        source: "quick",
        plan,
        lowPence: estimate.lowPence,
        highPence: estimate.highPence,
        pricePence: estimate.pricePence,
        costPence: estimate.costPence,
        sheetCount: estimate.sheetCount,
      },
      ...list,
    ]);
    setSaved(reference);
    toast.success(`Estimate saved as ${reference}`);
  };

  const refine = () => {
    if (planStore.read().units.length > 0 && !window.confirm("Replace the plan you already started in the room planner?")) return;
    planStore.write(plan);
    router.push("/quote-builder/plan?step=layout");
  };

  return (
    <ToolShell section="Quick estimate">
      <div className="shell grid gap-10 py-8 md:py-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16">
        <div className="flex flex-col gap-8">
          <div>
            <h1 className="text-[clamp(2rem,3.4vw,2.9rem)]">A price in a minute</h1>
            <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-muted-foreground">
              Three answers and we&rsquo;ll fill your wall with our standard units in the finish you like. For a
              closer figure, carry on in the room planner.
            </p>
          </div>

          <fieldset>
            <legend className="text-[14px] font-medium">What are we fitting?</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {catalogue.roomTypes.map((type) => (
                <label
                  key={type.id}
                  className={cn(
                    "cursor-pointer rounded-xl border-2 px-4 py-3 text-[14px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    roomType === type.id ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-secondary",
                  )}
                >
                  <input
                    type="radio"
                    name="quick-room"
                    className="sr-only"
                    checked={roomType === type.id}
                    onChange={() => change(setRoomType)(type.id)}
                  />
                  {type.singular}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <div className="flex items-end justify-between gap-4">
              <label htmlFor="quick-length" className="text-[14px] font-medium">
                How much wall gets furniture?
              </label>
              <NumberInput
                ariaLabel="Wall length in millimetres"
                className="w-36"
                suffix="mm"
                min={MIN_RUN}
                max={MAX_RUN}
                value={lengthMm}
                onChange={change(setLengthMm)}
              />
            </div>
            <input
              id="quick-length"
              type="range"
              className="enzo-range mt-5"
              min={MIN_RUN}
              max={MAX_RUN}
              step={100}
              value={lengthMm}
              onChange={(e) => change(setLengthMm)(Number(e.target.value))}
              aria-valuetext={metres(lengthMm)}
            />
            <div className="mt-2 flex justify-between font-display text-[11.5px] tabular-nums text-muted-foreground">
              <span>{metres(MIN_RUN)}</span>
              <span>{metres(MAX_RUN)}</span>
            </div>
            <p className="mt-2 text-[12.5px] text-muted-foreground">If units go on more than one wall, add the lengths together.</p>
          </div>

          <fieldset>
            <legend className="flex w-full items-baseline justify-between gap-3 text-[14px]">
              <span className="font-medium">Door finish</span>
              <span className="text-muted-foreground">{front?.name}</span>
            </legend>
            <div className="mt-3 grid grid-cols-6 gap-2">
              {fronts.map((board) => (
                <label
                  key={board.id}
                  title={board.name}
                  className={cn(
                    "aspect-square cursor-pointer rounded-lg p-0.5 ring-offset-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    board.id === frontId ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-border",
                  )}
                >
                  <input
                    type="radio"
                    name="quick-front"
                    className="sr-only"
                    aria-label={board.name}
                    checked={board.id === frontId}
                    onChange={() => change(setFrontId)(board.id)}
                  />
                  <Swatch board={board} className="h-full w-full" />
                </label>
              ))}
            </div>
          </fieldset>

          {hasUpper && room?.quickFill.upperLabel && (
            <Toggle id="quick-upper" checked={includeUpper} onChange={change(setIncludeUpper)} label={room.quickFill.upperLabel} />
          )}
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-8 lg:self-start">
          <section aria-labelledby="quick-result" aria-live="polite" className="rounded-[20px] bg-enzo-forest p-7 text-enzo-cream md:p-9">
            <h2 id="quick-result" className="font-sans text-[14px] font-medium tracking-normal text-enzo-sand">
              Estimated price
            </h2>
            {hydrated && plan.units.length > 0 ? (
              <>
                <PriceRange estimate={estimate} className="mt-2 text-[clamp(2.4rem,4.6vw,3.6rem)]" />
                <p className="mt-2 text-[14px] text-enzo-cream/75">
                  {plural(plan.units.length, "unit")} in {front?.name}, cut from {plural(estimate.sheetCount, "sheet")} of board
                </p>
              </>
            ) : (
              <p className="mt-3 text-[15px] text-enzo-cream/80">
                {hydrated ? "That wall is too short for our standard units." : "Working it out…"}
              </p>
            )}
            <Disclaimer tone="dark" className="mt-6" />
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="cream" onClick={refine} disabled={plan.units.length === 0}>
                Refine it in the room planner
              </Button>
              {saved ? (
                <Link href={`/booking?service=${roomType}`} className={buttonClass("cream")}>
                  Book a free consultation
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={save}
                  disabled={plan.units.length === 0}
                  className="h-11 rounded-full border border-enzo-cream/30 px-6 text-[14px] font-medium text-enzo-cream transition-colors hover:border-enzo-cream disabled:opacity-40"
                >
                  Save this estimate
                </button>
              )}
            </div>
            {saved && (
              <p className="mt-4 text-[13px] text-enzo-cream/80">
                Saved as <span className="font-display font-semibold text-enzo-sand">{saved}</span>. Mention it when you book.
              </p>
            )}
          </section>

          {hydrated && main && (
            <figure className="rounded-[20px] border border-border/70 bg-card p-5">
              <RunElevation catalogue={catalogue} main={main} upper={upper} lengthMm={lengthMm} className="h-auto w-full" />
              <figcaption className="mt-3 text-[12.5px] text-muted-foreground">
                {main.sizes.length > 0
                  ? `${summarise(main.sizes.map((s) => s.widthMm))} ${main.template.name.toLowerCase()}s${upper && upper.sizes.length ? `, with ${upper.template.name.toLowerCase()}s above` : ""}.`
                  : "No standard unit fits a wall this short."}
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </ToolShell>
  );
}

/** "3 × 1,000 mm and 1 × 600 mm" */
function summarise(widths: number[]): string {
  const counts = new Map<number, number>();
  widths.forEach((w) => counts.set(w, (counts.get(w) ?? 0) + 1));
  const parts = [...counts.entries()].map(([w, n]) => `${n} × ${w.toLocaleString("en-GB")} mm`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0] ?? "";
}
