import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  Param,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
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
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';

import { CurrentUser, Public, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';
import type { Layout, Plan, PlanWall, QuoteDesign } from '../../data/quote-maker-store';
import { EnquiriesModule, EnquiriesService } from '../enquiries/enquiries.module';
import { QuotesModule, QuotesService } from '../quotes/quotes.module';
import {
  type FillAnswers,
  LAYOUTS,
  PLAN_LIMITS,
  DESIGN_ROOM_IDS,
  ROOM_TYPE_IDS,
  ROOM_TYPES,
  fillPlan,
  planShapeProblem,
  planUnits,
  priceDesign,
  unitsOffWall,
  wallLabel,
} from './engine';
import { ID, QuoteMakerModule, QuoteMakerService, cleanFinishes } from './quote-maker.module';

const L = PLAN_LIMITS;
const MAX_UNITS = 80;
/** A quote takes at most 50 lines (QuotesService); identical units on one run share a line. */
const MAX_LINES = 50;
const LIST_LIMIT = 200;

export const designRef = (ref: number) => `QD-${String(ref).padStart(4, '0')}`;
const LAYOUT_NAME: Record<Layout, string> = { single: 'One wall', galley: 'Galley', L: 'L-shape', U: 'U-shape' };
/** A blank room (CUSTOM_ROOM) is in no list. */
const roomName = (id: string) => ROOM_TYPES.find((room) => room.id === id)?.name ?? 'Custom room';
const gbp = (n: number) => `£${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Website designs that came to nothing go after this long (privacy text in the portal and the site). */
const KEEP_MONTHS = 12;
const HOUR_MS = 60 * 60_000;

/* ------------------------------------------------------------------- DTOs */

export class PlacedUnitDto {
  @Matches(ID) id!: string;
  @IsString() @MaxLength(64) template_id!: string;
  @Matches(ID) variant_id!: string;
  @IsInt() @Min(0) @Max(L.wall_max) x_mm!: number;
  @IsOptional() @IsObject() finishes?: Record<string, string>;
}

export class PlanWallDto {
  @IsInt() @Min(L.wall_min) @Max(L.wall_max) length_mm!: number;
  @IsArray() @ArrayMaxSize(MAX_UNITS) @ValidateNested({ each: true }) @Type(() => PlacedUnitDto) units!: PlacedUnitDto[];
}

export class PlanDto {
  @IsIn(LAYOUTS) layout!: Layout;
  @IsInt() @Min(L.height_min) @Max(L.height_max) height_mm!: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => PlanWallDto) walls!: PlanWallDto[];
  @IsOptional() @ValidateNested() @Type(() => PlanWallDto) island?: PlanWallDto | null;
}

export class FillDto {
  @IsIn(ROOM_TYPE_IDS) room_type!: string;
  @IsIn(LAYOUTS) layout!: Layout;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @IsInt({ each: true }) @Min(L.wall_min, { each: true }) @Max(L.wall_max, { each: true }) walls!: number[];
  @IsInt() @Min(L.height_min) @Max(L.height_max) height_mm!: number;
  @IsOptional() @IsInt() @Min(L.island_min) @Max(L.island_max) island_mm?: number | null;
  @IsBoolean() upper!: boolean;
  @IsOptional() @IsObject() finishes?: Record<string, string>;
  @IsOptional() @IsArray() @ArrayMaxSize(6) @IsString({ each: true }) @MaxLength(64, { each: true }) gaps?: string[];
}

export class SaveDesignDto {
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value)) @IsString() @MaxLength(120) title?: string | null;
  @IsIn(DESIGN_ROOM_IDS) room_type!: string;
  @ValidateNested() @Type(() => PlanDto) design!: PlanDto;
  /** The questions it was filled from, kept so the Admin sees what the visitor said. */
  @IsOptional() @ValidateNested() @Type(() => FillDto) answers?: FillDto | null;
}

export class ProjectDto {
  @IsString() @MaxLength(64) project_id!: string;
}

export class ListDesignsQuery {
  @IsOptional() @IsString() @MaxLength(64) enquiry_id?: string;
}

/** A visitor's design and how to reach them; it becomes an enquiry (source Quote) with the design on it. */
export class SubmitRoomDto {
  @IsIn(DESIGN_ROOM_IDS) room_type!: string;
  @ValidateNested() @Type(() => PlanDto) design!: PlanDto;
  @IsOptional() @ValidateNested() @Type(() => FillDto) answers?: FillDto | null;
}

export class SubmitDesignDto {
  /** One design per room the visitor is asking about. */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(ROOM_TYPE_IDS.length) @ValidateNested({ each: true }) @Type(() => SubmitRoomDto) rooms!: SubmitRoomDto[];
  @Transform(trimmed) @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @Transform(trimmed) @IsEmail({}, { message: 'Enter a valid email address' }) @MaxLength(254) email!: string;
  @IsOptional() @Transform(trimmed) @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(5000) message?: string;
  /** Honeypot. Hidden from people; a bot that fills it gets a quiet 204. */
  @IsOptional() @IsString() @MaxLength(500) website?: string;
}

export interface Estimate {
  priced: boolean;
  low: number | null;
  high: number | null;
}

/* ---------------------------------------------------------------- service */

export interface DesignSummary {
  id: string;
  ref: string;
  title: string | null;
  room_type: string;
  source: QuoteDesign['source'];
  units: number;
  estimate_low: number | null;
  estimate_high: number | null;
  enquiry: { id: string; name: string; email: string; status: string } | null;
  quotes: Array<{ id: string; number: string; status: string }>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type DesignView = DesignSummary & { design: Plan; answers: QuoteDesign['answers'] };

/**
 * Saved quote maker designs (Admin): drawn and priced in the editor, turned into a Draft project
 * quote, or into what a project needs from stock. Every save is checked and priced again here.
 */
@Injectable()
export class QuoteDesignsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(QuoteDesignsService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly db: DatabaseService,
    private readonly quoteMaker: QuoteMakerService,
    private readonly quotes: QuotesService,
    private readonly enquiries: EnquiriesService,
    private readonly activity: ActivityLogService,
  ) {}

  private get store() {
    return this.db.quoteMaker;
  }

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.purge(), HOUR_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  /** Hourly: website designs older than 12 months with no quote made and an enquiry not Converted. Never throws. */
  async purge(now = new Date()): Promise<number> {
    const before = new Date(now);
    before.setUTCMonth(before.getUTCMonth() - KEEP_MONTHS);
    try {
      const removed = await this.store.purgeWebDesigns(before);
      if (removed) this.logger.log(`Removed ${removed} website design(s) older than ${KEEP_MONTHS} months.`);
      return removed;
    } catch (error) {
      this.logger.error(`Design clean-up failed: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  private answers(dto: FillDto): FillAnswers {
    return { ...dto, island_mm: dto.island_mm ?? null, finishes: cleanFinishes(dto.finishes) ?? {}, gaps: dto.gaps ?? [] };
  }

  /** The questions as a plan to carry on from, with any active unit (staff are not held to the website's list). */
  async fill(dto: FillDto): Promise<Plan> {
    const templates = await this.store.templates.findWhere({ active: true }, { orderBy: { position: 'asc' } });
    return fillPlan(this.answers(dto), templates, () => `u-${randomUUID().slice(0, 12)}`);
  }

  /** A visitor's questions as a starting plan: only the website's units, only finishes ticked "show on website". */
  async start(dto: FillDto): Promise<Plan> {
    await this.quoteMaker.assertOpen();
    const plan = fillPlan(this.answers(dto), await this.quoteMaker.publicTemplates(), () => `u-${randomUUID().slice(0, 12)}`);
    const units = planUnits(plan);
    if (units.length) await this.quoteMaker.resolve({ units }, true); // refuses a finish that is not on offer
    return plan;
  }

  /**
   * A visitor sends their design: checked and priced here (never trusting the browser's range), then
   * the enquiry is stored, then the design, then people are told. The lead is never lost to a later
   * step: a design that fails to save is logged and the enquiry still goes out.
   */
  async submit(dto: SubmitDesignDto): Promise<Estimate> {
    await this.quoteMaker.assertOpen();
    const vat = (await this.db.settings()).vat_rate;
    const rooms: Array<{ room_type: string; design: Plan; answers?: FillDto | null; units: number; low: number | null; high: number | null }> = [];
    for (const room of dto.rooms) {
      const design = await this.clean(room.design);
      const units = planUnits(design);
      if (!units.length) {
        throw new BadRequestException(dto.rooms.length > 1 ? 'Add at least one unit to every room, or remove the empty room.' : 'Add at least one unit to your design first.');
      }
      const resolved = await this.quoteMaker.resolve({ units }, true);
      const result = priceDesign(resolved.units, resolved.items, resolved.pricing, vat);
      const priced = result.unpriced.length === 0;
      rooms.push({ room_type: room.room_type, design, answers: room.answers, units: units.length, low: priced ? result.low : null, high: priced ? result.high : null });
    }
    // Each room is its own design with its own range; the enquiry's is their sum, unpriced if any room is.
    const priced = rooms.every((room) => room.low !== null);
    const sum = (key: 'low' | 'high') => rooms.reduce((total, room) => total + (room[key] ?? 0), 0);
    const estimate: Estimate = { priced, low: priced ? sum('low') : null, high: priced ? sum('high') : null };
    const range = priced ? `${gbp(estimate.low!)} to ${gbp(estimate.high!)}` : null;
    const names = [...new Set(rooms.map((room) => roomName(room.room_type)))].join(', ');

    const enquiry = await this.enquiries.store({
      kind: 'quote',
      name: dto.name,
      email: dto.email,
      phone: dto.phone || null,
      service_interest: names,
      message: dto.message?.trim() ?? '',
      details: {
        Room: names,
        ...(rooms.length === 1 ? { Layout: LAYOUT_NAME[rooms[0]!.design.layout] } : {}),
        Units: String(rooms.reduce((total, room) => total + room.units, 0)),
        Estimate: range ?? 'To be priced by the studio',
      },
    });
    const now = new Date().toISOString();
    const refs: string[] = [];
    for (const room of rooms) {
      const saved = await this.store
        .createDesign({
          source: 'web',
          title: null,
          room_type: room.room_type,
          design: room.design,
          answers: room.answers ? { ...this.answers(room.answers) } : null,
          estimate_low: room.low,
          estimate_high: room.high,
          enquiry_id: enquiry.id,
          created_by: null,
          created_at: now,
          updated_at: now,
        })
        .catch((error: unknown) => {
          this.logger.error(`Enquiry ${enquiry.id}: its design was not saved: ${error instanceof Error ? error.message : String(error)}`);
          return null;
        });
      if (saved) refs.push(designRef(saved.ref_no));
    }
    const told = refs.length ? { ...enquiry, details: { ...enquiry.details, Design: refs.join(', ') } } : enquiry;
    await this.enquiries.announce(told, range);
    return estimate;
  }

  /**
   * The plan as it will be stored: the right number of walls, every unit's template and size real,
   * every unit inside its wall, finishes in shape. Pricing problems (no default board, a switched-off
   * finish) are not refused: the design saves and shows them, unpriced.
   */
  private async clean(dto: PlanDto): Promise<Plan> {
    const run = (wall: PlanWallDto): PlanWall => ({
      length_mm: wall.length_mm,
      units: wall.units.map(({ id, template_id, variant_id, x_mm, finishes }) => {
        const clean = cleanFinishes(finishes);
        return { id, template_id, variant_id, x_mm, ...(clean && Object.keys(clean).length ? { finishes: clean } : {}) };
      }),
    });
    const plan: Plan = { layout: dto.layout, height_mm: dto.height_mm, walls: dto.walls.map(run), island: dto.island ? run(dto.island) : null };
    const shape = planShapeProblem(plan, MAX_UNITS);
    if (shape) throw new BadRequestException(shape);

    const units = planUnits(plan);
    const templates = new Map(
      (await this.store.templates.findWhere({ id: { in: [...new Set(units.map((u) => u.template_id))] } })).map((t) => [t.id, t]),
    );
    const widths = units.map((unit) => {
      const template = templates.get(unit.template_id);
      const variant = template?.variants.find((v) => v.id === unit.variant_id);
      if (!template || !variant) throw new BadRequestException('A unit in this design is no longer in the Unit library.');
      return variant.width_mm;
    });
    const off = unitsOffWall(plan, widths)[0];
    if (off !== undefined) {
      const unit = units[off]!;
      throw new BadRequestException(`${templates.get(unit.template_id)!.name} does not fit on ${wallLabel(plan, unit.wall)}.`);
    }
    return plan;
  }

  /** Staff pricing of a plan; null when it cannot be priced yet (and the reason is shown in the editor). */
  private async range(plan: Plan): Promise<{ estimate_low: number | null; estimate_high: number | null }> {
    const none = { estimate_low: null, estimate_high: null };
    if (!planUnits(plan).length) return none;
    try {
      const { units, items, pricing } = await this.quoteMaker.resolve({ units: planUnits(plan) }, false);
      const result = priceDesign(units, items, pricing, (await this.db.settings()).vat_rate);
      return result.unpriced.length ? none : { estimate_low: result.low, estimate_high: result.high };
    } catch (error) {
      if (error instanceof BadRequestException) return none;
      throw error;
    }
  }

  private async views(rows: QuoteDesign[]): Promise<DesignView[]> {
    if (!rows.length) return [];
    const enquiryIds = rows.flatMap((r) => (r.enquiry_id ? [r.enquiry_id] : []));
    const [enquiries, quotes] = await Promise.all([
      enquiryIds.length ? this.db.contactSubmissions.findWhere({ id: { in: enquiryIds } }) : [],
      this.db.projectQuotes.findWhere({ design_id: { in: rows.map((r) => r.id) } }, { orderBy: { created_at: 'asc' } }),
    ]);
    const enquiry = new Map(enquiries.map((e) => [e.id, { id: e.id, name: e.name, email: e.email, status: e.status }]));
    return rows.map((row) => ({
      id: row.id,
      ref: designRef(row.ref_no),
      title: row.title,
      room_type: row.room_type,
      source: row.source,
      units: planUnits(row.design).length,
      estimate_low: row.estimate_low,
      estimate_high: row.estimate_high,
      enquiry: row.enquiry_id ? (enquiry.get(row.enquiry_id) ?? null) : null,
      quotes: quotes.filter((q) => q.design_id === row.id).map((q) => ({ id: q.id, number: q.number, status: q.status })),
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      design: row.design,
      answers: row.answers,
    }));
  }

  // shortcut: the newest 200 only, no paging; add a `before` cursor when the studio has more designs than that.
  async list(query: ListDesignsQuery = {}): Promise<DesignSummary[]> {
    const where = query.enquiry_id ? { enquiry_id: query.enquiry_id } : {};
    const rows = await this.store.designs.findWhere(where, { orderBy: { created_at: 'desc' }, take: LIST_LIMIT });
    return (await this.views(rows)).map(({ design: _design, answers: _answers, ...summary }) => summary);
  }

  private async row(id: string): Promise<QuoteDesign> {
    const row = await this.store.designs.findById(id);
    if (!row) throw new NotFoundException('Design not found.');
    return row;
  }

  async findOne(id: string): Promise<DesignView> {
    return (await this.views([await this.row(id)]))[0]!;
  }

  async create(principal: AuthPrincipal, dto: SaveDesignDto): Promise<DesignView> {
    const design = await this.clean(dto.design);
    const now = new Date().toISOString();
    const created = await this.store.createDesign({
      source: 'staff',
      title: dto.title ?? null,
      room_type: dto.room_type,
      design,
      answers: dto.answers ? { ...dto.answers } : null,
      ...(await this.range(design)),
      enquiry_id: null,
      created_by: principal.name,
      created_at: now,
      updated_at: now,
    });
    await this.activity.record({ principal, action: 'quote_design_create', targetTable: 'quote_designs', targetId: created.id, details: { ref: designRef(created.ref_no) } });
    return this.findOne(created.id);
  }

  /** Replaces the plan. A design from the website keeps its source and enquiry. */
  async update(principal: AuthPrincipal, id: string, dto: SaveDesignDto): Promise<DesignView> {
    const existing = await this.row(id);
    const design = await this.clean(dto.design);
    await this.store.designs.update(id, {
      title: dto.title ?? null,
      room_type: dto.room_type,
      design,
      ...(dto.answers !== undefined ? { answers: dto.answers ? { ...dto.answers } : null } : {}),
      ...(await this.range(design)),
      updated_at: new Date().toISOString(),
    });
    await this.activity.record({ principal, action: 'quote_design_update', targetTable: 'quote_designs', targetId: id, details: { ref: designRef(existing.ref_no) } });
    return this.findOne(id);
  }

  /** Quotes made from it stay, without the link (FK set null). */
  async remove(principal: AuthPrincipal, id: string): Promise<{ id: string; deleted: true }> {
    const existing = await this.row(id);
    if (!(await this.store.designs.deleteWhere({ id }))) throw new NotFoundException('Design not found.');
    await this.activity.record({ principal, action: 'quote_design_delete', targetTable: 'quote_designs', targetId: id, details: { ref: designRef(existing.ref_no) } });
    return { id, deleted: true };
  }

  /** The saved plan priced in full. Throws 400 with the reason when it cannot be. */
  private async work(row: QuoteDesign) {
    const units = planUnits(row.design);
    if (!units.length) throw new BadRequestException('Add units to the design first.');
    const resolved = await this.quoteMaker.resolve({ units }, false);
    const breakdown = priceDesign(resolved.units, resolved.items, resolved.pricing, (await this.db.settings()).vat_rate);
    if (breakdown.unpriced.length)
      throw new BadRequestException(`Give these a quote cost in Inventory first: ${breakdown.unpriced.join(', ')}.`);
    return { units, resolved, breakdown };
  }

  private async project(projectId: string) {
    const project = await this.db.projects.findById(projectId);
    if (!project) throw new BadRequestException('Project does not exist');
    return project;
  }

  /**
   * A Draft quote for a project, one line per kind of unit on each run (cost and the pricing margin,
   * so the quote editor shows and recalculates them as for any quote). Appliance gaps come through as
   * quantity-only lines. The quote editor takes it from there.
   */
  async makeQuote(principal: AuthPrincipal, id: string, dto: ProjectDto) {
    const row = await this.row(id);
    const project = await this.project(dto.project_id);
    const { units, resolved, breakdown } = await this.work(row);
    const runs = row.design.walls.length + (row.design.island ? 1 : 0);
    const lines = new Map<string, { description: string; section: string | null; detail: string | null; quantity: number; cost: number }>();
    units.forEach((unit, i) => {
      const { template, variant, boards } = resolved.units[i]!;
      const cost = breakdown.lines[i]!.cost;
      const detail = template.slots.flatMap((slot) => (boards[slot.key] ? [`${slot.label}: ${boards[slot.key]!.name}`] : [])).join(' · ').slice(0, 300) || null;
      const section = runs > 1 ? wallLabel(row.design, unit.wall) : null;
      // Identical units on one run cost the same (same pieces, same share of each board), so they share a line.
      const key = JSON.stringify([section, template.id, variant.id, detail, cost]);
      const line = lines.get(key);
      if (line) line.quantity += 1;
      else lines.set(key, { description: `${template.name}, ${variant.width_mm} mm`, section, detail, quantity: 1, cost });
    });
    if (lines.size > MAX_LINES) throw new BadRequestException(`This design needs ${lines.size} lines; a quote takes ${MAX_LINES}. Split it into two designs.`);
    const room = roomName(row.room_type);
    return this.quotes.create(
      principal,
      {
        client_id: project.client_id,
        project_id: project.id,
        title: row.title ?? `${room} (${designRef(row.ref_no)})`,
        items: [...lines.values()].map((line) => ({
          description: line.description,
          section: line.section,
          detail: line.detail,
          quantity: line.quantity,
          unit_price: 0, // worked out from cost + margin by QuotesService
          cost_price: line.cost,
          margin_pct: resolved.pricing.margin_pct,
        })),
      },
      row.id,
    );
  }

  /**
   * What the design uses, as needs on a project's stock: whole sheets per board and hardware per item.
   * A line already needing more is left as it is, so asking twice adds nothing.
   */
  async materials(principal: AuthPrincipal, id: string, dto: ProjectDto) {
    const row = await this.row(id);
    await this.project(dto.project_id);
    const { breakdown } = await this.work(row);
    const wanted = new Map<string, number>();
    for (const board of breakdown.boards) wanted.set(board.item_id, (wanted.get(board.item_id) ?? 0) + board.sheets);
    for (const line of breakdown.hardware) wanted.set(line.item_id, (wanted.get(line.item_id) ?? 0) + line.qty);
    const existing = new Map((await this.db.inventory.materials.findWhere({ project_id: dto.project_id })).map((m) => [m.item_id, m.needed]));
    const changed: Array<{ item_id: string; needed: number }> = [];
    for (const [item_id, needed] of wanted) {
      if ((existing.get(item_id) ?? 0) >= needed) continue;
      await this.db.inventory.setNeeded(dto.project_id, item_id, needed);
      changed.push({ item_id, needed });
    }
    await this.activity.record({
      principal,
      action: 'quote_design_materials',
      targetTable: 'project_materials',
      targetId: dto.project_id,
      details: { design: designRef(row.ref_no), lines: changed.length },
    });
    return { changed: changed.length, lines: wanted.size };
  }
}

/* ------------------------------------------------------------- controller */

@Controller('quote-maker')
@Roles('Admin')
export class QuoteDesignsController {
  constructor(private readonly designs: QuoteDesignsService) {}

  @Public() @Post('start') @HttpCode(200) @Throttle({ default: { limit: 30, ttl: 60_000 } })
  start(@Body() dto: FillDto) {
    return this.designs.start(dto);
  }

  /** Same limit as POST /enquiries: it is one. */
  @Public() @Post('submit') @HttpCode(201) @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  async submit(@Body() dto: SubmitDesignDto, @Res({ passthrough: true }) res: Response) {
    if (dto.website) {
      res.status(204);
      return;
    }
    return this.designs.submit(dto);
  }

  @Post('fill') @HttpCode(200) fill(@Body() dto: FillDto) {
    return this.designs.fill(dto);
  }

  @Get('designs') list(@Query() query: ListDesignsQuery) {
    return this.designs.list(query);
  }
  @Get('designs/:id') findOne(@Param('id') id: string) {
    return this.designs.findOne(id);
  }
  @Post('designs') create(@CurrentUser() principal: AuthPrincipal, @Body() dto: SaveDesignDto) {
    return this.designs.create(principal, dto);
  }
  @Put('designs/:id') update(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: SaveDesignDto) {
    return this.designs.update(principal, id, dto);
  }
  @Delete('designs/:id') remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.designs.remove(principal, id);
  }
  @Post('designs/:id/quote') makeQuote(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: ProjectDto) {
    return this.designs.makeQuote(principal, id, dto);
  }
  @Post('designs/:id/materials') @HttpCode(200) materials(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string, @Body() dto: ProjectDto) {
    return this.designs.materials(principal, id, dto);
  }
}

/** Saved designs. Remove with the rest of the quote maker (see QuoteMakerModule). */
@Module({
  imports: [QuoteMakerModule, QuotesModule, EnquiriesModule],
  controllers: [QuoteDesignsController],
  providers: [QuoteDesignsService],
})
export class QuoteDesignsModule {}
