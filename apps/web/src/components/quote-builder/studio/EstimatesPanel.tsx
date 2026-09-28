"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { pounds } from "@/lib/quote-builder/format";
import { estimatesStore, planStore, useCatalogue, useEstimates } from "@/lib/quote-builder/store";
import { buttonClass } from "../ui";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Estimates customers saved in this browser. Figures are the ones they were
 * shown at the time — a snapshot, like a quote line item — not repriced
 * against today's catalogue.
 */
export function EstimatesPanel() {
  const estimates = useEstimates();
  const catalogue = useCatalogue();
  const router = useRouter();

  const open = (id: string) => {
    const saved = estimates.find((e) => e.id === id);
    if (!saved) return;
    planStore.write(saved.plan);
    router.push("/quote-builder/plan?studio=1&step=layout");
  };

  const remove = (id: string) => {
    if (!window.confirm("Delete this saved estimate?")) return;
    estimatesStore.update((list) => list.filter((e) => e.id !== id));
  };

  return (
    <section aria-labelledby="estimates-heading">
      <h2 id="estimates-heading" className="text-[1.5rem]">
        Saved estimates
      </h2>
      <p className="mt-2 max-w-[64ch] text-[14px] leading-relaxed text-muted-foreground">
        Estimates saved from the planner and the quick estimate on this device. In the full platform they arrive in
        Quotes with the customer&rsquo;s details attached.
      </p>

      {estimates.length === 0 ? (
        <p className="mt-6 border-t border-border/70 pt-6 text-[14px] text-muted-foreground">
          Nothing saved yet. Save an estimate from the planner to see it here.
        </p>
      ) : (
        <div className="relative mt-6 overflow-x-auto" data-lenis-prevent>
          <table className="w-full min-w-[820px] border-collapse text-left text-[13.5px]">
            <thead>
              <tr className="text-[12px] text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-normal">Reference</th>
                <th scope="col" className="py-2 pr-3 font-normal">Saved</th>
                <th scope="col" className="py-2 pr-3 font-normal">Room</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Units</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Sheets</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Cost</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Shown to customer</th>
                <th scope="col" className="py-2 font-normal"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((e) => (
                <tr key={e.id} className="border-t border-border/70">
                  <td className="py-3 pr-3 font-display font-medium tabular-nums text-primary">{e.reference}</td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {DATE.format(new Date(e.createdAt))}
                    <span className="block text-[12px]">{e.source === "quick" ? "Quick estimate" : "Planner"}</span>
                  </td>
                  <td className="py-3 pr-3">
                    {catalogue.roomTypes.find((r) => r.id === e.plan.room.type)?.singular ?? e.plan.room.type}
                  </td>
                  <td className="py-3 pr-3 text-right font-display tabular-nums">{e.plan.units.length}</td>
                  <td className="py-3 pr-3 text-right font-display tabular-nums">{e.sheetCount}</td>
                  <td className="py-3 pr-3 text-right font-display tabular-nums">{pounds(e.costPence)}</td>
                  <td className="py-3 pr-3 text-right font-display tabular-nums">
                    {pounds(e.lowPence)} – {pounds(e.highPence)}
                  </td>
                  <td className="py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => open(e.id)} className={buttonClass("secondary", "sm")}>
                        Open plan
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(e.id)}
                        aria-label={`Delete ${e.reference}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
