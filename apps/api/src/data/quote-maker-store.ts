import { Prisma } from '@prisma/client';

import { BaseRecord } from '../common/types/domain';
import { BOARD_ROLES } from './inventory-store';
import { PrismaRepository } from './prisma-repository';
import { PrismaService } from './prisma.service';

/* Quote maker (modules/quote-maker). Types live here, not in domain.ts, so the feature stays in its own files. */

export type BoardRole = (typeof BOARD_ROLES)[number];
export const MOUNTS = ['floor', 'wall', 'tall', 'gap'] as const;

/** A piece cut from the board in `slot`. length_mm runs along a grained board's grain. */
export interface TemplatePanel {
  id: string;
  label: string;
  slot: string;
  length_mm: number;
  width_mm: number;
  qty: number;
}

export interface TemplateVariant {
  id: string;
  width_mm: number;
  height_mm: number;
  depth_mm: number;
  panels: TemplatePanel[];
}

/** What a group of panels is cut from: the customer's pick, else this default, else the pricing default for the role. */
export interface TemplateSlot {
  key: string;
  label: string;
  roles: BoardRole[];
  default_item_id: string | null;
}

export interface TemplateStructure {
  doors: number;
  drawers: number;
  shelves: number;
  back: boolean;
  plinth_mm: number;
  worktop: boolean;
}

export interface UnitTemplate extends BaseRecord {
  slug: string;
  name: string;
  description: string | null;
  room_types: string[];
  mount: (typeof MOUNTS)[number];
  elevation_mm: number;
  structure: TemplateStructure;
  slots: TemplateSlot[];
  variants: TemplateVariant[];
  hardware: Array<{ item_id: string; qty: number }>;
  labour_hours: number;
  labour_extra: number;
  active: boolean;
  position: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Pricing settings, in £ and mm. `defaults` is the board each role falls back to (inventory item id). */
export interface QuotePricing {
  margin_pct: number;
  range_low_pct: number;
  range_high_pct: number;
  kerf_mm: number;
  edge_trim_mm: number;
  round_to: number;
  hourly_rate: number;
  defaults: Partial<Record<BoardRole, string>>;
}

/** A run of walls: one, two facing (galley), two meeting (L) or three (U). See WALL_COUNT in modules/quote-maker/engine. */
export type Layout = 'single' | 'galley' | 'L' | 'U';

/** A unit on a wall: x_mm is its left edge, measured from the wall's left end as you face it. */
export interface PlacedUnit {
  id: string;
  template_id: string;
  variant_id: string;
  x_mm: number;
  /** slot key -> inventory item id; a missing slot uses its default. */
  finishes?: Record<string, string>;
}

export interface PlanWall {
  length_mm: number;
  units: PlacedUnit[];
}

/** Work that is not a unit (a delivery, a bespoke piece): a cost, a quantity and a margin. Staff designs only. */
export interface ExtraLine {
  id: string;
  name: string;
  quantity: number;
  /** £ each, net. */
  cost: number;
  /** Null = the Pricing settings' margin. */
  margin_pct: number | null;
}

/** What a design draws and prices: the walls, an optional free-standing island, the ceiling. */
export interface Plan {
  layout: Layout;
  height_mm: number;
  walls: PlanWall[];
  island: PlanWall | null;
  /** Custom lines; absent on older designs. Added to the price and carried into Make quote. */
  extras?: ExtraLine[];
}

export interface QuoteDesign extends BaseRecord {
  ref_no: number;
  source: 'web' | 'staff';
  title: string | null;
  room_type: string;
  design: Plan;
  answers: Record<string, unknown> | null;
  estimate_low: number | null;
  estimate_high: number | null;
  enquiry_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const SETTINGS_ID = 'quote_maker';

export class QuoteMakerStore {
  readonly templates: PrismaRepository<UnitTemplate>;
  readonly designs: PrismaRepository<QuoteDesign>;

  constructor(private readonly prisma: PrismaService) {
    this.templates = new PrismaRepository(prisma.unitTemplate, 'unit_templates', {
      dates: ['created_at', 'updated_at'],
      decimals: ['labour_hours', 'labour_extra'],
    });
    this.designs = new PrismaRepository(prisma.quoteDesign, 'quote_designs', {
      dates: ['created_at', 'updated_at'],
      decimals: ['estimate_low', 'estimate_high'],
    });
  }

  /** ref_no is the database's (autoincrement). */
  createDesign(data: Omit<QuoteDesign, 'id' | 'ref_no'>): Promise<QuoteDesign> {
    return this.designs.create(data as Omit<QuoteDesign, 'id'>);
  }

  /**
   * Website designs older than `before` that came to nothing: no quote made from them and their
   * enquiry not Converted. Staff designs are never removed here. The enquiry itself stays.
   */
  async purgeWebDesigns(before: Date): Promise<number> {
    const { count } = await this.prisma.quoteDesign.deleteMany({
      where: {
        source: 'web',
        created_at: { lt: before },
        quotes: { none: {} },
        OR: [{ enquiry_id: null }, { enquiry: { status: { not: 'Converted' } } }],
      },
    });
    return count;
  }

  /** What was saved, unchecked: the service merges it over the defaults. */
  async pricing(): Promise<Record<string, unknown>> {
    const row = await this.prisma.quoteMakerSetting.findUnique({ where: { id: SETTINGS_ID } });
    const stored = row?.pricing;
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  }

  async setPricing(pricing: QuotePricing, by: string): Promise<void> {
    const data = { pricing: pricing as unknown as Prisma.InputJsonValue, updated_at: new Date(), updated_by: by };
    await this.prisma.quoteMakerSetting.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...data }, update: data });
  }
}
