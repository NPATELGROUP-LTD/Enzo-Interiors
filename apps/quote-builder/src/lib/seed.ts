// Demo catalogue the prototype starts with, and returns to on "Reset demo
// data". Prices and sheet sizes are plausible UK trade figures for a mock,
// not Enzo's real costs — the admin replaces them in the studio catalogue.
// Painted and lacquered fronts are priced as finished (sprayed) sheets.
import { generatePanels } from "./panels";
import type {
  Board,
  Catalogue,
  MaterialSlot,
  Mount,
  Plan,
  RoomType,
  RoomTypeId,
  UnitStructure,
  UnitTemplate,
} from "./types";

export const CATALOGUE_VERSION = 1;

const board = (b: Board): Board => b;

const BOARDS: Board[] = [
  board({ id: "brd-mfc-white", name: "White melamine MFC", category: "carcass", lengthMm: 2800, widthMm: 2070, thicknessMm: 18, pricePence: 4800, grain: false, swatch: "#EFEDE7", supplier: "Egger" }),
  board({ id: "brd-mfc-grey", name: "Pebble grey MFC", category: "carcass", lengthMm: 2800, widthMm: 2070, thicknessMm: 18, pricePence: 5400, grain: false, swatch: "#C9C6BF", supplier: "Egger" }),
  board({ id: "brd-ply-birch", name: "Birch plywood", category: "carcass", lengthMm: 2440, widthMm: 1220, thicknessMm: 18, pricePence: 9600, grain: true, swatch: "#DCC7A3", supplier: "Arnold Laver" }),
  board({ id: "brd-mdf-forest", name: "Forest green painted MDF", category: "front", lengthMm: 2440, widthMm: 1220, thicknessMm: 18, pricePence: 32000, grain: false, swatch: "#1B4335" }),
  board({ id: "brd-mdf-sage", name: "Sage painted MDF", category: "front", lengthMm: 2440, widthMm: 1220, thicknessMm: 18, pricePence: 32000, grain: false, swatch: "#8A9E8C" }),
  board({ id: "brd-mdf-white", name: "Matt white lacquered MDF", category: "front", lengthMm: 2440, widthMm: 1220, thicknessMm: 18, pricePence: 36000, grain: false, swatch: "#F4F3EF" }),
  board({ id: "brd-oak-veneer", name: "Natural oak veneer", category: "front", lengthMm: 2440, widthMm: 1220, thicknessMm: 19, pricePence: 24500, grain: true, swatch: "#A98F6A" }),
  board({ id: "brd-walnut-veneer", name: "Walnut veneer", category: "front", lengthMm: 2440, widthMm: 1220, thicknessMm: 19, pricePence: 29500, grain: true, swatch: "#5E4332" }),
  board({ id: "brd-mfc-halifax", name: "Halifax oak MFC", category: "front", lengthMm: 2800, widthMm: 2070, thicknessMm: 18, pricePence: 7400, grain: true, swatch: "#B08D62", supplier: "Egger" }),
  board({ id: "brd-wt-oak", name: "Solid oak worktop", category: "worktop", lengthMm: 3000, widthMm: 620, thicknessMm: 40, pricePence: 31000, grain: true, swatch: "#B8915E" }),
  board({ id: "brd-wt-quartz", name: "White quartz-effect laminate", category: "worktop", lengthMm: 3000, widthMm: 600, thicknessMm: 38, pricePence: 14500, grain: true, swatch: "#E6E3DC" }),
  board({ id: "brd-wt-granite", name: "Black granite-effect laminate", category: "worktop", lengthMm: 3000, widthMm: 600, thicknessMm: 38, pricePence: 16000, grain: true, swatch: "#2F2F2D" }),
  board({ id: "brd-back-white", name: "White MDF backing", category: "back", lengthMm: 2440, widthMm: 1220, thicknessMm: 6, pricePence: 2200, grain: false, swatch: "#F1EFEA" }),
];

const CARCASS: MaterialSlot = { key: "carcass", label: "Carcass", categories: ["carcass"], defaultBoardId: "brd-mfc-white" };
const FRONT: MaterialSlot = { key: "front", label: "Doors & fronts", categories: ["front"], defaultBoardId: "brd-mdf-forest" };
const WORKTOP: MaterialSlot = { key: "worktop", label: "Worktop", categories: ["worktop"], defaultBoardId: "brd-wt-quartz" };
const BACK: MaterialSlot = { key: "back", label: "Back panel", categories: ["back", "carcass"], defaultBoardId: "brd-back-white" };

function unit(input: {
  id: string;
  name: string;
  description: string;
  roomTypes: RoomTypeId[];
  mount: Mount;
  elevationMm?: number;
  slots: MaterialSlot[];
  extrasPence: number;
  structure: UnitStructure;
  widths: number[];
  heightMm: number;
  depthMm: number;
}): UnitTemplate {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    roomTypes: input.roomTypes,
    mount: input.mount,
    elevationMm: input.elevationMm ?? 0,
    slots: input.slots,
    extrasPence: input.extrasPence,
    structure: input.structure,
    variants: input.widths.map((widthMm) => {
      const size = { widthMm, heightMm: input.heightMm, depthMm: input.depthMm };
      const id = `${input.id}-${widthMm}`;
      return { id, ...size, panels: generatePanels(input.structure, size, input.slots, id) };
    }),
  };
}

const UNITS: UnitTemplate[] = [
  unit({
    id: "base-cabinet",
    name: "Base cabinet",
    description: "Floor unit with a shelf, doors and a worktop section.",
    roomTypes: ["kitchens"],
    mount: "floor",
    slots: [CARCASS, FRONT, WORKTOP],
    extrasPence: 16500,
    structure: { doors: 2, drawers: 0, shelves: 1, back: true, plinthMm: 150, worktop: true },
    widths: [300, 400, 500, 600, 800, 1000],
    heightMm: 870,
    depthMm: 560,
  }),
  unit({
    id: "drawer-pack",
    name: "Drawer pack",
    description: "Three deep pan drawers under a worktop section.",
    roomTypes: ["kitchens"],
    mount: "floor",
    slots: [CARCASS, FRONT, WORKTOP],
    extrasPence: 24000,
    structure: { doors: 0, drawers: 3, shelves: 0, back: true, plinthMm: 150, worktop: true },
    widths: [400, 500, 600, 800],
    heightMm: 870,
    depthMm: 560,
  }),
  unit({
    id: "wall-cabinet",
    name: "Wall cabinet",
    description: "Hung above the worktop, two adjustable shelves.",
    roomTypes: ["kitchens"],
    mount: "wall",
    elevationMm: 1450,
    slots: [CARCASS, FRONT],
    extrasPence: 12000,
    structure: { doors: 2, drawers: 0, shelves: 2, back: true, plinthMm: 0, worktop: false },
    widths: [300, 400, 500, 600, 800, 1000],
    heightMm: 720,
    depthMm: 320,
  }),
  unit({
    id: "tall-larder",
    name: "Tall larder",
    description: "Floor-to-ceiling storage with five shelves.",
    roomTypes: ["kitchens"],
    mount: "tall",
    slots: [CARCASS, FRONT],
    extrasPence: 26000,
    structure: { doors: 1, drawers: 0, shelves: 5, back: true, plinthMm: 150, worktop: false },
    widths: [500, 600],
    heightMm: 2150,
    depthMm: 560,
  }),
  unit({
    id: "open-shelf",
    name: "Open wall shelf",
    description: "Shallow open box shelf, no doors.",
    roomTypes: ["kitchens", "media-walls", "bedrooms"],
    mount: "wall",
    elevationMm: 1550,
    slots: [FRONT],
    extrasPence: 6000,
    structure: { doors: 0, drawers: 0, shelves: 0, back: false, plinthMm: 0, worktop: false },
    widths: [600, 900, 1200],
    heightMm: 360,
    depthMm: 250,
  }),
  unit({
    id: "hinged-wardrobe",
    name: "Hinged wardrobe",
    description: "Full-height wardrobe with a hanging rail and top shelf.",
    roomTypes: ["bedrooms", "wardrobes"],
    mount: "tall",
    slots: [CARCASS, FRONT, BACK],
    extrasPence: 28000,
    structure: { doors: 2, drawers: 0, shelves: 1, back: true, plinthMm: 100, worktop: false },
    widths: [500, 600, 800, 1000],
    heightMm: 2200,
    depthMm: 600,
  }),
  unit({
    id: "chest-drawers",
    name: "Chest of drawers",
    description: "Four soft-close drawers.",
    roomTypes: ["bedrooms", "wardrobes"],
    mount: "floor",
    slots: [CARCASS, FRONT],
    extrasPence: 30000,
    structure: { doors: 0, drawers: 4, shelves: 0, back: true, plinthMm: 80, worktop: false },
    widths: [500, 800, 1000],
    heightMm: 820,
    depthMm: 450,
  }),
  unit({
    id: "overhead-box",
    name: "Overhead storage",
    description: "Top box above a wardrobe run, two doors.",
    roomTypes: ["bedrooms", "wardrobes"],
    mount: "wall",
    elevationMm: 2200,
    slots: [CARCASS, FRONT],
    extrasPence: 11000,
    structure: { doors: 2, drawers: 0, shelves: 0, back: true, plinthMm: 0, worktop: false },
    widths: [500, 600, 800, 1000],
    heightMm: 400,
    depthMm: 600,
  }),
  unit({
    id: "media-base",
    name: "Media base unit",
    description: "Low unit under the TV with two lift-up doors.",
    roomTypes: ["media-walls"],
    mount: "floor",
    slots: [CARCASS, FRONT],
    extrasPence: 22000,
    structure: { doors: 2, drawers: 0, shelves: 0, back: true, plinthMm: 0, worktop: false },
    widths: [1200, 1500, 1800],
    heightMm: 450,
    depthMm: 450,
  }),
  unit({
    id: "media-column",
    name: "Media side column",
    description: "Tall shelving column beside the TV, one door below.",
    roomTypes: ["media-walls"],
    mount: "tall",
    slots: [CARCASS, FRONT],
    extrasPence: 16000,
    structure: { doors: 1, drawers: 0, shelves: 4, back: true, plinthMm: 0, worktop: false },
    widths: [400, 500, 600],
    heightMm: 2200,
    depthMm: 350,
  }),
];

// A feature panel is not a box, so its panel list is written by hand — the
// same thing an admin does for anything the carcass helper cannot describe.
const FEATURE_WIDTHS = [600, 900, 1200];
UNITS.push({
  id: "feature-panel",
  name: "TV feature panel",
  description: "Slatted-look face panel on a hidden batten frame.",
  roomTypes: ["media-walls"],
  mount: "tall",
  elevationMm: 0,
  slots: [FRONT, CARCASS],
  extrasPence: 18000,
  structure: { doors: 0, drawers: 0, shelves: 0, back: false, plinthMm: 0, worktop: false },
  variants: FEATURE_WIDTHS.map((widthMm) => ({
    id: `feature-panel-${widthMm}`,
    widthMm,
    heightMm: 2400,
    depthMm: 60,
    panels: [
      { id: `feature-panel-${widthMm}-face`, role: "back" as const, label: "Face panel", slot: "front", lengthMm: 2400, widthMm, qty: 1 },
      { id: `feature-panel-${widthMm}-batten`, role: "other" as const, label: "Frame batten", slot: "carcass", lengthMm: 2400, widthMm: 60, qty: 3 },
    ],
  })),
});

const ROOM_TYPES: RoomType[] = [
  { id: "kitchens", name: "Kitchens", singular: "Kitchen", quickFill: { templateId: "base-cabinet", upperTemplateId: "wall-cabinet", upperLabel: "Wall cabinets above" } },
  { id: "bedrooms", name: "Bedrooms", singular: "Bedroom", quickFill: { templateId: "hinged-wardrobe", upperTemplateId: "overhead-box", upperLabel: "Storage boxes above" } },
  { id: "media-walls", name: "Media walls", singular: "Media wall", quickFill: { templateId: "media-base", upperTemplateId: "open-shelf", upperLabel: "Floating shelves above" } },
  { id: "wardrobes", name: "Wardrobes", singular: "Wardrobe", quickFill: { templateId: "hinged-wardrobe", upperTemplateId: "overhead-box", upperLabel: "Storage boxes above" } },
];

export function seedCatalogue(): Catalogue {
  return structuredClone({
    version: CATALOGUE_VERSION,
    boards: BOARDS,
    units: UNITS,
    roomTypes: ROOM_TYPES,
    settings: {
      marginPct: 70,
      rangeLowPct: 5,
      rangeHighPct: 15,
      kerfMm: 4,
      edgeTrimMm: 10,
      roundToPounds: 50,
    },
  });
}

export function emptyPlan(): Plan {
  return {
    room: {
      type: "kitchens",
      shape: "rect",
      widthMm: 4200,
      depthMm: 3400,
      heightMm: 2400,
      cut: { widthMm: 1400, depthMm: 1200, corner: "br" },
    },
    units: [],
  };
}
