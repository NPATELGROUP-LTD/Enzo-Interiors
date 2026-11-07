import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { randomUUID } from 'node:crypto';

import { ActivityLogService } from '../../core/activity-log.service';
import { CurrentUser, Public, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';
import { BOARD_ROLES, InventoryItem } from '../../data/inventory-store';
import { BoardRole, MOUNTS, QuotePricing, UnitTemplate } from '../../data/quote-maker-store';
import { SiteSettingsModule, SiteSettingsService } from '../site-settings/site-settings.module';
import {
  Breakdown,
  DesignUnit,
  MAX_PIECES,
  generatePanels,
  PriceItem,
  ROOM_TYPE_IDS,
  ROOM_TYPES,
  ResolvedUnit,
  pieceCount,
  priceDesign,
  resolveUnit,
  slotDefault,
  templateProblems,
} from './engine';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);
export const ID = /^[a-z0-9][a-z0-9-]{0,59}$/;
const KEY = /^[a-z][a-z0-9_]{0,29}$/;
const money = { maxDecimalPlaces: 2 };

/* ------------------------------------------------------------------- DTOs */

export class PanelDto {
  @IsOptional() @Matches(ID) id?: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(60) label!: string;
  @Matches(KEY) slot!: string;
  @IsInt() @Min(1) @Max(10_000) length_mm!: number;
  @IsInt() @Min(1) @Max(10_000) width_mm!: number;
  @IsInt() @Min(1) @Max(50) qty!: number;
}

export class VariantDto {
  @IsOptional() @Matches(ID) id?: string;
  @IsInt() @Min(10) @Max(10_000) width_mm!: number;
  @IsInt() @Min(10) @Max(5_000) height_mm!: number;
  @IsInt() @Min(10) @Max(2_000) depth_mm!: number;
  @IsArray() @ArrayMaxSize(40) @ValidateNested({ each: true }) @Type(() => PanelDto) panels!: PanelDto[];
}

export class SlotDto {
  @Matches(KEY) key!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(60) label!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(4) @IsIn(BOARD_ROLES, { each: true }) roles!: BoardRole[];
  @IsOptional() @IsString() @MaxLength(64) default_item_id?: string | null;
}

export class StructureDto {
  @IsInt() @Min(0) @Max(6) doors!: number;
  @IsInt() @Min(0) @Max(8) drawers!: number;
  @IsInt() @Min(0) @Max(12) shelves!: number;
  @IsBoolean() back!: boolean;
  @IsInt() @Min(0) @Max(300) plinth_mm!: number;
  @IsBoolean() worktop!: boolean;
}

export class HardwareDto {
  @IsString() @MaxLength(64) item_id!: string;
  @IsInt() @Min(1) @Max(100) qty!: number;
}

export class TemplateDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'The short name is lower-case letters, numbers and dashes.' }) @MaxLength(60) slug!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) description?: string | null;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(ROOM_TYPE_IDS.length) @IsIn(ROOM_TYPE_IDS, { each: true }) room_types!: string[];
  @IsIn(MOUNTS) mount!: UnitTemplate['mount'];
  @IsInt() @Min(0) @Max(5_000) elevation_mm!: number;
  @ValidateNested() @Type(() => StructureDto) structure!: StructureDto;
  @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => SlotDto) slots!: SlotDto[];
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => VariantDto) variants!: VariantDto[];
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => HardwareDto) hardware!: HardwareDto[];
  @IsNumber(money) @Min(0) @Max(100) labour_hours!: number;
  @IsNumber(money) @Min(0) @Max(100_000) labour_extra!: number;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10_000) position?: number;
}

export class PricingDefaultsDto {
  @IsOptional() @IsString() @MaxLength(64) carcass?: string | null;
  @IsOptional() @IsString() @MaxLength(64) front?: string | null;
  @IsOptional() @IsString() @MaxLength(64) worktop?: string | null;
  @IsOptional() @IsString() @MaxLength(64) back?: string | null;
}

export class PricingDto {
  @IsNumber(money) @Min(0) @Max(500) margin_pct!: number;
  @IsNumber(money) @Min(0) @Max(50) range_low_pct!: number;
  @IsNumber(money) @Min(0) @Max(100) range_high_pct!: number;
  @IsNumber(money) @Min(0) @Max(20) kerf_mm!: number;
  @IsNumber(money) @Min(0) @Max(100) edge_trim_mm!: number;
  @IsInt() @Min(1) @Max(1_000) round_to!: number;
  @IsNumber(money) @Min(0) @Max(1_000) hourly_rate!: number;
  @ValidateNested() @Type(() => PricingDefaultsDto) defaults!: PricingDefaultsDto;
}

/** A size and the unit's structure, for the standard cut-list the Unit library starts a size from. */
export class PanelsDto {
  @ValidateNested() @Type(() => StructureDto) structure!: StructureDto;
  @IsInt() @Min(10) @Max(10_000) width_mm!: number;
  @IsInt() @Min(10) @Max(5_000) height_mm!: number;
  @IsInt() @Min(10) @Max(2_000) depth_mm!: number;
  @IsArray() @ArrayMaxSize(6) @Matches(KEY, { each: true }) slots!: string[];
}

export class DesignUnitDto {
  @IsString() @MaxLength(64) template_id!: string;
  @Matches(ID) variant_id!: string;
  /** slot key -> inventory item id; checked in the service (class-validator cannot type a record). */
  @IsOptional() @IsObject() finishes?: Record<string, string>;
}

export class DesignDto {
  @IsArray() @ArrayMaxSize(80) @ValidateNested({ each: true }) @Type(() => DesignUnitDto) units!: DesignUnitDto[];
}

/* ---------------------------------------------------------------- service */

/** Placeholders until the Admin saves Pricing settings; computed on read, never written into the row. */
export const DEFAULT_PRICING: QuotePricing = {
  margin_pct: 70,
  range_low_pct: 5,
  range_high_pct: 15,
  kerf_mm: 4,
  edge_trim_mm: 10,
  round_to: 50,
  hourly_rate: 30,
  defaults: {},
};

const priceItem = (item: InventoryItem): PriceItem => ({
  id: item.id,
  name: item.name,
  board_role: item.board_role,
  length_mm: item.length_mm,
  width_mm: item.width_mm,
  grain: item.grain,
  active: item.active,
  show_on_site: item.show_on_site,
  cost: item.quote_cost ?? item.avg_cost,
});

export function cleanFinishes(value: unknown): Record<string, string> | undefined {
  if (value === undefined || value === null) return undefined;
  const entries = typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : null;
  if (!entries || entries.length > 10 || entries.some(([k, v]) => !KEY.test(k) || typeof v !== 'string' || v.length > 64))
    throw new BadRequestException('Finishes must be a short list of slot: item.');
  return Object.fromEntries(entries) as Record<string, string>;
}

/**
 * The quote maker's server side: the unit library, pricing settings and pricing itself. The browser
 * never prices: costs never leave the API, and every design is priced here from live inventory.
 * Visitors (Public, behind the Settings › Pages switch `quote`) get the catalogue without costs or
 * panels, and a rounded range; the Admin gets the library, the settings and the full breakdown.
 */
@Injectable()
export class QuoteMakerService {
  constructor(
    private readonly db: DatabaseService,
    private readonly site: SiteSettingsService,
    private readonly activity: ActivityLogService,
  ) {}

  private get store() {
    return this.db.quoteMaker;
  }

  async pricing(): Promise<QuotePricing> {
    const saved = await this.store.pricing();
    const num = (key: Exclude<keyof QuotePricing, 'defaults'>) =>
      typeof saved[key] === 'number' && Number.isFinite(saved[key]) ? (saved[key] as number) : DEFAULT_PRICING[key];
    const stored = (saved.defaults && typeof saved.defaults === 'object' ? saved.defaults : {}) as Record<string, unknown>;
    const defaults = Object.fromEntries(BOARD_ROLES.flatMap((role) => (typeof stored[role] === 'string' ? [[role, stored[role]]] : [])));
    return {
      margin_pct: num('margin_pct'),
      range_low_pct: num('range_low_pct'),
      range_high_pct: num('range_high_pct'),
      kerf_mm: num('kerf_mm'),
      edge_trim_mm: num('edge_trim_mm'),
      round_to: num('round_to'),
      hourly_rate: num('hourly_rate'),
      defaults,
    };
  }

  async savePricing(principal: AuthPrincipal, dto: PricingDto): Promise<QuotePricing> {
    const defaults: QuotePricing['defaults'] = {};
    const ids = BOARD_ROLES.flatMap((role) => (dto.defaults[role] ? [dto.defaults[role]!] : []));
    const items = await this.items(ids);
    for (const role of BOARD_ROLES) {
      const id = dto.defaults[role];
      if (!id) continue;
      this.assertBoard(items.get(id), [role], `The default ${role} board`);
      defaults[role] = id;
    }
    const before = await this.pricing();
    const pricing: QuotePricing = { ...dto, defaults };
    await this.store.setPricing(pricing, principal.name);
    await this.activity.record({
      principal,
      action: 'quote_pricing_update',
      targetTable: 'quote_maker_settings',
      targetId: 'quote_maker',
      details: { from: { ...before, defaults: undefined }, to: { ...pricing, defaults: undefined } },
    });
    return pricing;
  }

  /** Inventory rows by id, plus, if asked, every finish offered on the website. */
  private async rows(ids: Iterable<string>, withFinishes = false): Promise<InventoryItem[]> {
    const list = [...new Set(ids)];
    if (!list.length && !withFinishes) return [];
    const byId = { id: { in: list } };
    return this.db.inventory.items.findWhere(withFinishes ? { OR: [byId, { show_on_site: true, active: true }] } : byId);
  }

  /** The same, as the engine reads them. */
  private async items(ids: Iterable<string>): Promise<Map<string, PriceItem>> {
    return new Map((await this.rows(ids)).map((row) => [row.id, priceItem(row)]));
  }

  private itemIds(templates: UnitTemplate[], pricing: QuotePricing): string[] {
    return [
      ...Object.values(pricing.defaults),
      ...templates.flatMap((t) => [...t.slots.flatMap((s) => (s.default_item_id ? [s.default_item_id] : [])), ...t.hardware.map((h) => h.item_id)]),
    ].filter((id): id is string => !!id);
  }

  private assertBoard(item: PriceItem | undefined, roles: readonly BoardRole[], what: string): void {
    if (!item) throw new BadRequestException(`${what} is not in Inventory.`);
    if (!item.active) throw new BadRequestException(`${what} (${item.name}) is switched off.`);
    if (!item.board_role || !roles.includes(item.board_role) || !item.length_mm || !item.width_mm)
      throw new BadRequestException(`${what} (${item.name}) must be a ${roles.join('/')} board with its sheet size filled in.`);
  }

  /* ---- Unit library (Admin) ---- */

  async templates(): Promise<Array<UnitTemplate & { problems: string[] }>> {
    const [templates, pricing] = await Promise.all([
      this.store.templates.findWhere({}, { orderBy: { position: 'asc' } }),
      this.pricing(),
    ]);
    const items = await this.items(this.itemIds(templates, pricing));
    return templates.map((t) => ({ ...t, problems: templateProblems(t, items, pricing) }));
  }

  async template(id: string): Promise<UnitTemplate & { problems: string[] }> {
    const template = await this.store.templates.findById(id);
    if (!template) throw new NotFoundException('Unit not found.');
    const pricing = await this.pricing();
    return { ...template, problems: templateProblems(template, await this.items(this.itemIds([template], pricing)), pricing) };
  }

  private async templateFields(principal: AuthPrincipal, dto: TemplateDto) {
    const keys = new Set(dto.slots.map((s) => s.key));
    if (keys.size !== dto.slots.length) throw new BadRequestException('Two material slots have the same key.');
    const variantIds = new Set<string>();
    const variants = dto.variants.map((variant) => {
      const id = variant.id ?? `${dto.slug}-${randomUUID().slice(0, 8)}`;
      if (variantIds.has(id)) throw new BadRequestException('Two sizes have the same id.');
      variantIds.add(id);
      const panelIds = new Set<string>();
      const panels = variant.panels.map((panel) => {
        if (!keys.has(panel.slot)) throw new BadRequestException(`${panel.label} is cut from "${panel.slot}", which is not one of this unit's materials.`);
        const panelId = panel.id ?? `${id}-${randomUUID().slice(0, 8)}`;
        if (panelIds.has(panelId)) throw new BadRequestException('Two panels in one size have the same id.');
        panelIds.add(panelId);
        return { id: panelId, label: panel.label, slot: panel.slot, length_mm: panel.length_mm, width_mm: panel.width_mm, qty: panel.qty };
      });
      return { id, width_mm: variant.width_mm, height_mm: variant.height_mm, depth_mm: variant.depth_mm, panels };
    });

    const items = await this.items([...dto.slots.flatMap((s) => (s.default_item_id ? [s.default_item_id] : [])), ...dto.hardware.map((h) => h.item_id)]);
    const slots = dto.slots.map((slot) => {
      if (slot.default_item_id) this.assertBoard(items.get(slot.default_item_id), slot.roles, `${slot.label}'s default board`);
      return { key: slot.key, label: slot.label, roles: [...new Set(slot.roles)], default_item_id: slot.default_item_id || null };
    });
    for (const line of dto.hardware) {
      const item = items.get(line.item_id);
      if (!item?.active) throw new BadRequestException('A hardware item is not in Inventory or is switched off.');
    }
    const s = dto.structure;
    return {
      slug: dto.slug,
      name: dto.name,
      description: dto.description ?? null,
      room_types: [...new Set(dto.room_types)],
      mount: dto.mount,
      elevation_mm: dto.elevation_mm,
      structure: { doors: s.doors, drawers: s.drawers, shelves: s.shelves, back: s.back, plinth_mm: s.plinth_mm, worktop: s.worktop },
      slots,
      variants,
      hardware: dto.hardware.map(({ item_id, qty }) => ({ item_id, qty })),
      labour_hours: dto.labour_hours,
      labour_extra: dto.labour_extra,
      active: dto.active ?? true,
      position: dto.position ?? 0,
      updated_by: principal.name,
      updated_at: new Date().toISOString(),
    };
  }

  async createTemplate(principal: AuthPrincipal, dto: TemplateDto) {
    const fields = await this.templateFields(principal, dto);
    const created = await this.unique(() => this.store.templates.create({ ...fields, created_at: fields.updated_at }));
    return this.template(created.id);
  }

  /** Replaces the whole template. Keep variant ids to keep designs that use a size pointing at it. */
  async updateTemplate(principal: AuthPrincipal, id: string, dto: TemplateDto) {
    const fields = await this.templateFields(principal, dto);
    if (!(await this.unique(() => this.store.templates.update(id, fields)))) throw new NotFoundException('Unit not found.');
    return this.template(id);
  }

  private async unique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Another unit has that short name.');
      throw error;
    }
  }

  /* ---- Public ---- */

  private async assertOpen(): Promise<void> {
    if (!(await this.site.pageOn('quote'))) throw new ForbiddenException('The quote maker is not open yet.');
  }

  /** What a visitor may design with: no costs, no panels, no inventory names, no hardware. */
  async catalogue() {
    await this.assertOpen();
    const [templates, pricing] = await Promise.all([
      this.store.templates.findWhere({ active: true }, { orderBy: { position: 'asc' } }),
      this.pricing(),
    ]);
    const rows = await this.rows(this.itemIds(templates, pricing), true);
    const items = new Map(rows.map((row) => [row.id, priceItem(row)]));
    const full = new Map(rows.map((row) => [row.id, row]));
    const finishes = rows.filter((r) => r.active && r.show_on_site && r.board_role && r.length_mm && r.width_mm);
    const media = await this.db.mediaAssets.findWhere({ id: { in: finishes.flatMap((r) => (r.image_id ? [r.image_id] : [])) } });
    const base = (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '');
    const src = new Map(media.map((m) => [m.id, `${base}/${m.storage_key}`]));

    return {
      room_types: ROOM_TYPES,
      templates: templates
        .filter((t) => templateProblems(t, items, pricing).length === 0)
        .map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          description: t.description,
          room_types: t.room_types,
          mount: t.mount,
          elevation_mm: t.elevation_mm,
          structure: t.structure,
          slots: t.slots.map((slot) => {
            const fallback = slotDefault(slot, items, pricing);
            return {
              key: slot.key,
              label: slot.label,
              roles: slot.roles,
              // The default is named only when it is itself a finish on offer; otherwise just its colour.
              default_finish_id: fallback?.show_on_site ? fallback.id : null,
              default_swatch: fallback ? (full.get(fallback.id)?.swatch ?? null) : null,
            };
          }),
          variants: t.variants.map(({ id, width_mm, height_mm, depth_mm }) => ({ id, width_mm, height_mm, depth_mm })),
        })),
      finishes: finishes.map((row) => ({
        id: row.id,
        name: row.public_name ?? row.name,
        role: row.board_role,
        swatch: row.swatch,
        image: row.image_id ? (src.get(row.image_id) ?? null) : null,
        grain: row.grain,
        thickness_mm: row.thickness_mm,
      })),
    };
  }

  /** The posted units made concrete and checked, with what pricing them needs. Throws 400 with the reason. */
  async resolve(dto: DesignDto, publicOnly: boolean): Promise<{ units: ResolvedUnit[]; items: Map<string, PriceItem>; pricing: QuotePricing }> {
    const units: DesignUnit[] = dto.units.map((u) => ({ template_id: u.template_id, variant_id: u.variant_id, finishes: cleanFinishes(u.finishes) }));
    const [templates, pricing] = await Promise.all([
      this.store.templates.findWhere({ id: { in: [...new Set(units.map((u) => u.template_id))] } }),
      this.pricing(),
    ]);
    const byId = new Map(templates.map((t) => [t.id, t]));
    const items = await this.items([...this.itemIds(templates, pricing), ...units.flatMap((u) => Object.values(u.finishes ?? {}))]);
    const resolved = units.map((unit, index) => {
      const result = resolveUnit(unit, String(index), byId.get(unit.template_id), items, pricing, publicOnly);
      if (typeof result === 'string') throw new BadRequestException(result);
      return result;
    });
    if (pieceCount(resolved) > MAX_PIECES) throw new BadRequestException('This design is too big to price here. Send it and the studio will price it.');
    return { units: resolved, items, pricing };
  }

  /** A visitor's range, VAT included. Not priced (null) when any board or fitting used has no cost yet. */
  async estimate(dto: DesignDto): Promise<{ priced: boolean; low: number | null; high: number | null; vat_rate: number }> {
    await this.assertOpen();
    const { units, items, pricing } = await this.resolve(dto, true);
    const { vat_rate } = await this.db.settings();
    const result = priceDesign(units, items, pricing, vat_rate);
    const priced = result.unpriced.length === 0;
    return { priced, low: priced ? result.low : null, high: priced ? result.high : null, vat_rate };
  }

  /** The Admin's full working: sheets and their cutting layouts, hardware, labour, cost, margin, VAT. */
  async breakdown(dto: DesignDto): Promise<Breakdown & { vat_rate: number; margin_pct: number }> {
    const { units, items, pricing } = await this.resolve(dto, false);
    const { vat_rate } = await this.db.settings();
    return { ...priceDesign(units, items, pricing, vat_rate), vat_rate, margin_pct: pricing.margin_pct };
  }
}

/* ------------------------------------------------------------- controller */

@Controller('quote-maker')
@Roles('Admin')
export class QuoteMakerController {
  constructor(private readonly quoteMaker: QuoteMakerService) {}

  @Public() @Get('catalogue') @Throttle({ default: { limit: 60, ttl: 60_000 } })
  catalogue() {
    return this.quoteMaker.catalogue();
  }

  @Public() @Post('estimate') @HttpCode(200) @Throttle({ default: { limit: 60, ttl: 60_000 } })
  estimate(@Body() dto: DesignDto) {
    return this.quoteMaker.estimate(dto);
  }

  /** The standard cut-list for a size (a starting point the Admin edits); ids are made when the unit is saved. */
  @Post('panels') @HttpCode(200) panels(@Body() dto: PanelsDto) {
    return generatePanels(dto.structure, dto, dto.slots.map((key) => ({ key })), 'new').map(({ id: _id, ...panel }) => panel);
  }

  @Post('breakdown') @HttpCode(200) breakdown(@Body() dto: DesignDto) {
    return this.quoteMaker.breakdown(dto);
  }

  @Get('pricing') pricing() {
    return this.quoteMaker.pricing();
  }
  @Put('pricing') savePricing(@CurrentUser() principal: AuthPrincipal, @Body() dto: PricingDto) {
    return this.quoteMaker.savePricing(principal, dto);
  }

  @Get('templates') templates() {
    return this.quoteMaker.templates();
  }
  @Get('templates/:id') template(@Param('id') id: string) {
    return this.quoteMaker.template(id);
  }
  @Post('templates') create(@CurrentUser() principal: AuthPrincipal, @Body() dto: TemplateDto) {
    return this.quoteMaker.createTemplate(principal, dto);
  }
  @Put('templates/:id') update(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: TemplateDto) {
    return this.quoteMaker.updateTemplate(principal, id, dto);
  }
}

/** Remove the feature: delete this folder (QuoteDesignsModule in designs.ts too), data/quote-maker-store.ts, its line in DatabaseService and AppModule, and the call in scripts/import-content.ts. */
@Module({
  imports: [SiteSettingsModule],
  controllers: [QuoteMakerController],
  providers: [QuoteMakerService],
  exports: [QuoteMakerService],
})
export class QuoteMakerModule {}
