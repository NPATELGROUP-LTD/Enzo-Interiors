import { describe, expect, it } from "vitest";
import { computeEstimate, type PricedUnit } from "./pricing";
import { buildQuickPlan, fillRun } from "./quick";
import { seedCatalogue } from "./seed";

const catalogue = seedCatalogue();

const base = (id: string, materials: Record<string, string> = {}): PricedUnit => ({
  id,
  templateId: "base-cabinet",
  variantId: "base-cabinet-600",
  materials,
});

describe("computeEstimate", () => {
  it("returns zeros for an empty plan", () => {
    const estimate = computeEstimate([], catalogue);
    expect(estimate.pricePence).toBe(0);
    expect(estimate.sheetCount).toBe(0);
    expect(estimate.lines).toEqual([]);
  });

  const price = (id: string) => catalogue.boards.find((b) => b.id === id)!.pricePence;
  const baseExtras = catalogue.units.find((u) => u.id === "base-cabinet")!.extrasPence;

  it("adds extras to board cost and marks the total up by the margin", () => {
    const estimate = computeEstimate([base("a")], catalogue);
    expect(estimate.extrasCostPence).toBe(baseExtras);
    expect(estimate.costPence).toBe(estimate.boardsCostPence + baseExtras);
    expect(estimate.pricePence).toBe(Math.round(estimate.costPence * 1.7));
    expect(estimate.lowPence % 5000).toBe(0);
    expect(estimate.highPence % 5000).toBe(0);
    expect(estimate.lowPence).toBeLessThan(estimate.pricePence);
    expect(estimate.highPence).toBeGreaterThan(estimate.pricePence);
  });

  it("charges each board used by a single cabinet in full", () => {
    const estimate = computeEstimate([base("a")], catalogue);
    // One sheet each of carcass, front and worktop.
    expect(estimate.boards).toHaveLength(3);
    expect(estimate.boards.every((b) => b.sheetCount === 1)).toBe(true);
    expect(estimate.boardsCostPence).toBe(price("brd-mfc-white") + price("brd-mdf-forest") + price("brd-wt-quartz"));
  });

  it("shares boards between units of the same material", () => {
    const one = computeEstimate([base("a")], catalogue);
    const three = computeEstimate([base("a"), base("b"), base("c")], catalogue);
    expect(three.boardsCostPence).toBeLessThan(one.boardsCostPence * 3);
  });

  it("changes price, not cost, when the margin changes", () => {
    const lower = { ...catalogue, settings: { ...catalogue.settings, marginPct: 40 } };
    const a = computeEstimate([base("a")], catalogue);
    const b = computeEstimate([base("a")], lower);
    expect(b.costPence).toBe(a.costPence);
    expect(b.pricePence).toBe(Math.round(a.costPence * 1.4));
  });

  it("splits the price across units so the lines add back up", () => {
    const units = [base("a"), base("b", { front: "brd-oak-veneer" }), { ...base("c"), templateId: "drawer-pack", variantId: "drawer-pack-800" }];
    const estimate = computeEstimate(units, catalogue);
    const sum = estimate.lines.reduce((total, line) => total + line.pricePence, 0);
    expect(Math.abs(sum - estimate.pricePence)).toBeLessThanOrEqual(units.length);
  });

  it("falls back to the slot default when a chosen board is not allowed", () => {
    const wrong = computeEstimate([base("a", { front: "brd-wt-oak" })], catalogue);
    const plain = computeEstimate([base("a")], catalogue);
    expect(wrong.costPence).toBe(plain.costPence);
  });

  it("warns when a unit no longer exists in the catalogue", () => {
    const estimate = computeEstimate([{ ...base("a"), templateId: "gone" }], catalogue);
    expect(estimate.warnings).toHaveLength(1);
    expect(estimate.pricePence).toBe(0);
  });
});

describe("quick estimate", () => {
  it("fills a wall widest-first", () => {
    const template = catalogue.units.find((u) => u.id === "base-cabinet")!;
    expect(fillRun(template, 3600).map((v) => v.widthMm)).toEqual([1000, 1000, 1000, 600]);
    expect(fillRun(template, 250)).toEqual([]);
  });

  it("builds a plan with an optional upper run in the chosen finish", () => {
    const plan = buildQuickPlan(catalogue, {
      roomType: "kitchens",
      lengthMm: 3600,
      frontBoardId: "brd-oak-veneer",
      includeUpper: true,
    });
    expect(plan.units).toHaveLength(8);
    expect(plan.units.every((u) => u.materials.front === "brd-oak-veneer")).toBe(true);
    expect(plan.room.widthMm).toBeGreaterThanOrEqual(3600);
  });
});
