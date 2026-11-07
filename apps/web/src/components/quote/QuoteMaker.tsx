"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { Box, Check, PencilRuler, Plus, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";

import { Honeypot } from "@/components/shared/Honeypot";
import {
  LAYOUTS,
  LIMITS,
  clampX,
  estimate as fetchEstimate,
  firstFree,
  frontColour,
  gbp,
  loadCatalogue,
  newUnitId,
  planUnits,
  runs,
  startPlan,
  submitDesign,
  wallCount,
  wallLabel,
  type Answers,
  type Catalogue,
  type CatalogueTemplate,
  type Contact,
  type Estimate,
  type Finish,
  type Layout,
  type Plan,
  type PlanWall,
} from "@/lib/quote-maker";
import { Elevation } from "./Elevation";

const Preview3D = dynamic(() => import("./Preview3D"), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] w-full animate-pulse rounded-2xl border border-border bg-card" />,
});

const INPUT =
  "w-full min-h-12 px-4 py-3 rounded-xl bg-white border border-border text-[16px] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 aria-[invalid=true]:border-destructive";
const PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-7 text-[14px] text-primary-foreground transition-colors hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40";
const SECONDARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-white px-6 text-[14px] text-foreground transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-40";
const EYEBROW = "text-[12px] font-medium uppercase tracking-[0.18em] text-muted-foreground";

type Step = "room" | "size" | "edit" | "details" | "sent";
type Mode = "questions" | "draw";

const blankPlan = (layout: Layout, walls: number[], height_mm: number, island_mm: number | null): Plan => ({
  layout,
  height_mm,
  walls: walls.slice(0, wallCount(layout)).map((length_mm) => ({ length_mm, units: [] })),
  island: island_mm ? { length_mm: island_mm, units: [] } : null,
});

/**
 * The public quote maker (/quote, behind Settings › Pages `quote`): pick a room, answer a few questions
 * or start from a blank wall, arrange units on a to-scale front view (and turn it in 3D), watch the
 * price range the API works out, then send it to the studio as an enquiry with the design on it.
 */
export function QuoteMaker({ phone }: { phone: { display: string; href: string } | null }) {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("room");
  const [room, setRoom] = useState<string>("");
  const [mode, setMode] = useState<Mode>("questions");
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sent, setSent] = useState<Estimate | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    loadCatalogue().then(setCatalogue, (error: Error) => setLoadError(error.message));
  }, []);
  // Each step's heading takes focus, so a screen reader hears where it is (and the page scrolls to it).
  useEffect(() => {
    heading.current?.focus({ preventScroll: false });
  }, [step]);

  const templates = useMemo(() => new Map((catalogue?.templates ?? []).map((t) => [t.id, t])), [catalogue]);
  const finishes = useMemo(() => new Map((catalogue?.finishes ?? []).map((f) => [f.id, f])), [catalogue]);
  const rooms = useMemo(
    () => (catalogue?.room_types ?? []).filter((r) => catalogue!.templates.some((t) => t.mount !== "gap" && t.room_types.includes(r.id))),
    [catalogue],
  );

  if (loadError) return <Shell><Notice title="The quote maker could not load">{loadError} <ContactLine phone={phone} /></Notice></Shell>;
  if (!catalogue) return <Shell><div className="h-64 animate-pulse rounded-2xl bg-muted" aria-label="Loading" /></Shell>;
  if (!rooms.length)
    return <Shell><Notice title="Nothing to design with just yet">We are setting up the units you can choose from. <ContactLine phone={phone} /></Notice></Shell>;

  const roomName = rooms.find((r) => r.id === room)?.name ?? "";

  return (
    <Shell>
      <Progress step={step} />

      {step === "room" ? (
        <section aria-labelledby="qm-room">
          <h2 id="qm-room" ref={heading} tabIndex={-1} className="text-[1.75rem] text-primary focus:outline-none">
            What are we making?
          </h2>
          <p className="mt-2 max-w-[56ch] text-[15px] text-muted-foreground">Pick a room. You can answer a few questions and we will lay it out for you, or draw it yourself.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={room === r.id}
                onClick={() => setRoom(r.id)}
                className={`relative flex min-h-20 items-center rounded-2xl border-2 p-5 text-left text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  room === r.id ? "border-primary bg-primary/5 text-primary" : "border-border bg-white text-foreground hover:border-secondary"
                }`}
              >
                {r.name}
                {room === r.id ? (
                  <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check size={12} aria-hidden />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ModeCard icon={<Sparkles size={22} aria-hidden />} title="Answer a few questions" line="Your wall sizes and a finish; we fill the room with units you then adjust." selected={mode === "questions"} onClick={() => setMode("questions")} />
            <ModeCard icon={<PencilRuler size={22} aria-hidden />} title="Draw it yourself" line="Start from empty walls and add each unit where you want it." selected={mode === "draw"} onClick={() => setMode("draw")} />
          </div>
          <Nav>
            <span />
            <button type="button" className={PRIMARY} disabled={!room} onClick={() => setStep("size")}>
              Continue
            </button>
          </Nav>
        </section>
      ) : null}

      {step === "size" ? (
        <RoomForm
          key={`${room}-${mode}`}
          headingRef={heading}
          room={room}
          roomName={roomName}
          mode={mode}
          catalogue={catalogue}
          initial={answers}
          onBack={() => setStep("room")}
          onReady={(nextPlan, nextAnswers) => {
            setPlan(nextPlan);
            setAnswers(nextAnswers);
            setStep("edit");
          }}
        />
      ) : null}

      {step === "edit" && plan ? (
        <Editor
          headingRef={heading}
          room={room}
          roomName={roomName}
          plan={plan}
          setPlan={(update) => setPlan((p) => (p ? update(p) : p))}
          templates={templates}
          finishes={finishes}
          catalogue={catalogue}
          onBack={() => setStep("size")}
          onNext={() => setStep("details")}
        />
      ) : null}

      {step === "details" && plan ? (
        <Details
          headingRef={heading}
          room={room}
          plan={plan}
          answers={answers}
          onBack={() => setStep("edit")}
          onSent={(result) => {
            setSent(result);
            setStep("sent");
          }}
        />
      ) : null}

      {step === "sent" ? (
        <section aria-labelledby="qm-sent" className="max-w-2xl">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check size={22} aria-hidden />
          </span>
          <h2 id="qm-sent" ref={heading} tabIndex={-1} className="mt-5 text-[2rem] text-primary focus:outline-none">
            Your design is with us
          </h2>
          {sent?.priced && sent.low !== null && sent.high !== null ? (
            <p className="mt-3 text-[17px] text-foreground">
              Your estimate is <strong className="font-semibold text-primary">{gbp(sent.low)} to {gbp(sent.high)}</strong>.
            </p>
          ) : null}
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            We check every design ourselves and will send you a full, fixed quote, usually the same working day. A copy of your estimate is on its way to your inbox.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className={PRIMARY}>Back to the home page</Link>
          </div>
        </section>
      ) : null}
    </Shell>
  );
}

/* ------------------------------------------------------------------ steps */

function RoomForm({
  headingRef,
  room,
  roomName,
  mode,
  catalogue,
  initial,
  onBack,
  onReady,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  room: string;
  roomName: string;
  mode: Mode;
  catalogue: Catalogue;
  initial: Answers | null;
  onBack: () => void;
  onReady: (plan: Plan, answers: Answers | null) => void;
}) {
  const kitchen = room === "kitchen";
  const same = initial?.room_type === room ? initial : null;
  const [layout, setLayout] = useState<Layout>(same?.layout ?? "single");
  const [walls, setWalls] = useState<string[]>((same?.walls ?? [3000, 3000, 3000]).map(String).concat(["3000", "3000", "3000"]).slice(0, 3));
  const [height, setHeight] = useState(String(same?.height_mm ?? 2400));
  const [island, setIsland] = useState(same?.island_mm ? String(same.island_mm) : "");
  const [upper, setUpper] = useState(same?.upper ?? kitchen);
  const [front, setFront] = useState(same?.finishes?.front ?? "");
  const [worktop, setWorktop] = useState(same?.finishes?.worktop ?? "");
  const [gaps, setGaps] = useState<string[]>(same?.gaps ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fronts = catalogue.finishes.filter((f) => f.role === "front");
  const worktops = catalogue.finishes.filter((f) => f.role === "worktop");
  const gapTemplates = catalogue.templates.filter((t) => t.mount === "gap" && t.room_types.includes(room));
  const count = wallCount(layout);
  const n = (value: string) => Math.round(Number(value));
  const inRange = (value: string, min: number, max: number) => value.trim() !== "" && Number.isFinite(Number(value)) && n(value) >= min && n(value) <= max;
  const wallsOk = walls.slice(0, count).every((w) => inRange(w, LIMITS.wall_min, LIMITS.wall_max));
  const heightOk = inRange(height, LIMITS.height_min, LIMITS.height_max);
  const islandOk = !kitchen || island.trim() === "" || inRange(island, LIMITS.island_min, LIMITS.island_max);
  const ok = wallsOk && heightOk && islandOk;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ok || busy) return;
    const lengths = walls.slice(0, count).map(n);
    const islandMm = kitchen && island.trim() ? n(island) : null;
    if (mode === "draw") return onReady(blankPlan(layout, lengths, n(height), islandMm), null);
    const finishes = Object.fromEntries([["front", front], ["worktop", worktop]].filter(([, id]) => id));
    const answers: Answers = { room_type: room, layout, walls: lengths, height_mm: n(height), island_mm: islandMm, upper, finishes, gaps };
    setBusy(true);
    setError(null);
    try {
      onReady(await startPlan(answers), answers);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} aria-labelledby="qm-size" noValidate>
      <p className={EYEBROW}>{roomName}</p>
      <h2 id="qm-size" ref={headingRef} tabIndex={-1} className="mt-2 text-[1.75rem] text-primary focus:outline-none">
        Your room
      </h2>
      <p className="mt-2 max-w-[60ch] text-[15px] text-muted-foreground">
        Measure each wall from corner to corner, in millimetres (3 metres is 3000). Close is fine: we measure properly at the survey.
      </p>

      <fieldset className="mt-6">
        <legend className="text-[14px] text-foreground">Layout</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={layout === l.id}
              onClick={() => setLayout(l.id)}
              className={`min-h-11 rounded-full border px-5 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                layout === l.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white text-foreground hover:border-primary"
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <MmField
            key={i}
            id={`qm-wall-${i}`}
            label={`Wall ${String.fromCharCode(65 + i)} length`}
            value={walls[i]!}
            onChange={(v) => setWalls((all) => all.map((w, j) => (j === i ? v : w)))}
            invalid={!inRange(walls[i]!, LIMITS.wall_min, LIMITS.wall_max)}
            hint={`${LIMITS.wall_min.toLocaleString("en-GB")}–${LIMITS.wall_max.toLocaleString("en-GB")} mm`}
          />
        ))}
        <MmField id="qm-height" label="Ceiling height" value={height} onChange={setHeight} invalid={!heightOk} hint={`${LIMITS.height_min.toLocaleString("en-GB")}–${LIMITS.height_max.toLocaleString("en-GB")} mm`} />
        {kitchen ? (
          <MmField id="qm-island" label="Island length (optional)" value={island} onChange={setIsland} invalid={!islandOk} hint="Leave blank for no island" />
        ) : null}
      </div>

      {mode === "questions" ? (
        <>
          <label className="mt-6 flex min-h-11 items-center gap-3 text-[15px] text-foreground">
            <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} className="h-5 w-5 accent-[#102E2D]" />
            {kitchen ? "Wall cupboards above the worktop" : "Storage above, up to the ceiling"}
          </label>
          {fronts.length ? <SwatchPicker legend="Doors and fronts" options={fronts} value={front} onChange={setFront} /> : null}
          {kitchen && worktops.length ? <SwatchPicker legend="Worktop" options={worktops} value={worktop} onChange={setWorktop} /> : null}
          {gapTemplates.length ? (
            <fieldset className="mt-6">
              <legend className="text-[14px] text-foreground">Leave space for</legend>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                {gapTemplates.map((t) => (
                  <label key={t.id} className="flex min-h-11 items-center gap-3 text-[15px]">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[#102E2D]"
                      checked={gaps.includes(t.id)}
                      onChange={(e) => setGaps((all) => (e.target.checked ? [...all, t.id].slice(0, 6) : all.filter((id) => id !== t.id)))}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </>
      ) : null}

      {error ? <p role="alert" className="mt-5 text-[14px] text-destructive">{error}</p> : null}
      <Nav>
        <button type="button" className={SECONDARY} onClick={onBack}>Back</button>
        <button type="submit" className={PRIMARY} disabled={!ok || busy} aria-busy={busy}>
          {busy ? "Laying it out…" : mode === "questions" ? "Lay out my room" : "Start drawing"}
        </button>
      </Nav>
    </form>
  );
}

function Editor({
  headingRef,
  room,
  roomName,
  plan,
  setPlan,
  templates,
  finishes,
  catalogue,
  onBack,
  onNext,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  room: string;
  roomName: string;
  plan: Plan;
  setPlan: (update: (plan: Plan) => Plan) => void;
  templates: Map<string, CatalogueTemplate>;
  finishes: Map<string, Finish>;
  catalogue: Catalogue;
  onBack: () => void;
  onNext: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [show3d, setShow3d] = useState(false);
  const [price, setPrice] = useState<{ state: "idle" | "loading" | "done" | "error"; result?: Estimate; message?: string }>({ state: "idle" });

  const roomTemplates = catalogue.templates.filter((t) => t.room_types.includes(room));
  const colourOf = useCallback((unit: PlanWall["units"][number], template: CatalogueTemplate) => frontColour(unit, template, finishes), [finishes]);
  const count = planUnits(plan).length;

  // The range follows the design, debounced; a newer request cancels the one in flight.
  useEffect(() => {
    if (!count) return; // the panel says "Add a unit" without asking
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setPrice((p) => ({ ...p, state: "loading" }));
      fetchEstimate(plan, controller.signal).then(
        (result) => setPrice({ state: "done", result }),
        (error: Error) => error.name !== "AbortError" && setPrice({ state: "error", message: error.message }),
      );
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [plan, count]);

  const updateRun = (index: number, update: (wall: PlanWall) => PlanWall) =>
    setPlan((p) => {
      if (index < p.walls.length) return { ...p, walls: p.walls.map((w, i) => (i === index ? update(w) : w)) };
      return p.island ? { ...p, island: update(p.island) } : p;
    });
  const widthOf = (unit: PlanWall["units"][number]) => templates.get(unit.template_id)?.variants.find((v) => v.id === unit.variant_id)?.width_mm ?? 0;
  const findUnit = (id: string | null) => {
    if (!id) return null;
    for (const [index, wall] of runs(plan).entries()) {
      const unit = wall.units.find((u) => u.id === id);
      if (unit) return { index, wall, unit, template: templates.get(unit.template_id) };
    }
    return null;
  };
  const current = findUnit(selected);

  const setLength = (index: number, length_mm: number) =>
    updateRun(index, (wall) => ({ length_mm, units: wall.units.map((u) => ({ ...u, x_mm: clampX(u.x_mm, widthOf(u), length_mm) })) }));
  const removeUnit = (id: string) => {
    const at = findUnit(id);
    if (!at) return;
    updateRun(at.index, (wall) => ({ ...wall, units: wall.units.filter((u) => u.id !== id) }));
    setSelected(null);
  };
  const patchUnit = (id: string, patch: Partial<PlanWall["units"][number]>) => {
    const at = findUnit(id);
    if (at) updateRun(at.index, (wall) => ({ ...wall, units: wall.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
  };

  // A run's length can't go below its units; the API refuses a unit off its wall anyway.
  const overflow = runs(plan).some((wall) => wall.units.some((u) => u.x_mm + widthOf(u) > wall.length_mm));

  return (
    <section aria-labelledby="qm-edit">
      <p className={EYEBROW}>{roomName}</p>
      <h2 id="qm-edit" ref={headingRef} tabIndex={-1} className="mt-2 text-[1.75rem] text-primary focus:outline-none">
        Arrange your units
      </h2>
      <p className="mt-2 max-w-[62ch] text-[15px] text-muted-foreground">
        Drag a unit along its wall, or select it and use the arrow keys. Pick a unit to change its size or finish.
      </p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-8">
          {runs(plan).map((wall, index) => (
            <div key={index}>
              <Elevation
                label={wallLabel(plan, index)}
                wall={wall}
                ceiling_mm={plan.height_mm}
                templates={templates}
                colourOf={colourOf}
                selectedId={selected}
                onSelect={setSelected}
                onMove={(id, x_mm) => patchUnit(id, { x_mm })}
                onRemove={removeUnit}
              />
              <RunTools
                wall={wall}
                isIsland={index >= plan.walls.length}
                templates={roomTemplates}
                widthOf={widthOf}
                onLength={(length) => setLength(index, length)}
                onAdd={(template, variantId) => {
                  const variant = template.variants.find((v) => v.id === variantId)!;
                  const others = wall.units.map((u) => [u.x_mm, widthOf(u), templates.get(u.template_id)?.mount ?? "floor"] as [number, number, CatalogueTemplate["mount"]]);
                  const x = firstFree(others, variant.width_mm, template.mount, wall.length_mm);
                  if (x === null) return false;
                  const id = newUnitId();
                  updateRun(index, (w) => ({ ...w, units: [...w.units, { id, template_id: template.id, variant_id: variant.id, x_mm: x }] }));
                  setSelected(id);
                  return true;
                }}
              />
            </div>
          ))}

          <div>
            <button type="button" className={SECONDARY} aria-expanded={show3d} onClick={() => setShow3d((s) => !s)}>
              <Box size={16} aria-hidden /> {show3d ? "Hide 3D view" : "Show in 3D"}
            </button>
            {show3d ? <div className="mt-4"><Preview3D plan={plan} templates={templates} colourOf={colourOf} /></div> : null}
          </div>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl bg-primary p-6 text-primary-foreground" aria-live="polite">
            <p className="text-[12px] uppercase tracking-[0.18em] text-primary-foreground/70">Estimate</p>
            {!count ? (
              <p className="mt-2 text-[15px] text-primary-foreground/80">Add a unit to see a price.</p>
            ) : price.state === "error" ? (
              <p className="mt-2 text-[15px]">{price.message}</p>
            ) : price.result && !price.result.priced ? (
              <p className="mt-2 text-[15px]">We will price this one for you. Send it and we will reply with a quote.</p>
            ) : price.result ? (
              <p className={`mt-2 font-title text-[2rem] leading-tight tabular-nums transition-opacity ${price.state === "loading" ? "opacity-60" : ""}`}>
                {gbp(price.result.low!)} – {gbp(price.result.high!)}
              </p>
            ) : (
              <p className="mt-2 text-[15px] text-primary-foreground/80">Working it out…</p>
            )}
            <p className="mt-3 text-[13px] leading-relaxed text-primary-foreground/70">
              Made and fitted, from the materials you picked. A guide, not a quote: we confirm it after a free survey.
            </p>
          </div>

          {current?.template ? (
            <UnitPanel
              key={current.unit.id}
              unit={current.unit}
              template={current.template}
              finishes={catalogue.finishes}
              fits={(width) => current.unit.x_mm + width <= current.wall.length_mm}
              onChange={(patch) => patchUnit(current.unit.id, patch)}
              onRemove={() => removeUnit(current.unit.id)}
            />
          ) : (
            <p className="rounded-2xl border border-dashed border-border p-5 text-[14px] text-muted-foreground">
              Select a unit on a wall to change its size or finish.
            </p>
          )}
        </aside>
      </div>

      {overflow ? <p role="alert" className="mt-5 text-[14px] text-destructive">A unit runs past the end of its wall. Move it, or make the wall longer.</p> : null}
      <Nav>
        <button type="button" className={SECONDARY} onClick={onBack}>Back</button>
        <button type="button" className={PRIMARY} disabled={!count || overflow} onClick={onNext}>
          Send to the studio
        </button>
      </Nav>
    </section>
  );
}

function RunTools({
  wall,
  isIsland,
  templates,
  widthOf,
  onLength,
  onAdd,
}: {
  wall: PlanWall;
  isIsland: boolean;
  templates: CatalogueTemplate[];
  widthOf: (unit: PlanWall["units"][number]) => number;
  onLength: (length: number) => void;
  onAdd: (template: CatalogueTemplate, variantId: string) => boolean;
}) {
  const choices = templates.filter((t) => !isIsland || t.mount === "floor");
  const [templateId, setTemplateId] = useState(choices[0]?.id ?? "");
  const template = choices.find((t) => t.id === templateId);
  const [variantId, setVariantId] = useState(template?.variants[0]?.id ?? "");
  const [length, setLengthText] = useState(String(wall.length_mm));
  const [full, setFull] = useState(false);
  const min = Math.max(isIsland ? LIMITS.island_min : LIMITS.wall_min, ...wall.units.map(widthOf));
  const max = isIsland ? LIMITS.island_max : LIMITS.wall_max;

  const commit = () => {
    const value = Math.round(Number(length));
    if (Number.isFinite(value) && value >= min && value <= max) onLength(value);
    else setLengthText(String(wall.length_mm));
  };

  return (
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <label className="w-36 text-[13px] text-muted-foreground">
        Length (mm)
        <input className={`${INPUT} mt-1 min-h-11 py-2`} inputMode="numeric" value={length} onChange={(e) => setLengthText(e.target.value.replace(/[^\d]/g, ""))} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())} />
      </label>
      {choices.length ? (
        <>
          <label className="min-w-48 flex-1 text-[13px] text-muted-foreground">
            Unit
            <select
              className={`${INPUT} mt-1 min-h-11 py-2`}
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setVariantId(choices.find((t) => t.id === e.target.value)?.variants[0]?.id ?? "");
                setFull(false);
              }}
            >
              {choices.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="w-32 text-[13px] text-muted-foreground">
            Width
            <select className={`${INPUT} mt-1 min-h-11 py-2`} value={variantId} onChange={(e) => (setVariantId(e.target.value), setFull(false))}>
              {template?.variants.map((v) => (
                <option key={v.id} value={v.id}>{v.width_mm} mm</option>
              ))}
            </select>
          </label>
          <button type="button" className={SECONDARY} disabled={!template || !variantId} onClick={() => template && setFull(!onAdd(template, variantId))}>
            <Plus size={16} aria-hidden /> Add
          </button>
        </>
      ) : null}
      {full ? <p role="status" className="w-full text-[13px] text-destructive">No space for that width on this wall. Make room, or pick a narrower one.</p> : null}
    </div>
  );
}

function UnitPanel({
  unit,
  template,
  finishes,
  fits,
  onChange,
  onRemove,
}: {
  unit: PlanWall["units"][number];
  template: CatalogueTemplate;
  finishes: Finish[];
  fits: (width: number) => boolean;
  onChange: (patch: Partial<PlanWall["units"][number]>) => void;
  onRemove: () => void;
}) {
  const setFinish = (slot: string, id: string) => {
    const next = { ...(unit.finishes ?? {}) };
    if (id) next[slot] = id;
    else delete next[slot];
    onChange({ finishes: Object.keys(next).length ? next : undefined });
  };
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <p className="text-[16px] font-medium text-primary">{template.name}</p>
      {template.description ? <p className="mt-1 text-[14px] text-muted-foreground">{template.description}</p> : null}
      {template.variants.length > 1 ? (
        <label className="mt-4 block text-[13px] text-muted-foreground">
          Width
          <select className={`${INPUT} mt-1 min-h-11 py-2`} value={unit.variant_id} onChange={(e) => onChange({ variant_id: e.target.value })}>
            {template.variants.map((v) => (
              <option key={v.id} value={v.id} disabled={!fits(v.width_mm)}>
                {v.width_mm} mm{fits(v.width_mm) ? "" : " (no room)"}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {template.slots.map((slot) => {
        const options = finishes.filter((f) => slot.roles.includes(f.role));
        if (!options.length) return null;
        return (
          <label key={slot.key} className="mt-4 block text-[13px] text-muted-foreground">
            {slot.label}
            <select className={`${INPUT} mt-1 min-h-11 py-2`} value={unit.finishes?.[slot.key] ?? ""} onChange={(e) => setFinish(slot.key, e.target.value)}>
              <option value="">Our standard</option>
              {options.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>
        );
      })}
      <button type="button" onClick={onRemove} className="mt-5 inline-flex min-h-11 items-center gap-2 text-[14px] text-destructive underline-offset-4 hover:underline">
        <Trash2 size={16} aria-hidden /> Remove this unit
      </button>
    </div>
  );
}

function Details({
  headingRef,
  room,
  plan,
  answers,
  onBack,
  onSent,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  room: string;
  plan: Plan;
  answers: Answers | null;
  onBack: () => void;
  onSent: (result: Estimate | null) => void;
}) {
  const [contact, setContact] = useState<Contact>({ name: "", email: "", phone: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const set = (key: keyof Contact) => (value: string) => setContact((c) => ({ ...c, [key]: value }));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim());
  const ok = contact.name.trim().length > 0 && emailOk;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      onSent((await submitDesign(room, plan, answers, contact)) ?? null);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} aria-labelledby="qm-details" noValidate className="relative max-w-2xl">
      <h2 id="qm-details" ref={headingRef} tabIndex={-1} className="text-[1.75rem] text-primary focus:outline-none">
        Where should we send your quote?
      </h2>
      <p className="mt-2 text-[15px] text-muted-foreground">We will check your design and reply with a full quote. We only use these details to answer you.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <TextField id="qm-name" label="Name" value={contact.name} onChange={set("name")} autoComplete="name" maxLength={120} invalid={touched && !contact.name.trim()} />
        <TextField id="qm-email" label="Email" type="email" value={contact.email} onChange={set("email")} autoComplete="email" maxLength={254} invalid={touched && !emailOk} />
        <TextField id="qm-phone" label="Phone (optional)" type="tel" value={contact.phone} onChange={set("phone")} autoComplete="tel" maxLength={40} />
      </div>
      <label htmlFor="qm-message" className="mt-4 block text-[14px] text-foreground">
        Anything else we should know? (optional)
        <textarea id="qm-message" rows={4} maxLength={5000} className={`${INPUT} mt-1.5`} value={contact.message} onChange={(e) => set("message")(e.target.value)} />
      </label>
      <Honeypot value={contact.website} onChange={set("website")} />
      {error ? <p role="alert" className="mt-5 text-[14px] text-destructive">{error}</p> : null}
      <Nav>
        <button type="button" className={SECONDARY} onClick={onBack} disabled={busy}>Back</button>
        <button type="submit" className={PRIMARY} disabled={busy} aria-busy={busy}>
          {busy ? "Sending…" : "Send my design"}
        </button>
      </Nav>
    </form>
  );
}

/* ---------------------------------------------------------------- pieces */

function Shell({ children }: { children: ReactNode }) {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-32 sm:px-6 md:px-12 md:pt-40">
        <p className={EYEBROW}>Design &amp; price</p>
        <h1 className="mt-3 max-w-[18ch] font-title text-[clamp(2.25rem,5vw,3.75rem)] font-medium leading-[1.04] tracking-[-0.03em] text-primary">
          Design your room, see a price.
        </h1>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

const STEPS: Array<[Step, string]> = [
  ["room", "Room"],
  ["size", "Sizes"],
  ["edit", "Design"],
  ["details", "Send"],
];

function Progress({ step }: { step: Step }) {
  const at = step === "sent" ? STEPS.length : STEPS.findIndex(([s]) => s === step);
  return (
    <ol className="mb-8 flex items-center gap-2 text-[13px]" aria-label="Progress">
      {STEPS.map(([id, label], i) => (
        <li key={id} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={i === at ? "step" : undefined}>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] ${i <= at ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
            {i < at ? <Check size={13} aria-hidden /> : i + 1}
          </span>
          <span className={`hidden whitespace-nowrap sm:inline ${i <= at ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
          {i < STEPS.length - 1 ? <span className={`h-px flex-1 ${i < at ? "bg-primary" : "bg-border"}`} /> : null}
        </li>
      ))}
    </ol>
  );
}

function Nav({ children }: { children: ReactNode }) {
  return <div className="mt-10 flex items-center justify-between gap-4 border-t border-border/60 pt-5">{children}</div>;
}

function ModeCard({ icon, title, line, selected, onClick }: { icon: ReactNode; title: string; line: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex items-start gap-4 rounded-2xl border-2 p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
        selected ? "border-primary bg-primary/5" : "border-border bg-white hover:border-secondary"
      }`}
    >
      <span className={selected ? "text-primary" : "text-secondary"}>{icon}</span>
      <span>
        <span className={`block text-[15px] font-medium ${selected ? "text-primary" : "text-foreground"}`}>{title}</span>
        <span className="mt-1 block text-[14px] text-muted-foreground">{line}</span>
      </span>
    </button>
  );
}

function MmField({ id, label, value, onChange, invalid, hint }: { id: string; label: string; value: string; onChange: (v: string) => void; invalid: boolean; hint: string }) {
  return (
    <label htmlFor={id} className="block text-[14px] text-foreground">
      {label}
      <span className="relative mt-1.5 block">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          className={`${INPUT} pr-12 tabular-nums`}
          value={value}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-muted-foreground">mm</span>
      </span>
      <span id={`${id}-hint`} className={`mt-1 block text-[12px] ${invalid ? "text-destructive" : "text-muted-foreground"}`}>{hint}</span>
    </label>
  );
}

function TextField({ id, label, value, onChange, invalid, type = "text", autoComplete, maxLength }: { id: string; label: string; value: string; onChange: (v: string) => void; invalid?: boolean; type?: string; autoComplete?: string; maxLength?: number }) {
  return (
    <label htmlFor={id} className="block text-[14px] text-foreground">
      {label}
      <input id={id} type={type} autoComplete={autoComplete} maxLength={maxLength} className={`${INPUT} mt-1.5`} value={value} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function SwatchPicker({ legend, options, value, onChange }: { legend: string; options: Finish[]; value: string; onChange: (id: string) => void }) {
  const all = [{ id: "", name: "Our standard", swatch: null as string | null, image: null as string | null }, ...options];
  return (
    <fieldset className="mt-6">
      <legend className="text-[14px] text-foreground">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {all.map((f) => (
          <button
            key={f.id || "standard"}
            type="button"
            aria-pressed={value === f.id}
            onClick={() => onChange(f.id)}
            className={`flex min-h-11 items-center gap-2.5 rounded-full border py-1.5 pl-1.5 pr-4 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              value === f.id ? "border-primary bg-primary/5 text-primary" : "border-border bg-white text-foreground hover:border-primary"
            }`}
          >
            <span
              aria-hidden
              className="h-8 w-8 shrink-0 rounded-full border border-black/10 bg-muted bg-cover bg-center"
              style={{ backgroundColor: f.swatch ?? undefined, backgroundImage: f.image ? `url(${JSON.stringify(f.image)})` : undefined }}
            />
            {f.name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="max-w-2xl rounded-2xl border border-border bg-card p-6">
      <h2 className="text-[1.4rem] text-primary">{title}</h2>
      <p className="mt-2 text-[15px] text-muted-foreground">{children}</p>
    </div>
  );
}

function ContactLine({ phone }: { phone: { display: string; href: string } | null }) {
  return (
    <>
      You can still <Link href="/contact" className="text-primary underline underline-offset-4">send us an enquiry</Link>
      {phone ? <> or call <a href={phone.href} className="text-primary underline underline-offset-4">{phone.display}</a></> : null}.
    </>
  );
}
