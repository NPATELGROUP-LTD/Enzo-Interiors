"use client";

import { ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { mm, poundsExact } from "@/lib/format";
import { makeId } from "@/lib/ids";
import { readBoardImage } from "@/lib/image";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/labels";
import { catalogueStore } from "@/lib/store";
import type { Board, BoardCategory, Catalogue } from "@/lib/types";
import { Button, Field, NumberInput, Segmented, Swatch, Toggle, inputClass } from "../ui";

type Filter = "all" | BoardCategory;

const blankBoard = (): Board => ({
  id: makeId("brd"),
  name: "",
  category: "carcass",
  lengthMm: 2800,
  widthMm: 2070,
  thicknessMm: 18,
  pricePence: 5000,
  grain: false,
  swatch: "#D4C9B5",
});

export function BoardsPanel({ catalogue }: { catalogue: Catalogue }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Board | null>(null);
  const boards = catalogue.boards.filter((b) => filter === "all" || b.category === filter);

  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-8", editing && "xl:grid-cols-[minmax(0,1fr)_400px]")}>
      <section aria-labelledby="boards-heading" className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="boards-heading" className="text-[1.5rem]">
              Boards
            </h2>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Every sheet material you cut from, and what one whole sheet costs you.
            </p>
          </div>
          <Button onClick={() => setEditing(blankBoard())} size="sm">
            <Plus size={15} aria-hidden="true" />
            Add board
          </Button>
        </div>

        <Segmented<Filter>
          className="mt-5"
          label="Show boards used for"
          value={filter}
          onChange={setFilter}
          options={[{ value: "all", label: "All" }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))]}
        />

        <div className="relative mt-5 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[13.5px]">
            <thead>
              <tr className="text-[12px] text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-normal">Board</th>
                <th scope="col" className="py-2 pr-3 font-normal">Used for</th>
                <th scope="col" className="py-2 pr-3 font-normal">Sheet size</th>
                <th scope="col" className="py-2 pr-3 font-normal">Thickness</th>
                <th scope="col" className="py-2 pr-3 font-normal">Grain</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Per sheet</th>
                <th scope="col" className="py-2 font-normal"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {boards.map((board) => (
                <tr
                  key={board.id}
                  className={cn(
                    "border-t border-border/70 transition-colors hover:bg-card",
                    editing?.id === board.id && "bg-card",
                  )}
                >
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-3">
                      <Swatch board={board} className="h-9 w-9" />
                      <span>
                        <span className="block font-medium text-foreground">{board.name}</span>
                        {board.supplier && <span className="block text-[12px] text-muted-foreground">{board.supplier}</span>}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{CATEGORY_LABELS[board.category]}</td>
                  <td className="py-2.5 pr-3 font-display tabular-nums">
                    {board.lengthMm} × {board.widthMm}
                  </td>
                  <td className="py-2.5 pr-3 font-display tabular-nums">{mm(board.thicknessMm)}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{board.grain ? "Fixed" : "Any way"}</td>
                  <td className="py-2.5 pr-3 text-right font-display tabular-nums">{poundsExact(board.pricePence)}</td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(board)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Edit ${board.name}`}
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {boards.length === 0 && (
            <p className="border-t border-border/70 py-6 text-[14px] text-muted-foreground">
              No boards of this kind yet. Add one to make it available to units.
            </p>
          )}
        </div>
      </section>

      {editing && (
        <BoardForm
          key={editing.id}
          initial={editing}
          catalogue={catalogue}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function BoardForm({ initial, catalogue, onClose }: { initial: Board; catalogue: Catalogue; onClose: () => void }) {
  const [board, setBoard] = useState<Board>(initial);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const exists = catalogue.boards.some((b) => b.id === board.id);
  const set = <K extends keyof Board>(key: K, value: Board[K]) => setBoard((b) => ({ ...b, [key]: value }));

  const defaultFor = catalogue.units.flatMap((unit) =>
    unit.slots.filter((slot) => slot.defaultBoardId === board.id).map((slot) => `${unit.name} (${slot.label.toLowerCase()})`),
  );

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const { dataUrl, swatch } = await readBoardImage(file);
      setBoard((b) => ({ ...b, image: dataUrl, swatch }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That photo could not be used.");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!board.name.trim()) {
      toast.error("Give the board a name so it can be picked from a list.");
      return;
    }
    const next = { ...board, name: board.name.trim() };
    const ok = catalogueStore.update((c) => ({
      ...c,
      boards: exists ? c.boards.map((b) => (b.id === next.id ? next : b)) : [...c.boards, next],
    }));
    if (!ok) {
      toast.error("The browser's storage is full. Remove a board photo or two and try again.");
      return;
    }
    toast.success(exists ? "Board saved" : "Board added");
    onClose();
  };

  const remove = () => {
    if (defaultFor.length > 0) return;
    if (!window.confirm(`Delete ${board.name}? Plans using it will switch to each unit's default board.`)) return;
    catalogueStore.update((c) => ({ ...c, boards: c.boards.filter((b) => b.id !== board.id) }));
    toast.success("Board deleted");
    onClose();
  };

  return (
    <section
      aria-labelledby="board-form-heading"
      className="self-start rounded-[20px] border border-border/70 bg-card p-6 xl:sticky xl:top-6"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="board-form-heading" className="text-[1.25rem]">
          {exists ? "Edit board" : "New board"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close without saving"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="mt-5 flex items-center gap-4">
        <Swatch board={board} className="h-20 w-20 rounded-xl" />
        <div className="flex flex-col items-start gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            id="board-photo"
            onChange={(e) => onPhoto(e.target.files?.[0])}
          />
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImagePlus size={15} aria-hidden="true" />
            {busy ? "Reading photo…" : board.image ? "Replace photo" : "Upload photo"}
          </Button>
          {board.image && (
            <button type="button" className="text-[12px] text-muted-foreground hover:text-destructive" onClick={() => set("image", undefined)}>
              Remove photo
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <Field label="Name" htmlFor="board-name">
          <input id="board-name" className={inputClass} value={board.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Oak veneer MDF" />
        </Field>
        <Field label="Used for" htmlFor="board-category" hint="Units only offer boards of the kinds their material slots accept.">
          <select id="board-category" className={inputClass} value={board.category} onChange={(e) => set("category", e.target.value as BoardCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sheet length" htmlFor="board-length">
            <NumberInput id="board-length" value={board.lengthMm} min={300} max={6000} suffix="mm" onChange={(v) => set("lengthMm", v)} />
          </Field>
          <Field label="Sheet width" htmlFor="board-width">
            <NumberInput id="board-width" value={board.widthMm} min={100} max={3000} suffix="mm" onChange={(v) => set("widthMm", v)} />
          </Field>
          <Field label="Thickness" htmlFor="board-thickness">
            <NumberInput id="board-thickness" value={board.thicknessMm} min={3} max={80} suffix="mm" onChange={(v) => set("thicknessMm", v)} />
          </Field>
          <Field label="Price per sheet" htmlFor="board-price">
            <NumberInput
              id="board-price"
              value={board.pricePence / 100}
              min={0}
              max={10000}
              step={0.01}
              prefix="£"
              onChange={(v) => set("pricePence", Math.round(v * 100))}
            />
          </Field>
        </div>
        <Toggle
          id="board-grain"
          checked={board.grain}
          onChange={(v) => set("grain", v)}
          label={<span className="text-[13.5px]">Grain runs one way (pieces are never turned to fit)</span>}
        />
        <div className="grid grid-cols-[auto_1fr] items-end gap-3">
          <Field label="Colour" htmlFor="board-swatch">
            <input
              id="board-swatch"
              type="color"
              value={board.swatch}
              onChange={(e) => set("swatch", e.target.value.toUpperCase())}
              className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-input-background p-1"
            />
          </Field>
          <p className="pb-2 text-[12px] leading-snug text-muted-foreground">
            Paints the 3D model. Taken from the photo automatically; adjust it if the photo is lit oddly.
          </p>
        </div>
        <Field label="Supplier" htmlFor="board-supplier">
          <input id="board-supplier" className={inputClass} value={board.supplier ?? ""} onChange={(e) => set("supplier", e.target.value || undefined)} placeholder="Optional" />
        </Field>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button onClick={save}>{exists ? "Save board" : "Add board"}</Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        {exists && (
          <Button variant="danger" size="sm" className="ml-auto" onClick={remove} disabled={defaultFor.length > 0}>
            <Trash2 size={14} aria-hidden="true" />
            Delete
          </Button>
        )}
      </div>
      {exists && defaultFor.length > 0 && (
        <p className="mt-3 text-[12px] leading-snug text-muted-foreground">
          This board is the default for {defaultFor.join(", ")}. Pick a different default there before deleting it.
        </p>
      )}
    </section>
  );
}
