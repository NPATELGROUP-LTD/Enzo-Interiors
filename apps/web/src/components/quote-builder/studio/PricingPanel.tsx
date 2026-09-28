"use client";

import { pounds } from "@/lib/quote-builder/format";
import { applyMargin, roundToStep } from "@/lib/quote-builder/pricing";
import { catalogueStore } from "@/lib/quote-builder/store";
import type { Catalogue, PricingSettings, QuickFill, RoomTypeId } from "@/lib/quote-builder/types";
import { Field, NumberInput, inputClass } from "../ui";

export function PricingPanel({ catalogue }: { catalogue: Catalogue }) {
  const { settings } = catalogue;
  const set = (patch: Partial<PricingSettings>) =>
    catalogueStore.update((c) => ({ ...c, settings: { ...c.settings, ...patch } }));

  const setQuickFill = (id: RoomTypeId, patch: Partial<QuickFill>) =>
    catalogueStore.update((c) => ({
      ...c,
      roomTypes: c.roomTypes.map((r) => (r.id === id ? { ...r, quickFill: { ...r.quickFill, ...patch } } : r)),
    }));

  const exampleCost = 100_000;
  const examplePrice = applyMargin(exampleCost, settings);
  const low = roundToStep(examplePrice * (1 - settings.rangeLowPct / 100), settings);
  const high = roundToStep(examplePrice * (1 + settings.rangeHighPct / 100), settings);

  return (
    <div className="grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-10">
      <section aria-labelledby="margin-heading" className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <h2 id="margin-heading" className="text-[1.5rem]">
            Margin and price range
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Cost is whole boards plus each unit&rsquo;s hardware and fitting. The margin is added on top of that cost, and
            customers see a range around the result rather than one exact figure.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <Field label="Margin on cost" htmlFor="margin" className="col-span-2 sm:col-span-1">
              <NumberInput id="margin" suffix="%" min={0} max={500} value={settings.marginPct} onChange={(v) => set({ marginPct: v })} />
            </Field>
            <Field label="Round prices to the nearest" htmlFor="round" className="col-span-2 sm:col-span-1">
              <NumberInput id="round" prefix="£" min={1} max={1000} value={settings.roundToPounds} onChange={(v) => set({ roundToPounds: v })} />
            </Field>
            <Field label="Range below" htmlFor="range-low">
              <NumberInput id="range-low" suffix="%" min={0} max={50} value={settings.rangeLowPct} onChange={(v) => set({ rangeLowPct: v })} />
            </Field>
            <Field label="Range above" htmlFor="range-high">
              <NumberInput id="range-high" suffix="%" min={0} max={100} value={settings.rangeHighPct} onChange={(v) => set({ rangeHighPct: v })} />
            </Field>
          </div>
        </div>

        <figure className="self-start rounded-[20px] bg-enzo-forest p-6 text-enzo-cream">
          <figcaption className="text-[13px] text-enzo-sand">Worked example</figcaption>
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-[14px]">
            <dt className="text-enzo-cream/75">Boards, hardware and fitting</dt>
            <dd className="text-right font-display tabular-nums">{pounds(exampleCost)}</dd>
            <dt className="text-enzo-cream/75">Plus {settings.marginPct}% margin</dt>
            <dd className="text-right font-display tabular-nums">{pounds(examplePrice - exampleCost)}</dd>
            <dt className="border-t border-enzo-cream/15 pt-2 text-enzo-cream/75">Price</dt>
            <dd className="border-t border-enzo-cream/15 pt-2 text-right font-display tabular-nums">{pounds(examplePrice)}</dd>
          </dl>
          <p className="mt-5 text-[13px] text-enzo-cream/75">The customer sees</p>
          <p className="mt-1 font-title text-[1.9rem] font-semibold tracking-[-0.04em] tabular-nums">
            {pounds(low)} <span className="font-normal opacity-60">–</span> {pounds(high)}
          </p>
        </figure>
      </section>

      <section aria-labelledby="cutting-heading" className="border-t border-border/70 pt-8">
        <h2 id="cutting-heading" className="text-[1.5rem]">
          Cutting allowances
        </h2>
        <p className="mt-2 max-w-[64ch] text-[14px] leading-relaxed text-muted-foreground">
          Used when working out how many pieces fit on a sheet. Larger allowances mean fewer pieces per sheet and a
          more cautious price.
        </p>
        <div className="mt-6 grid max-w-xl grid-cols-2 gap-4">
          <Field label="Saw blade width" htmlFor="kerf" hint="Lost between every two pieces.">
            <NumberInput id="kerf" suffix="mm" min={0} max={20} value={settings.kerfMm} onChange={(v) => set({ kerfMm: v })} />
          </Field>
          <Field label="Edge trim" htmlFor="trim" hint="Trimmed off each sheet edge before cutting.">
            <NumberInput id="trim" suffix="mm" min={0} max={50} value={settings.edgeTrimMm} onChange={(v) => set({ edgeTrimMm: v })} />
          </Field>
        </div>
      </section>

      <section aria-labelledby="quick-heading" className="border-t border-border/70 pt-8">
        <h2 id="quick-heading" className="text-[1.5rem]">
          Quick estimate
        </h2>
        <p className="mt-2 max-w-[64ch] text-[14px] leading-relaxed text-muted-foreground">
          The quick estimate fills the customer&rsquo;s wall length with one unit, widest sizes first, and can add a
          second run above it. Choose which units each room uses.
        </p>
        <div className="relative mt-6 overflow-x-auto" data-lenis-prevent>
          <table className="w-full min-w-[720px] border-collapse text-left text-[13.5px]">
            <thead>
              <tr className="text-[12px] text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-normal">Room</th>
                <th scope="col" className="py-2 pr-3 font-normal">Main run</th>
                <th scope="col" className="py-2 pr-3 font-normal">Run above</th>
                <th scope="col" className="py-2 font-normal">Customer sees the option as</th>
              </tr>
            </thead>
            <tbody>
              {catalogue.roomTypes.map((room) => {
                const offered = catalogue.units.filter((u) => u.roomTypes.includes(room.id));
                return (
                  <tr key={room.id} className="border-t border-border/70">
                    <th scope="row" className="py-3 pr-3 font-medium">
                      {room.name}
                    </th>
                    <td className="py-3 pr-3">
                      <select
                        aria-label={`${room.name} main run`}
                        className={inputClass}
                        value={room.quickFill.templateId}
                        onChange={(e) => setQuickFill(room.id, { templateId: e.target.value })}
                      >
                        {offered.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        aria-label={`${room.name} run above`}
                        className={inputClass}
                        value={room.quickFill.upperTemplateId ?? ""}
                        onChange={(e) => setQuickFill(room.id, { upperTemplateId: e.target.value || undefined })}
                      >
                        <option value="">None</option>
                        {offered.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3">
                      <input
                        aria-label={`${room.name} option label`}
                        className={inputClass}
                        value={room.quickFill.upperLabel ?? ""}
                        disabled={!room.quickFill.upperTemplateId}
                        onChange={(e) => setQuickFill(room.id, { upperLabel: e.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
