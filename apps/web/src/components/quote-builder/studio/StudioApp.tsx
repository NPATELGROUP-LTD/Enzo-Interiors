"use client";

// The studio catalogue: where the admin sets up every board, every unit and
// the pricing rules the customer tools run on. Prototype-only access — in
// the real platform this moves into apps/admin behind the Admin role.
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { catalogueStore, useCatalogue, useHydrated } from "@/lib/quote-builder/store";
import { ToolShell } from "../ToolShell";
import { buttonClass } from "../ui";
import { BoardsPanel } from "./BoardsPanel";
import { EstimatesPanel } from "./EstimatesPanel";
import { PricingPanel } from "./PricingPanel";
import { UnitsPanel } from "./UnitsPanel";

const TABS = [
  { id: "boards", label: "Boards" },
  { id: "units", label: "Units" },
  { id: "pricing", label: "Pricing" },
  { id: "estimates", label: "Saved estimates" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function StudioApp() {
  const [tab, setTab] = useState<TabId>("boards");
  const catalogue = useCatalogue();
  const hydrated = useHydrated();

  const reset = () => {
    if (!window.confirm("Put every board, unit and price back to the demo data? Your changes will be lost.")) return;
    catalogueStore.reset();
    toast.success("Demo catalogue restored");
  };

  return (
    <ToolShell
      section="Studio catalogue"
      badge="Staff only"
      actions={
        <button type="button" onClick={reset} className="touch-target text-[13px] font-normal text-muted-foreground hover:text-destructive">
          Reset demo data
        </button>
      }
    >
      <div className="shell py-8 md:py-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-[62ch]">
            <h1 className="text-[clamp(2rem,3.4vw,2.75rem)]">Studio catalogue</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              The boards you cut from, the units customers can place, and how a price is worked out. Changes apply to the
              planner and quick estimate straight away.
            </p>
          </div>
          <Link href="/quote-builder/plan?studio=1" className={buttonClass("secondary", "sm")}>
            Open the planner with costs shown
          </Link>
        </div>

        <div role="tablist" aria-label="Catalogue sections" className="mt-8 flex gap-6 overflow-x-auto border-b border-border/70">
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`tab-${t.id}`}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 pb-3 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-primary",
              )}
            >
              {t.label}
              {t.id === "boards" && hydrated && <Count n={catalogue.boards.length} />}
              {t.id === "units" && hydrated && <Count n={catalogue.units.length} />}
            </button>
          ))}
        </div>

        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="pt-8">
          {!hydrated ? (
            <p className="text-[14px] text-muted-foreground">Loading the catalogue…</p>
          ) : tab === "boards" ? (
            <BoardsPanel catalogue={catalogue} />
          ) : tab === "units" ? (
            <UnitsPanel catalogue={catalogue} />
          ) : tab === "pricing" ? (
            <PricingPanel catalogue={catalogue} />
          ) : (
            <EstimatesPanel />
          )}
        </div>
      </div>
    </ToolShell>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-2 font-display text-[12px] tabular-nums text-muted-foreground">{n}</span>;
}
