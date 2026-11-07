import type { DatabaseService } from '../../data/database.service';
import type { TemplateSlot, TemplateStructure, TemplateVariant, UnitTemplate } from '../../data/quote-maker-store';
import { generatePanels } from './engine';

/*
 * The unit library the studio starts with, imported by `npm run cms:import` on every deploy.
 * Sizes are the agreed starter set (base 720 carcass on a 150 plinth, wall 720, tall 2150); fitting
 * hours are placeholders for the Admin to set. No board is named: each slot falls back to the
 * Pricing settings' default for its role, so the library prices once those four are chosen.
 * A template the Admin has saved (updated_by is a person) is never overwritten; removed ones stay.
 */

export const STARTER_BY = 'starter library';

type Starter = Omit<UnitTemplate, 'id' | 'created_at' | 'updated_at' | 'updated_by'>;

const slot = (key: string, label: string, roles: TemplateSlot['roles']): TemplateSlot => ({ key, label, roles, default_item_id: null });
const CARCASS = slot('carcass', 'Carcass', ['carcass']);
const FRONT = slot('front', 'Doors & fronts', ['front']);
const WORKTOP = slot('worktop', 'Worktop', ['worktop']);
const BACK = slot('back', 'Back panel', ['back', 'carcass']);

const NONE: TemplateStructure = { doors: 0, drawers: 0, shelves: 0, back: false, plinth_mm: 0, worktop: false };

function unit(input: {
  slug: string;
  name: string;
  description: string;
  room_types: string[];
  mount: Starter['mount'];
  elevation_mm?: number;
  slots: TemplateSlot[];
  structure: Partial<TemplateStructure>;
  widths: number[];
  height_mm: number;
  depth_mm: number;
  labour_hours: number;
}): Starter {
  const structure = { ...NONE, ...input.structure };
  return {
    slug: input.slug,
    name: input.name,
    description: input.description,
    room_types: input.room_types,
    mount: input.mount,
    elevation_mm: input.elevation_mm ?? 0,
    structure,
    slots: input.slots,
    variants: input.widths.map((width_mm) => {
      const size = { width_mm, height_mm: input.height_mm, depth_mm: input.depth_mm };
      const id = `${input.slug}-${width_mm}`;
      return { id, ...size, panels: input.mount === 'gap' ? [] : generatePanels(structure, size, input.slots, id) };
    }),
    hardware: [],
    labour_hours: input.labour_hours,
    labour_extra: 0,
    active: true,
    position: 0,
  };
}

/** Hand-written panels, for what is not a box: an end panel, a slatted feature panel. */
function flat(input: Omit<Starter, 'structure' | 'hardware' | 'labour_extra' | 'active' | 'position' | 'elevation_mm'>): Starter {
  return { ...input, elevation_mm: 0, structure: NONE, hardware: [], labour_extra: 0, active: true, position: 0 };
}

const BASE = { mount: 'floor' as const, height_mm: 870, depth_mm: 560, slots: [CARCASS, FRONT, WORKTOP] };
const WALL = { mount: 'wall' as const, elevation_mm: 1450, height_mm: 720, depth_mm: 320, slots: [CARCASS, FRONT] };
const TALL = { mount: 'tall' as const, height_mm: 2150, depth_mm: 560, slots: [CARCASS, FRONT] };
const GAP = { mount: 'gap' as const, slots: [], structure: {}, labour_hours: 0, room_types: ['kitchen'] };
const kitchen = ['kitchen'];

const sized = (slug: string, widths: number[], height_mm: number, depth_mm: number, panels: (w: number, id: string) => TemplateVariant['panels']) =>
  widths.map((width_mm) => ({ id: `${slug}-${width_mm}`, width_mm, height_mm, depth_mm, panels: panels(width_mm, `${slug}-${width_mm}`) }));

export const STARTER_LIBRARY: Starter[] = [
  // Kitchen. The plinth and the worktop are cut with each base unit, so a run prices them by length.
  unit({ ...BASE, slug: 'kitchen-base', name: 'Base unit', description: 'Floor unit with a shelf and doors, under the worktop.', room_types: kitchen, structure: { doors: 2, shelves: 1, back: true, plinth_mm: 150, worktop: true }, widths: [300, 400, 500, 600, 800, 1000], labour_hours: 1.5 }),
  unit({ ...BASE, slug: 'kitchen-sink-base', name: 'Sink base', description: 'Open-backed base unit for the sink and its pipes.', room_types: kitchen, structure: { doors: 2, plinth_mm: 150, worktop: true }, widths: [600, 1000], labour_hours: 2 }),
  unit({ ...BASE, slug: 'kitchen-drawer-base', name: 'Drawer base', description: 'Three deep pan drawers under the worktop.', room_types: kitchen, structure: { drawers: 3, back: true, plinth_mm: 150, worktop: true }, widths: [400, 600], labour_hours: 2 }),
  unit({ ...BASE, slug: 'kitchen-corner-base', name: 'Corner base', description: 'Blind corner unit where two runs meet.', room_types: kitchen, structure: { doors: 1, shelves: 1, back: true, plinth_mm: 150, worktop: true }, widths: [1000], labour_hours: 2.5 }),
  unit({ ...WALL, slug: 'kitchen-wall', name: 'Wall unit', description: 'Hung above the worktop, two shelves.', room_types: kitchen, structure: { doors: 2, shelves: 2, back: true }, widths: [300, 400, 500, 600, 800, 1000], labour_hours: 1 }),
  unit({ ...WALL, slug: 'kitchen-corner-wall', name: 'Corner wall unit', description: 'Wall unit for the corner, two shelves.', room_types: kitchen, structure: { doors: 1, shelves: 2, back: true }, widths: [600], labour_hours: 1.5 }),
  unit({ ...TALL, slug: 'kitchen-larder', name: 'Tall larder', description: 'Floor-to-ceiling storage with five shelves.', room_types: kitchen, structure: { doors: 1, shelves: 5, back: true, plinth_mm: 150 }, widths: [600], labour_hours: 3 }),
  unit({ ...TALL, slug: 'kitchen-oven-housing', name: 'Oven housing', description: 'Tall unit with a space for a built-in oven.', room_types: kitchen, structure: { doors: 2, shelves: 1, back: true, plinth_mm: 150 }, widths: [600], labour_hours: 3 }),
  unit({ ...TALL, slug: 'kitchen-fridge-housing', name: 'Fridge housing', description: 'Tall unit for an integrated fridge freezer.', room_types: kitchen, structure: { doors: 2, back: true, plinth_mm: 150 }, widths: [600], labour_hours: 3 }),
  unit({ ...GAP, slug: 'gap-dishwasher', name: 'Dishwasher space', description: 'A gap for your dishwasher. Not priced.', widths: [600], height_mm: 870, depth_mm: 560 }),
  unit({ ...GAP, slug: 'gap-cooker', name: 'Cooker space', description: 'A gap for a freestanding cooker. Not priced.', widths: [600], height_mm: 870, depth_mm: 600 }),
  unit({ ...GAP, slug: 'gap-fridge', name: 'Fridge space', description: 'A gap for a freestanding fridge. Not priced.', widths: [600], height_mm: 2000, depth_mm: 650 }),
  flat({
    slug: 'kitchen-end-panel', name: 'End panel', description: 'Finished side panel for the end of a run.', room_types: kitchen, mount: 'floor', slots: [FRONT], labour_hours: 0.5,
    variants: [
      { id: 'kitchen-end-panel-base', width_mm: 18, height_mm: 870, depth_mm: 580, panels: [{ id: 'kitchen-end-panel-base-0', label: 'End panel', slot: 'front', length_mm: 870, width_mm: 580, qty: 1 }] },
      { id: 'kitchen-end-panel-tall', width_mm: 18, height_mm: 2150, depth_mm: 580, panels: [{ id: 'kitchen-end-panel-tall-0', label: 'End panel', slot: 'front', length_mm: 2150, width_mm: 580, qty: 1 }] },
    ],
  }),

  // Bedroom & wardrobes
  unit({ slug: 'wardrobe-hinged', name: 'Hinged wardrobe', description: 'Full-height wardrobe with a hanging rail and top shelf.', room_types: ['bedroom'], mount: 'tall', slots: [CARCASS, FRONT, BACK], structure: { doors: 2, shelves: 1, back: true, plinth_mm: 100 }, widths: [500, 600, 800, 1000], height_mm: 2200, depth_mm: 600, labour_hours: 2.5 }),
  unit({ slug: 'wardrobe-top-box', name: 'Top box', description: 'Storage box above a wardrobe, two doors.', room_types: ['bedroom'], mount: 'wall', elevation_mm: 2200, slots: [CARCASS, FRONT], structure: { doors: 2, back: true }, widths: [500, 600, 800, 1000], height_mm: 400, depth_mm: 600, labour_hours: 1 }),
  unit({ slug: 'chest-of-drawers', name: 'Chest of drawers', description: 'Four soft-close drawers.', room_types: ['bedroom'], mount: 'floor', slots: [CARCASS, FRONT], structure: { drawers: 4, back: true, plinth_mm: 80 }, widths: [500, 800, 1000], height_mm: 820, depth_mm: 450, labour_hours: 1.5 }),
  unit({ slug: 'bedside', name: 'Bedside unit', description: 'Two drawers beside the bed.', room_types: ['bedroom'], mount: 'floor', slots: [CARCASS, FRONT], structure: { drawers: 2, back: true, plinth_mm: 50 }, widths: [450, 500], height_mm: 550, depth_mm: 400, labour_hours: 1 }),

  // Media wall
  unit({ slug: 'media-base', name: 'Media base unit', description: 'Low unit under the TV with two lift-up doors.', room_types: ['media-wall'], mount: 'floor', slots: [CARCASS, FRONT], structure: { doors: 2, back: true }, widths: [1200, 1500, 1800], height_mm: 450, depth_mm: 450, labour_hours: 2 }),
  unit({ slug: 'media-column', name: 'Side column', description: 'Tall shelving column beside the TV, one door below.', room_types: ['media-wall'], mount: 'tall', slots: [CARCASS, FRONT], structure: { doors: 1, shelves: 4, back: true }, widths: [400, 500, 600], height_mm: 2200, depth_mm: 350, labour_hours: 2 }),
  flat({
    slug: 'media-feature-panel', name: 'TV feature panel', description: 'Face panel on a hidden batten frame.', room_types: ['media-wall'], mount: 'tall', slots: [FRONT, CARCASS], labour_hours: 2,
    variants: sized('media-feature-panel', [600, 900, 1200], 2400, 60, (w, id) => [
      { id: `${id}-face`, label: 'Face panel', slot: 'front', length_mm: 2400, width_mm: w, qty: 1 },
      { id: `${id}-batten`, label: 'Frame batten', slot: 'carcass', length_mm: 2400, width_mm: 60, qty: 3 },
    ]),
  }),
  unit({ slug: 'floating-shelf', name: 'Floating shelf box', description: 'Shallow open box shelf, no doors.', room_types: ['media-wall', 'alcove', 'office'], mount: 'wall', elevation_mm: 1550, slots: [FRONT], structure: {}, widths: [600, 900, 1200], height_mm: 360, depth_mm: 250, labour_hours: 0.5 }),

  // Home office
  unit({ slug: 'office-pedestal', name: 'Desk pedestal', description: 'Three drawers with a section of desk top.', room_types: ['office'], mount: 'floor', slots: [CARCASS, FRONT, WORKTOP], structure: { drawers: 3, back: true, worktop: true }, widths: [400, 500], height_mm: 720, depth_mm: 580, labour_hours: 1.5 }),
  unit({ slug: 'office-cupboard', name: 'Desk-height cupboard', description: 'Cupboard with a shelf and a section of desk top.', room_types: ['office'], mount: 'floor', slots: [CARCASS, FRONT, WORKTOP], structure: { doors: 2, shelves: 1, back: true, worktop: true }, widths: [600, 800, 1000], height_mm: 720, depth_mm: 580, labour_hours: 1.5 }),
  unit({ slug: 'office-bookcase', name: 'Tall bookcase', description: 'Open shelving, floor to ceiling.', room_types: ['office', 'alcove'], mount: 'tall', slots: [CARCASS, BACK], structure: { shelves: 5, back: true }, widths: [600, 800, 1000], height_mm: 2200, depth_mm: 350, labour_hours: 2 }),

  // Alcoves & living storage
  unit({ slug: 'alcove-cupboard', name: 'Alcove cupboard', description: 'Low cupboard with a shelf, made to fit the alcove.', room_types: ['alcove'], mount: 'floor', slots: [CARCASS, FRONT], structure: { doors: 2, shelves: 1, back: true, plinth_mm: 50 }, widths: [600, 800, 1000, 1200], height_mm: 800, depth_mm: 400, labour_hours: 2 }),
  unit({ slug: 'alcove-shelving', name: 'Alcove shelving', description: 'Open shelves above an alcove cupboard.', room_types: ['alcove'], mount: 'wall', elevation_mm: 900, slots: [CARCASS], structure: { shelves: 3 }, widths: [600, 800, 1000, 1200], height_mm: 1500, depth_mm: 300, labour_hours: 1.5 }),
].map((template, position) => ({ ...template, position }));

/** Adds templates that are missing, updates ones nobody has edited, keeps the rest. */
export async function importStarterLibrary(db: DatabaseService): Promise<{ added: number; refreshed: number; kept: number }> {
  const result = { added: 0, refreshed: 0, kept: 0 };
  for (const template of STARTER_LIBRARY) {
    const existing = await db.quoteMaker.templates.findFirstWhere({ slug: template.slug });
    const now = new Date().toISOString();
    if (!existing) {
      await db.quoteMaker.templates.create({ ...template, updated_by: STARTER_BY, created_at: now, updated_at: now });
      result.added += 1;
    } else if (existing.updated_by === STARTER_BY) {
      await db.quoteMaker.templates.update(existing.id, { ...template, updated_at: now });
      result.refreshed += 1;
    } else {
      result.kept += 1;
    }
  }
  return result;
}
