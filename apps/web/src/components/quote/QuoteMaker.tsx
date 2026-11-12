"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, PencilRuler, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { Honeypot } from "@/components/shared/Honeypot";
import {
  CUSTOM_ROOM,
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
  type Mount,
  type Plan,
  type PlanWall,
  type Room,
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
const CHIP =
  "min-h-11 rounded-full border px-5 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
const chip = (on: boolean) => `${CHIP} ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white text-foreground hover:border-primary"}`;

type Step = "room" | "size" | "edit" | "details" | "sent";
type Mode = "questions" | "draw";
type Unit = PlanWall["units"][number];

/** What differs by room in the questions: the "storage above" wording and default, and what a layout is called. */
const ROOM_COPY: Record<string, { upper: string; upperOn?: boolean; layouts?: Partial<Record<Layout, string>> }> = {
  kitchen: { upper: "Wall cupboards above the worktop", upperOn: true },
  bedroom: { upper: "Top boxes above the wardrobes, up to the ceiling" },
  "media-wall": { upper: "Shelves above the low units" },
  office: { upper: "Shelving above the desk", upperOn: true },
  alcove: { upper: "Shelves above the cupboard", upperOn: true, layouts: { single: "One alcove", galley: "Two alcoves" } },
};
const MOUNT_NAME: Record<Mount, string> = { floor: "Floor unit", wall: "Wall unit", tall: "Full height", gap: "Space, not priced" };

const blankPlan = (layout: Layout, walls: number[], height_mm: number, island_mm: number | null): Plan => ({
  layout,
  height_mm,
  walls: walls.slice(0, wallCount(layout)).map((length_mm) => ({ length_mm, units: [] })),
  island: island_mm ? { length_mm: island_mm, units: [] } : null,
});

/**
 * The public quote maker (/quote, behind Settings › Pages `quote`): pick one or more rooms and answer a
 * few questions, or start from a blank room of any size; arrange units on a to-scale front view beside
 * a 3D model in one full-screen designer, watch the price range the API works out, then send it to the
 * studio as one enquiry with a design per room.
 */
export function QuoteMaker({ phone }: { phone: { display: string; href: string } | null }) {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("room");
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<Mode>("questions");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [sizing, setSizing] = useState(0); // the room the Sizes step is asking about
  const [active, setActive] = useState(0); // the room the designer shows
  const [sent, setSent] = useState<Estimate | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    loadCatalogue().then(setCatalogue, (error: Error) => setLoadError(error.message));
  }, []);
  // Each step's heading takes focus, so a screen reader hears where it is (and the page scrolls to it).
  useEffect(() => {
    heading.current?.focus({ preventScroll: false });
  }, [step, sizing]);

  const templates = useMemo(() => new Map((catalogue?.templates ?? []).map((t) => [t.id, t])), [catalogue]);
  const finishes = useMemo(() => new Map((catalogue?.finishes ?? []).map((f) => [f.id, f])), [catalogue]);
  const roomTypes = useMemo(
    () => (catalogue?.room_types ?? []).filter((r) => catalogue!.templates.some((t) => t.mount !== "gap" && t.room_types.includes(r.id))),
    [catalogue],
  );

  if (loadError) return <Shell><Notice title="The quote maker could not load">{loadError} <ContactLine phone={phone} /></Notice></Shell>;
  if (!catalogue) return <Shell><div className="h-64 animate-pulse rounded-2xl bg-muted" aria-label="Loading" /></Shell>;
  if (!roomTypes.length)
    return <Shell><Notice title="Nothing to design with just yet">We are setting up the units you can choose from. <ContactLine phone={phone} /></Notice></Shell>;

  // The rooms being designed: every one picked, or one blank room when drawing.
  const wanted = mode === "draw" ? [{ id: CUSTOM_ROOM, name: "Your room", layouts: undefined }] : roomTypes.filter((r) => picked.includes(r.id));
  const target = wanted[Math.min(sizing, wanted.length - 1)];

  return (
    <Shell>
      <Progress step={step} />

      {step === "room" ? (
        <section aria-labelledby="qm-room">
          <h2 id="qm-room" ref={heading} tabIndex={-1} className="text-[1.75rem] text-primary focus:outline-none">
            What are we making?
          </h2>
          <p className="mt-2 max-w-[56ch] text-[15px] text-muted-foreground">Answer a few questions and we lay each room out for you, or start from a blank room and draw it yourself.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ModeCard icon={<Sparkles size={22} aria-hidden />} title="Answer a few questions" line="Your wall sizes and a finish; we fill the room with units you then adjust." selected={mode === "questions"} onClick={() => setMode("questions")} />
            <ModeCard icon={<PencilRuler size={22} aria-hidden />} title="Draw it yourself" line="A blank room of any size. Add whichever units you like, wherever you want them." selected={mode === "draw"} onClick={() => setMode("draw")} />
          </div>
          {mode === "questions" ? (
            <fieldset className="mt-8">
              <legend className="text-[15px] font-medium text-foreground">
                Which rooms? <span className="font-normal text-muted-foreground">Pick one or more.</span>
              </legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {roomTypes.map((r) => {
                  const on = picked.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setPicked((all) => (on ? all.filter((id) => id !== r.id) : [...all, r.id]))}
                      className={`relative flex min-h-20 items-center rounded-2xl border-2 p-5 pr-12 text-left text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                        on ? "border-primary bg-primary/5 text-primary" : "border-border bg-white text-foreground hover:border-secondary"
                      }`}
                    >
                      {r.name}
                      {on ? (
                        <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check size={12} aria-hidden />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          <Nav>
            <span />
            <button
              type="button"
              className={PRIMARY}
              disabled={!wanted.length}
              onClick={() => {
                setRooms((all) => all.filter((room) => wanted.some((w) => w.id === room.type)));
                setSizing(0);
                setStep("size");
              }}
            >
              Continue
            </button>
          </Nav>
        </section>
      ) : null}

      {step === "size" && target ? (
        <RoomForm
          key={`${target.id}-${mode}`}
          headingRef={heading}
          target={target}
          count={wanted.length > 1 ? `Room ${sizing + 1} of ${wanted.length}` : null}
          mode={mode}
          catalogue={catalogue}
          initial={rooms.find((room) => room.type === target.id)?.answers ?? null}
          onBack={() => (sizing > 0 ? setSizing(sizing - 1) : setStep("room"))}
          onReady={(plan, answers) => {
            const room: Room = { key: target.id, type: target.id, name: target.name, plan, answers };
            const next = wanted.flatMap((w) => (w.id === target.id ? [room] : rooms.filter((r) => r.type === w.id)));
            setRooms(next);
            // On to the next room that has no sizes yet; a room already laid out keeps its design.
            const missing = wanted.findIndex((w, i) => i > sizing && !next.some((r) => r.type === w.id));
            if (missing >= 0) return setSizing(missing);
            setActive(next.indexOf(room));
            setStep("edit");
          }}
        />
      ) : null}

      {step === "edit" && rooms.length ? (
        <Editor
          headingRef={heading}
          rooms={rooms}
          active={Math.min(active, rooms.length - 1)}
          setActive={setActive}
          setPlan={(key, update) => setRooms((all) => all.map((room) => (room.key === key ? { ...room, plan: update(room.plan) } : room)))}
          templates={templates}
          finishes={finishes}
          catalogue={catalogue}
          onBack={() => {
            setSizing(Math.max(0, wanted.findIndex((w) => w.id === rooms[Math.min(active, rooms.length - 1)]?.type)));
            setStep("size");
          }}
          onNext={() => setStep("details")}
        />
      ) : null}

      {step === "details" && rooms.length ? (
        <Details
          headingRef={heading}
          rooms={rooms}
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
  target,
  count,
  mode,
  catalogue,
  initial,
  onBack,
  onReady,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  target: { id: string; name: string; layouts?: Layout[] };
  /** "Room 2 of 3" when several rooms are being sized. */
  count: string | null;
  mode: Mode;
  catalogue: Catalogue;
  initial: Answers | null;
  onBack: () => void;
  onReady: (plan: Plan, answers: Answers | null) => void;
}) {
  const room = target.id;
  const copy = ROOM_COPY[room];
  // A kitchen can have an island; so can a blank room, where anything goes.
  const islandAllowed = room === "kitchen" || room === CUSTOM_ROOM;
  const layouts = LAYOUTS.filter((l) => !target.layouts || target.layouts.includes(l.id));
  const [layout, setLayout] = useState<Layout>(initial?.layout ?? layouts[0]!.id);
  const [walls, setWalls] = useState<string[]>((initial?.walls ?? [3000, 3000, 3000]).map(String).concat(["3000", "3000", "3000"]).slice(0, 3));
  const [height, setHeight] = useState(String(initial?.height_mm ?? 2400));
  const [island, setIsland] = useState(initial?.island_mm ? String(initial.island_mm) : "");
  const [upper, setUpper] = useState(initial?.upper ?? copy?.upperOn ?? false);
  const [front, setFront] = useState(initial?.finishes?.front ?? "");
  const [worktop, setWorktop] = useState(initial?.finishes?.worktop ?? "");
  const [gaps, setGaps] = useState<string[]>(initial?.gaps ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forRoom = catalogue.templates.filter((t) => t.room_types.includes(room));
  const fronts = catalogue.finishes.filter((f) => f.role === "front");
  const worktops = forRoom.some((t) => t.structure.worktop) ? catalogue.finishes.filter((f) => f.role === "worktop") : [];
  const gapTemplates = forRoom.filter((t) => t.mount === "gap");
  const hasUpper = forRoom.some((t) => t.mount === "wall");
  const count_ = wallCount(layout);
  const n = (value: string) => Math.round(Number(value));
  const inRange = (value: string, min: number, max: number) => value.trim() !== "" && Number.isFinite(Number(value)) && n(value) >= min && n(value) <= max;
  const wallsOk = walls.slice(0, count_).every((w) => inRange(w, LIMITS.wall_min, LIMITS.wall_max));
  const heightOk = inRange(height, LIMITS.height_min, LIMITS.height_max);
  const islandOk = !islandAllowed || island.trim() === "" || inRange(island, LIMITS.island_min, LIMITS.island_max);
  const ok = wallsOk && heightOk && islandOk;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ok || busy) return;
    const lengths = walls.slice(0, count_).map(n);
    const islandMm = islandAllowed && island.trim() ? n(island) : null;
    if (mode === "draw") return onReady(blankPlan(layout, lengths, n(height), islandMm), null);
    const finishes = Object.fromEntries([["front", front], ["worktop", worktop]].filter(([, id]) => id));
    const answers: Answers = { room_type: room, layout, walls: lengths, height_mm: n(height), island_mm: islandMm, upper: hasUpper && upper, finishes, gaps };
    setBusy(true);
    setError(null);
    try {
      const plan = await startPlan(answers);
      // A plan with nothing in it would strand the visitor in the designer with Send switched off.
      if (!planUnits(plan).length) throw new Error("Those sizes are too small for any of our units. Make a wall longer, or choose Draw it yourself.");
      onReady(plan, answers);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} aria-labelledby="qm-size" noValidate>
      <p className={EYEBROW}>{count ? `${count} · ${target.name}` : target.name}</p>
      <h2 id="qm-size" ref={headingRef} tabIndex={-1} className="mt-2 text-[1.75rem] text-primary focus:outline-none">
        {mode === "draw" ? "How big is the room?" : "Your room"}
      </h2>
      <p className="mt-2 max-w-[60ch] text-[15px] text-muted-foreground">
        Measure each wall from corner to corner, in millimetres (3 metres is 3000). Close is fine: we measure properly at the survey.
      </p>

      {layouts.length > 1 ? (
        <fieldset className="mt-6">
          <legend className="text-[14px] text-foreground">{mode === "draw" ? "Walls to fit out" : "Layout"}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {layouts.map((l) => (
              <button key={l.id} type="button" aria-pressed={layout === l.id} onClick={() => setLayout(l.id)} className={chip(layout === l.id)}>
                {copy?.layouts?.[l.id] ?? l.name}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-3">
        {Array.from({ length: count_ }, (_, i) => (
          <MmField
            key={i}
            id={`qm-wall-${i}`}
            label={count_ > 1 ? `Wall ${String.fromCharCode(65 + i)} length` : "Wall length"}
            value={walls[i]!}
            onChange={(v) => setWalls((all) => all.map((w, j) => (j === i ? v : w)))}
            invalid={!inRange(walls[i]!, LIMITS.wall_min, LIMITS.wall_max)}
            hint={`${LIMITS.wall_min.toLocaleString("en-GB")}–${LIMITS.wall_max.toLocaleString("en-GB")} mm`}
          />
        ))}
        <MmField id="qm-height" label="Ceiling height" value={height} onChange={setHeight} invalid={!heightOk} hint={`${LIMITS.height_min.toLocaleString("en-GB")}–${LIMITS.height_max.toLocaleString("en-GB")} mm`} />
        {islandAllowed ? (
          <MmField id="qm-island" label="Island length (optional)" value={island} onChange={setIsland} invalid={!islandOk} hint="Leave blank for no island" />
        ) : null}
      </div>

      {mode === "questions" ? (
        <>
          {hasUpper ? (
            <label className="mt-6 flex min-h-11 items-center gap-3 text-[15px] text-foreground">
              <input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} className="h-5 w-5 accent-[#102E2D]" />
              {copy?.upper ?? "Storage above, up to the ceiling"}
            </label>
          ) : null}
          {fronts.length ? <SwatchPicker legend="Doors and fronts" options={fronts} value={front} onChange={setFront} /> : null}
          {worktops.length ? <SwatchPicker legend="Worktop" options={worktops} value={worktop} onChange={setWorktop} /> : null}
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

/** Each room's range, re-asked (debounced) when its plan changes; a newer request cancels the one in flight. */
function useEstimates(rooms: Room[]) {
  const [prices, setPrices] = useState<Record<string, { plan: Plan; result?: Estimate; error?: string }>>({});
  useEffect(() => {
    const stale = rooms.filter((room) => planUnits(room.plan).length && prices[room.key]?.plan !== room.plan);
    if (!stale.length) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      for (const room of stale)
        fetchEstimate(room.plan, controller.signal).then(
          // An abort that lands while the body is being read resolves empty, so a cancelled call is dropped here.
          (result) => !controller.signal.aborted && setPrices((all) => ({ ...all, [room.key]: { plan: room.plan, result } })),
          (error: Error) => error.name !== "AbortError" && setPrices((all) => ({ ...all, [room.key]: { plan: room.plan, error: error.message } })),
        );
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [rooms, prices]);

  const drawn = rooms.filter((room) => planUnits(room.plan).length);
  const known = drawn.map((room) => prices[room.key]);
  const results = known.flatMap((p) => (p?.result ? [p.result] : []));
  const sum = (key: "low" | "high") => results.reduce((total, r) => total + (r[key] ?? 0), 0);
  return {
    empty: !drawn.length,
    loading: drawn.some((room) => prices[room.key]?.plan !== room.plan),
    error: known.find((p) => p?.error)?.error ?? null,
    // The enquiry's range is the sum of its rooms', and "we'll price it" if any room is.
    total: results.length === drawn.length && drawn.length ? { priced: results.every((r) => r.priced), low: sum("low"), high: sum("high") } : null,
  };
}

/**
 * The designer: one screen, no page scroll on a desktop. The wall being worked on fills the left, the
 * 3D model and the unit list (or the selected unit's settings) sit in a rail on the right, and the
 * price and Send stay in the bar on top. It covers the site's header and frame (z 100) but not the cookie
 * banner (z 110), and the rest of the page is inert while it is open.
 */
function Editor({
  headingRef,
  rooms,
  active,
  setActive,
  setPlan,
  templates,
  finishes,
  catalogue,
  onBack,
  onNext,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  rooms: Room[];
  active: number;
  setActive: (index: number) => void;
  setPlan: (key: string, update: (plan: Plan) => Plan) => void;
  templates: Map<string, CatalogueTemplate>;
  finishes: Map<string, Finish>;
  catalogue: Catalogue;
  onBack: () => void;
  onNext: () => void;
}) {
  const room = rooms[active]!;
  const plan = room.plan;
  const [selected, setSelected] = useState<string | null>(null);
  const [wallIndex, setWallIndex] = useState(0);
  const [full, setFull] = useState(false);
  const price = useEstimates(rooms);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    // Everything behind, bar the cookie banner (it sits above and must stay answerable).
    const behind: Element[] = [];
    const walk = (parent: Element) => {
      for (const el of parent.children) {
        if (el === root.current || el.matches("script, next-route-announcer, [data-cookie-banner]")) continue;
        if (el.querySelector("[data-cookie-banner]")) walk(el);
        else behind.push(el);
      }
    };
    walk(document.body);
    behind.forEach((el) => el.setAttribute("inert", ""));
    document.body.style.overflow = "hidden";
    return () => {
      behind.forEach((el) => el.removeAttribute("inert"));
      document.body.style.overflow = "";
    };
  }, []);

  const colourOf = useCallback((unit: Unit, template: CatalogueTemplate) => frontColour(unit, template, finishes), [finishes]);
  const widthOf = (unit: Unit) => templates.get(unit.template_id)?.variants.find((v) => v.id === unit.variant_id)?.width_mm ?? 0;
  const all = runs(plan);
  const at = Math.min(wallIndex, all.length - 1);
  const wall = all[at]!;
  const isIsland = at >= plan.walls.length;
  const show = (roomIndex: number, wallAt: number) => {
    setActive(roomIndex);
    setWallIndex(wallAt);
    setSelected(null);
    setFull(false);
  };

  const updateRun = (index: number, update: (wall: PlanWall) => PlanWall) =>
    setPlan(room.key, (p) => {
      if (index < p.walls.length) return { ...p, walls: p.walls.map((w, i) => (i === index ? update(w) : w)) };
      return p.island ? { ...p, island: update(p.island) } : p;
    });
  const current = wall.units.find((u) => u.id === selected);
  const currentTemplate = current ? templates.get(current.template_id) : undefined;
  const patchUnit = (id: string, patch: Partial<Unit>) => updateRun(at, (w) => ({ ...w, units: w.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }));
  const removeUnit = (id: string) => {
    updateRun(at, (w) => ({ ...w, units: w.units.filter((u) => u.id !== id) }));
    setSelected(null);
  };
  const setLength = (length_mm: number) => updateRun(at, (w) => ({ length_mm, units: w.units.map((u) => ({ ...u, x_mm: clampX(u.x_mm, widthOf(u), length_mm) })) }));
  /** One click adds the unit in its first size, or the widest that still fits; its size is then changed in its panel. */
  const add = (template: CatalogueTemplate) => {
    const others = wall.units.map((u) => [u.x_mm, widthOf(u), templates.get(u.template_id)?.mount ?? "floor"] as [number, number, Mount]);
    for (const variant of [template.variants[0]!, ...[...template.variants].sort((a, b) => b.width_mm - a.width_mm)]) {
      const x = firstFree(others, variant.width_mm, template.mount, wall.length_mm);
      if (x === null) continue;
      const id = newUnitId();
      updateRun(at, (w) => ({ ...w, units: [...w.units, { id, template_id: template.id, variant_id: variant.id, x_mm: x }] }));
      setSelected(id);
      return setFull(false);
    }
    setFull(true);
  };

  // A blank room takes any unit, listed under the room it was made for; an island only floor units.
  const palette = catalogue.templates.filter((t) => t.variants.length && (room.type === CUSTOM_ROOM || t.room_types.includes(room.type)) && (!isIsland || t.mount === "floor"));
  const groups =
    room.type === CUSTOM_ROOM
      ? catalogue.room_types.map((r) => ({ name: r.name, items: palette.filter((t) => t.room_types[0] === r.id) })).filter((g) => g.items.length)
      : [{ name: "", items: palette }];

  // The API refuses a unit off its wall and an empty room; say so here rather than after Send.
  const overflow = rooms.some((r) => runs(r.plan).some((w) => w.units.some((u) => u.x_mm + widthOf(u) > w.length_mm)));
  const emptyRooms = rooms.filter((r) => !planUnits(r.plan).length).map((r) => r.name);
  const min = Math.max(isIsland ? LIMITS.island_min : LIMITS.wall_min, ...wall.units.map(widthOf));

  return createPortal(
    <section ref={root} role="dialog" aria-modal="true" aria-labelledby="qm-edit" data-lenis-prevent className="fixed inset-0 z-[105] flex flex-col bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/70 px-4 py-3 md:px-6">
        <button type="button" className={`${SECONDARY} px-4`} onClick={onBack}>
          <ArrowLeft size={16} aria-hidden /> <span className="max-sm:sr-only">Back</span>
        </button>
        <div className="mr-auto min-w-0 max-sm:sr-only">
          <h2 id="qm-edit" ref={headingRef} tabIndex={-1} className="text-[1.2rem] leading-tight text-primary focus:outline-none">
            Arrange your units
          </h2>
          {rooms.length === 1 ? <p className="text-[13px] text-muted-foreground">{room.name}</p> : null}
        </div>
        {rooms.length > 1 ? (
          <div role="tablist" aria-label="Rooms" className="order-last flex w-full gap-2 overflow-x-auto lg:order-none lg:w-auto">
            {rooms.map((r, i) => (
              <button key={r.key} type="button" role="tab" aria-selected={i === active} onClick={() => show(i, 0)} className={`${chip(i === active)} shrink-0 whitespace-nowrap`}>
                {r.name}
              </button>
            ))}
          </div>
        ) : null}
        <div className="rounded-2xl bg-primary px-5 py-2 text-primary-foreground max-sm:flex-1" aria-live="polite">
          <p className="text-[11px] uppercase tracking-[0.18em] text-primary-foreground/70">{rooms.length > 1 ? "Estimate, all rooms" : "Estimate"}</p>
          {price.empty ? (
            <p className="text-[14px] text-primary-foreground/80">Add a unit to see a price</p>
          ) : price.total && !price.total.priced ? (
            <p className="text-[14px]">We will price this one for you</p>
          ) : price.total ? (
            <p className={`font-title text-[1.4rem] leading-tight tabular-nums transition-opacity ${price.loading || price.error ? "opacity-60" : ""}`}>
              {gbp(price.total.low)} – {gbp(price.total.high)}
            </p>
          ) : (
            <p className="text-[14px] text-primary-foreground/80">{price.error ?? "Working it out…"}</p>
          )}
        </div>
        {/* On a phone Send is pinned to the bottom, in reach of a thumb, and the bar keeps to one row. */}
        <button type="button" className={`${PRIMARY} max-sm:fixed max-sm:inset-x-4 max-sm:bottom-4 max-sm:z-10 max-sm:shadow-lg`} disabled={emptyRooms.length > 0 || overflow} onClick={onNext}>
          Send to the studio
        </button>
      </header>

      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 max-sm:pb-24 md:p-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex h-[62vh] min-h-[20rem] flex-col gap-3 lg:h-auto lg:min-h-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div role="tablist" aria-label="Walls" className="flex flex-wrap gap-2">
              {all.map((w, i) => (
                <button key={i} type="button" role="tab" aria-selected={i === at} aria-label={`${wallLabel(plan, i)}, ${w.units.length} ${w.units.length === 1 ? "unit" : "units"}`} onClick={() => show(active, i)} className={chip(i === at)}>
                  {wallLabel(plan, i)}
                  <span className="ml-2 tabular-nums opacity-70">{w.units.length}</span>
                </button>
              ))}
            </div>
            <LengthField key={`${room.key}-${at}-${wall.length_mm}`} value={wall.length_mm} min={min} max={isIsland ? LIMITS.island_max : LIMITS.wall_max} onChange={setLength} />
          </div>
          <div className="min-h-0 flex-1">
            <Elevation
              fill
              label={wallLabel(plan, at)}
              wall={wall}
              ceiling_mm={plan.height_mm}
              templates={templates}
              colourOf={colourOf}
              selectedId={selected}
              onSelect={setSelected}
              onMove={(id, x_mm) => patchUnit(id, { x_mm })}
              onRemove={removeUnit}
            />
          </div>
          {overflow ? (
            <p role="alert" className="text-[13px] text-destructive">A unit runs past the end of its wall. Move it, or make the wall longer.</p>
          ) : emptyRooms.length ? (
            <p role="status" className="text-[13px] text-destructive">Add at least one unit{rooms.length > 1 ? ` to ${emptyRooms.join(" and ")}` : ""} before you send.</p>
          ) : (
            <p className="text-[13px] text-muted-foreground">Drag a unit along the wall, or select it and use the arrow keys. Delete removes it.</p>
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
          <Preview3D plan={plan} templates={templates} colourOf={colourOf} />
          {current && currentTemplate ? (
            <UnitPanel
              key={current.id}
              unit={current}
              template={currentTemplate}
              finishes={catalogue.finishes}
              fits={(width) => current.x_mm + width <= wall.length_mm}
              onChange={(patch) => patchUnit(current.id, patch)}
              onRemove={() => removeUnit(current.id)}
              onDone={() => setSelected(null)}
            />
          ) : (
            <div>
              <p className="text-[15px] font-medium text-primary">Add a unit to {wallLabel(plan, at).toLowerCase() === "island" ? "the island" : wallLabel(plan, at)}</p>
              {full ? <p role="status" className="mt-1 text-[13px] text-destructive">No space left for that one on this wall. Make room, or lengthen the wall.</p> : null}
              {groups.map((group) => (
                <div key={group.name}>
                  {group.name ? <p className={`${EYEBROW} mt-4`}>{group.name}</p> : null}
                  <ul className="mt-2 space-y-2">
                    {group.items.map((t) => {
                      const widths = t.variants.map((v) => v.width_mm);
                      const lo = Math.min(...widths);
                      const hi = Math.max(...widths);
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => add(t)}
                            className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-white px-4 py-2.5 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-[14px] font-medium text-foreground">{t.name}</span>
                              <span className="block text-[12.5px] tabular-nums text-muted-foreground">
                                {MOUNT_NAME[t.mount]} · {lo === hi ? `${lo} mm` : `${lo}–${hi} mm`} wide
                              </span>
                            </span>
                            <Plus size={16} aria-hidden className="shrink-0 text-secondary" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            The estimate is made and fitted, from the materials you picked. A guide, not a quote: we confirm it after a free survey.
          </p>
        </aside>
      </div>
    </section>,
    document.body,
  );
}

function LengthField({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (length: number) => void }) {
  const [text, setText] = useState(String(value));
  // A length can't go below the wall's widest unit or the limits; anything else snaps back.
  const commit = () => {
    const next = Math.round(Number(text));
    if (Number.isFinite(next) && next >= min && next <= max) onChange(next);
    else setText(String(value));
  };
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
      Length
      <span className="relative block w-32">
        <input
          className={`${INPUT} min-h-11 py-2 pr-11 tabular-nums`}
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^\d]/g, "").slice(0, 5))}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), commit())}
        />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px]">mm</span>
      </span>
    </label>
  );
}

function UnitPanel({
  unit,
  template,
  finishes,
  fits,
  onChange,
  onRemove,
  onDone,
}: {
  unit: Unit;
  template: CatalogueTemplate;
  finishes: Finish[];
  fits: (width: number) => boolean;
  onChange: (patch: Partial<Unit>) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const setFinish = (slot: string, id: string) => {
    const next = { ...(unit.finishes ?? {}) };
    if (id) next[slot] = id;
    else delete next[slot];
    onChange({ finishes: Object.keys(next).length ? next : undefined });
  };
  return (
    <div className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[16px] font-medium text-primary">{template.name}</p>
        <button type="button" onClick={onDone} aria-label="Close and add another unit" className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <X size={18} aria-hidden />
        </button>
      </div>
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
  rooms,
  onBack,
  onSent,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  rooms: Room[];
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
      onSent((await submitDesign(rooms, contact)) ?? null);
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
