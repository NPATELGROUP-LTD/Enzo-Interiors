// Domain types for the 3D/2D component quote builder.
//
// Standalone for now: everything persists to localStorage (see ./store.ts).
// The shapes deliberately mirror the tables apps/api will own later
// (material boards, unit templates, quotes) so the swap is a data-source
// change, not a rewrite. Money is integer pence, never float pounds.

export type Pence = number;

export type RoomTypeId = "kitchens" | "bedrooms" | "media-walls" | "wardrobes";

export type BoardCategory = "carcass" | "front" | "worktop" | "back";

export interface Board {
  id: string;
  name: string;
  category: BoardCategory;
  /** Sheet length (the grain direction when `grain` is true). */
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  pricePence: Pence;
  /** Grained boards keep every piece's length along the sheet's length. */
  grain: boolean;
  /** Representative colour, used for the 3D model and when no image exists. */
  swatch: string;
  /** Downscaled data URL of the uploaded board photo. */
  image?: string;
  supplier?: string;
}

export type PanelRole =
  | "side"
  | "top"
  | "bottom"
  | "back"
  | "shelf"
  | "divider"
  | "door"
  | "drawer"
  | "plinth"
  | "end"
  | "worktop"
  | "other";

export interface PanelSpec {
  id: string;
  role: PanelRole;
  label: string;
  /** Which of the template's material slots this panel is cut from. */
  slot: string;
  lengthMm: number;
  widthMm: number;
  qty: number;
}

export interface SizeVariant {
  id: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  panels: PanelSpec[];
}

export interface MaterialSlot {
  key: string;
  label: string;
  categories: BoardCategory[];
  defaultBoardId: string;
}

export type Mount = "floor" | "wall" | "tall";

/** The recipe the "build standard panels" helper works from. */
export interface UnitStructure {
  doors: number;
  drawers: number;
  shelves: number;
  back: boolean;
  plinthMm: number;
  worktop: boolean;
}

export interface UnitTemplate {
  id: string;
  name: string;
  description: string;
  roomTypes: RoomTypeId[];
  mount: Mount;
  /** Height of the unit's underside above the floor, for wall units. */
  elevationMm: number;
  slots: MaterialSlot[];
  /** Hardware, fixings and fitting time per unit, added before margin. */
  extrasPence: Pence;
  structure: UnitStructure;
  variants: SizeVariant[];
}

export interface PricingSettings {
  /** Mark-up applied to total cost: 70 turns £1,000 of cost into £1,700. */
  marginPct: number;
  rangeLowPct: number;
  rangeHighPct: number;
  /** Saw blade width lost between neighbouring pieces. */
  kerfMm: number;
  /** Unusable strip trimmed off every sheet edge. */
  edgeTrimMm: number;
  /** Customer-facing figures round to this many pounds. */
  roundToPounds: number;
}

export interface QuickFill {
  templateId: string;
  /** Optional second run (wall cabinets above a kitchen base run). */
  upperTemplateId?: string;
  upperLabel?: string;
}

export interface RoomType {
  id: RoomTypeId;
  name: string;
  singular: string;
  quickFill: QuickFill;
}

export interface Catalogue {
  version: number;
  boards: Board[];
  units: UnitTemplate[];
  roomTypes: RoomType[];
  settings: PricingSettings;
}

export type RoomShape = "rect" | "L";
export type Corner = "tl" | "tr" | "bl" | "br";

export interface RoomSpec {
  type: RoomTypeId;
  shape: RoomShape;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  cut: { widthMm: number; depthMm: number; corner: Corner };
}

export type Rotation = 0 | 90 | 180 | 270;

export interface PlacedUnit {
  id: string;
  templateId: string;
  variantId: string;
  /** Centre of the footprint, in room millimetres (y runs down the plan). */
  x: number;
  y: number;
  rotation: Rotation;
  /** Board chosen per material slot; missing keys fall back to the slot default. */
  materials: Record<string, string>;
}

export interface Plan {
  room: RoomSpec;
  units: PlacedUnit[];
}

export interface SavedEstimate {
  id: string;
  reference: string;
  createdAt: string;
  source: "planner" | "quick";
  plan: Plan;
  lowPence: Pence;
  highPence: Pence;
  pricePence: Pence;
  costPence: Pence;
  sheetCount: number;
}
