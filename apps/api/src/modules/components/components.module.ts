import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

import { COMPONENT_CATEGORIES, ComponentCategory, ComponentItem } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { money } from '../../common/util/money';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';
import { CurrentUser, Roles } from '../../common/decorators';

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

export class CreateComponentDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsIn(COMPONENT_CATEGORIES, { message: `Category must be one of: ${COMPONENT_CATEGORIES.join(', ')}` })
  category!: ComponentCategory;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Unit price must be a number with at most 2 decimal places' })
  @Min(0, { message: 'Unit price cannot be negative' })
  unit_price!: number;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateComponentDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsIn(COMPONENT_CATEGORIES) category?: ComponentCategory;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) unit_price?: number;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

@Injectable()
export class ComponentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly activity: ActivityLogService,
  ) {}

  /**
   * The library. `includeInactive` defaults to false so the quote builder only
   * ever offers current products; the Admin library screen passes it to show
   * everything.
   */
  async list(includeInactive: boolean): Promise<ComponentItem[]> {
    const rows = await this.db.components.findAll(
      includeInactive ? undefined : (row) => row.is_active,
    );
    return rows.sort(
      (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );
  }

  async findOne(id: string): Promise<ComponentItem> {
    const component = await this.db.components.findById(id);
    if (!component) throw new NotFoundException('Component not found');
    return component;
  }

  async create(principal: AuthPrincipal, dto: CreateComponentDto): Promise<ComponentItem> {
    const now = new Date().toISOString();
    const created = await this.db.components.create({
      name: dto.name.trim(),
      category: dto.category,
      unit_price: money(dto.unit_price),
      description: dto.description ?? null,
      is_active: dto.is_active ?? true,
      created_at: now,
      updated_at: now,
    });

    await this.activity.record({
      principal,
      action: 'component_create',
      targetTable: 'components',
      targetId: created.id,
      details: { name: created.name, category: created.category, unit_price: created.unit_price },
    });
    return created;
  }

  /**
   * Edit a component.
   *
   * A price change here does NOT touch quote_line_items. Those hold a snapshot
   * taken at quote time, and rewriting them would retroactively alter historical
   * quotes — the exact thing Backend Schema section 6 forbids. Price changes are
   * audited as their own `price_change` action because the PRD calls out price
   * edits as an auditable event specifically.
   */
  async update(principal: AuthPrincipal, id: string, dto: UpdateComponentDto): Promise<ComponentItem> {
    const existing = await this.findOne(id);

    const patch: Partial<ComponentItem> = { updated_at: new Date().toISOString() };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.unit_price !== undefined) patch.unit_price = money(dto.unit_price);
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.is_active !== undefined) patch.is_active = dto.is_active;

    const updated = await this.db.components.update(id, patch);
    if (!updated) throw new NotFoundException('Component not found');

    const priceChanged = dto.unit_price !== undefined && money(dto.unit_price) !== existing.unit_price;
    await this.activity.record({
      principal,
      action: priceChanged ? 'price_change' : 'component_update',
      targetTable: 'components',
      targetId: id,
      details: priceChanged
        ? { field: 'unit_price', from: existing.unit_price, to: updated.unit_price, name: updated.name }
        : { fields: Object.keys(dto) },
    });
    return updated;
  }

  /**
   * Delete a component.
   *
   * Refuses when historical quotes reference it: the line items keep their own
   * price snapshot and would survive, but the library row backing them would
   * vanish and the quote would lose its provenance. Deactivating is the correct
   * move for a withdrawn product, and the error says so.
   */
  async remove(principal: AuthPrincipal, id: string): Promise<{ id: string; deleted: true }> {
    const component = await this.findOne(id);
    const referencing = await this.db.quoteLineItems.count((row) => row.component_id === id);
    if (referencing > 0) {
      throw new BadRequestException(
        `"${component.name}" appears on ${referencing} existing quote line${referencing === 1 ? '' : 's'} ` +
          'and cannot be deleted without breaking those quotes. Mark it inactive instead — ' +
          'it will disappear from the quote builder but historical quotes stay intact.',
      );
    }

    await this.db.components.delete(id);
    await this.activity.record({
      principal,
      action: 'component_delete',
      targetTable: 'components',
      targetId: id,
      details: { name: component.name },
    });
    return { id, deleted: true };
  }
}

/* -------------------------------------------------------------------------- */
/* Controller                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The Component Pricing Library.
 *
 * All staff may read it (a Designer needs it to build a quote). Only Admin may
 * change prices — the PRD makes Component Library edits an Admin-only power and
 * pairs it with audit logging.
 */
@Controller('components')
@Roles('Admin', 'Designer', 'Installer')
export class ComponentsController {
  constructor(private readonly components: ComponentsService) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string) {
    return this.components.list(includeInactive === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.components.findOne(id);
  }

  @Post()
  @Roles('Admin')
  create(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateComponentDto) {
    return this.components.create(principal, dto);
  }

  @Put(':id')
  @Roles('Admin')
  update(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateComponentDto,
  ) {
    return this.components.update(principal, id, dto);
  }

  @Delete(':id')
  @Roles('Admin')
  remove(@CurrentUser() principal: AuthPrincipal, @Param('id') id: string) {
    return this.components.remove(principal, id);
  }
}

@Module({
  controllers: [ComponentsController],
  providers: [ComponentsService],
  exports: [ComponentsService],
})
export class ComponentsModule {}
