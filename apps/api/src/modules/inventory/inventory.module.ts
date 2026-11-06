import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';
import {
  ITEM_TYPES,
  InventoryItem,
  InventorySupplier,
  StockMovement,
} from '../../data/inventory-store';
import { NotificationsModule } from '../notifications/notifications.module';
import { loadStages } from '../projects/stages';
import { LowStockWatch } from './low-stock';
import { OrdersController, OrdersService } from './orders';
import { ProjectStockController, ProjectStockService } from './project-stock';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class ItemDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(40) sku!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsIn(ITEM_TYPES) type!: InventoryItem['type'];
  @IsOptional() @Transform(trim) @IsString() @MaxLength(80) category?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(20) unit?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) size_note?: string | null;
  @IsOptional() @IsString() @MaxLength(64) supplier_id?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) reorder_level?: number | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class MovementDto {
  @IsIn(['receive', 'issue', 'adjust']) kind!: StockMovement['kind'];
  /** Whole units. receive/issue: how many (positive); adjust: + found or - lost. */
  @IsInt() @Min(-1_000_000) @Max(1_000_000) quantity!: number;
  /** receive only: net cost per unit. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100_000_000) unit_cost?: number;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) reason?: string | null;
}

export class SupplierDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(200) name!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(200) contact_name?: string | null;
  @IsOptional() @Transform(trim) @IsEmail() @MaxLength(254) email?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(30) phone?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(365) lead_days?: number | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) notes?: string | null;
}

export class StockSettingsDto {
  /** A project stage name, or null to reserve by hand only. */
  @IsOptional() @IsString() @MaxLength(60) reserve_on_stage!: string | null;
}

/** reserved = held for projects; available = on_hand - reserved, what is free to use or hold. */
export type ItemView = InventoryItem & {
  supplier_name: string | null;
  reserved: number;
  available: number;
  on_order: number;
  low: boolean;
};

/**
 * Stock for the whole business, Admin only. Every change to a count is a stock_movements row
 * (InventoryStore.book); on_hand and avg_cost on the item follow it. An item with history is
 * switched off (active = false), never deleted.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly db: DatabaseService,
    private readonly low: LowStockWatch,
  ) {}

  private get store() {
    return this.db.inventory;
  }

  async items(): Promise<ItemView[]> {
    const [items, suppliers, held, ordered] = await Promise.all([
      this.store.items.findWhere({}, { orderBy: { name: 'asc' } }),
      this.store.suppliers.findAll(),
      this.store.reservedByItem(),
      this.store.onOrderByItem(),
    ]);
    const names = new Map(suppliers.map((s) => [s.id, s.name]));
    return items.map((item) => {
      const reserved = held.get(item.id) ?? 0;
      const available = item.on_hand - reserved;
      return {
        ...item,
        supplier_name: names.get(item.supplier_id ?? '') ?? null,
        reserved,
        available,
        on_order: ordered.get(item.id) ?? 0,
        low: item.reorder_level !== null && available <= item.reorder_level,
      };
    });
  }

  /** The stage that reserves project stock, and the stages to pick from. */
  async settings() {
    const [reserve_on_stage, stages] = await Promise.all([
      this.store.reserveOnStage(),
      loadStages(this.db),
    ]);
    return { reserve_on_stage, stages: stages.map((stage) => stage.name) };
  }

  async saveSettings(dto: StockSettingsDto) {
    const stage = dto.reserve_on_stage || null;
    const { stages } = await this.settings();
    if (stage && !stages.includes(stage))
      throw new BadRequestException(`Stage must be one of: ${stages.join(', ')}`);
    await this.store.setReserveOnStage(stage);
    return this.settings();
  }

  private async fields(dto: ItemDto) {
    if (dto.supplier_id && !(await this.store.suppliers.findById(dto.supplier_id)))
      throw new BadRequestException('That supplier no longer exists.');
    return {
      sku: dto.sku,
      name: dto.name,
      type: dto.type,
      category: dto.category ?? null,
      unit: dto.unit ?? 'each',
      size_note: dto.size_note ?? null,
      supplier_id: dto.supplier_id || null,
      reorder_level: dto.reorder_level ?? null,
      active: dto.active ?? true,
    };
  }

  async create(dto: ItemDto): Promise<InventoryItem> {
    const now = new Date().toISOString();
    return this.unique(async () =>
      this.store.items.create({
        ...(await this.fields(dto)),
        on_hand: 0,
        avg_cost: 0,
        low_notified: false,
        created_at: now,
        updated_at: now,
      }),
    );
  }

  async update(id: string, dto: ItemDto): Promise<InventoryItem> {
    const item = await this.unique(async () =>
      this.store.items.update(id, {
        ...(await this.fields(dto)),
        updated_at: new Date().toISOString(),
      }),
    );
    if (!item) throw new NotFoundException('Item not found.');
    await this.low.check(id);
    return item;
  }

  async remove(id: string): Promise<void> {
    const { movements, materials, orderLines } = this.store;
    if (
      (await movements.countWhere({ item_id: id })) ||
      (await materials.countWhere({ item_id: id })) ||
      (await orderLines.countWhere({ item_id: id }))
    ) {
      throw new ConflictException('This item has stock history. Switch it off instead.');
    }
    if (!(await this.store.items.delete(id))) throw new NotFoundException('Item not found.');
  }

  movements(id: string): Promise<StockMovement[]> {
    return this.store.movements.findWhere(
      { item_id: id },
      { orderBy: { created_at: 'desc' }, take: 100 },
    );
  }

  async book(principal: AuthPrincipal, id: string, dto: MovementDto): Promise<InventoryItem> {
    const reason = dto.reason ?? null;
    if (dto.kind === 'adjust' ? dto.quantity === 0 : dto.quantity <= 0)
      throw new BadRequestException('Enter how many.');
    if (dto.kind === 'receive' && dto.unit_cost === undefined)
      throw new BadRequestException('Enter the cost per unit.');
    // Here, issue is workshop use (no project), so it needs a reason; project issues are project-stock.ts.
    if (dto.kind !== 'receive' && !reason) throw new BadRequestException('Say why.');
    const result = await this.store.book({
      item_id: id,
      kind: dto.kind,
      quantity: dto.kind === 'issue' ? -dto.quantity : dto.quantity,
      unit_cost: dto.kind === 'receive' ? new Prisma.Decimal(dto.unit_cost!).toFixed(2) : null,
      reason,
      by_id: principal.id,
      by_name: principal.name,
      project_id: null,
    });
    if (result === 'missing') throw new NotFoundException('Item not found, or switched off.');
    if (result === 'short')
      throw new ConflictException(
        'There is not that much free in stock. Some may be held for projects.',
      );
    await this.low.check(id);
    return result;
  }

  suppliers(): Promise<InventorySupplier[]> {
    return this.store.suppliers.findWhere({}, { orderBy: { name: 'asc' } });
  }

  private supplierFields(dto: SupplierDto) {
    const {
      name,
      contact_name = null,
      email = null,
      phone = null,
      lead_days = null,
      notes = null,
    } = dto;
    return {
      name,
      contact_name,
      email,
      phone,
      lead_days,
      notes,
      updated_at: new Date().toISOString(),
    };
  }

  createSupplier(dto: SupplierDto): Promise<InventorySupplier> {
    return this.store.suppliers.create({
      ...this.supplierFields(dto),
      created_at: new Date().toISOString(),
    });
  }

  async updateSupplier(id: string, dto: SupplierDto): Promise<InventorySupplier> {
    const supplier = await this.store.suppliers.update(id, this.supplierFields(dto));
    if (!supplier) throw new NotFoundException('Supplier not found.');
    return supplier;
  }

  /** Its items keep going, with no supplier (FK SET NULL). One with orders stays (FK RESTRICT). */
  async removeSupplier(id: string): Promise<void> {
    if (await this.store.orders.countWhere({ supplier_id: id }))
      throw new ConflictException('This supplier has purchase orders, so it stays.');
    if (!(await this.store.suppliers.delete(id)))
      throw new NotFoundException('Supplier not found.');
  }

  prices(id: string) {
    return this.store.priceHistory(id);
  }

  private async unique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('Another item has that SKU.');
      throw error;
    }
  }
}

@Controller('inventory')
@Roles('Admin')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('items') items() {
    return this.inventory.items();
  }
  @Post('items') create(@Body() dto: ItemDto) {
    return this.inventory.create(dto);
  }
  @Put('items/:id') update(@Param('id') id: string, @Body() dto: ItemDto) {
    return this.inventory.update(id, dto);
  }
  @Delete('items/:id') @HttpCode(204) remove(@Param('id') id: string) {
    return this.inventory.remove(id);
  }
  @Get('items/:id/movements') movements(@Param('id') id: string) {
    return this.inventory.movements(id);
  }
  @Get('items/:id/prices') prices(@Param('id') id: string) {
    return this.inventory.prices(id);
  }
  @Post('items/:id/movements') book(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: MovementDto,
  ) {
    return this.inventory.book(principal, id, dto);
  }

  @Get('settings') settings() {
    return this.inventory.settings();
  }
  @Put('settings') saveSettings(@Body() dto: StockSettingsDto) {
    return this.inventory.saveSettings(dto);
  }

  @Get('suppliers') suppliers() {
    return this.inventory.suppliers();
  }
  @Post('suppliers') createSupplier(@Body() dto: SupplierDto) {
    return this.inventory.createSupplier(dto);
  }
  @Put('suppliers/:id') updateSupplier(@Param('id') id: string, @Body() dto: SupplierDto) {
    return this.inventory.updateSupplier(id, dto);
  }
  @Delete('suppliers/:id') @HttpCode(204) removeSupplier(@Param('id') id: string) {
    return this.inventory.removeSupplier(id);
  }
}

/**
 * Remove the feature: delete this folder, data/inventory-store.ts, its line in DatabaseService and AppModule.
 * Remove only project stock: drop ProjectStock* below (projects keeps an empty stageListeners).
 * Remove only purchase orders: drop Orders* below and orders.ts.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [InventoryController, ProjectStockController, OrdersController],
  providers: [InventoryService, ProjectStockService, OrdersService, LowStockWatch],
})
export class InventoryModule {}
