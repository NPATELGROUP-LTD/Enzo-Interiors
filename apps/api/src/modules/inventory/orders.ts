import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';
import { OrderStatus, PurchaseOrder, Refused } from '../../data/inventory-store';
import { totalsOf } from '../invoices/totals';
import { LowStockWatch } from './low-stock';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class OrderLineDto {
  @IsString() @MaxLength(64) item_id!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantity!: number;
  /** Net cost per unit. */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9_999_999.99)
  unit_cost!: number;
}

export class OrderDto {
  @IsString() @MaxLength(64) supplier_id!: string;
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  vat_rate?: number;
  @IsOptional() @IsDateString() expected_at?: string | null;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(2000) notes?: string | null;
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  items!: OrderLineDto[];
}

export class ReceiveLineDto {
  @IsString() @MaxLength(64) line_id!: string;
  @IsInt() @Min(1) @Max(1_000_000) quantity!: number;
}

export class ReceiveDto {
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  lines!: ReceiveLineDto[];
}

/** A status change: from these, to that. Claimed with one conditional UPDATE, so two clicks change it once. */
const MOVES: Record<'send' | 'draft' | 'cancel', { from: OrderStatus[]; to: OrderStatus }> = {
  send: { from: ['Draft'], to: 'Sent' },
  draft: { from: ['Sent'], to: 'Draft' },
  cancel: { from: ['Draft', 'Sent'], to: 'Cancelled' },
};

export const poRef = (n: number) => `PO-${String(n).padStart(4, '0')}`;

/**
 * Purchase orders, Admin only. A Draft is edited freely; Sent is what went to the supplier (printed);
 * receiving books stock in at the line's cost (InventoryStore.receive). Nothing arrived yet = it can go
 * back to Draft or be cancelled. Remove this piece: delete this file and its two lines in the module.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly low: LowStockWatch,
  ) {}

  private get store() {
    return this.db.inventory;
  }

  async list() {
    const [orders, lines, suppliers] = await Promise.all([
      this.store.orders.findWhere({}, { orderBy: { ref_no: 'desc' }, take: 500 }),
      this.store.orderLines.findAll(),
      this.store.suppliers.findAll(),
    ]);
    const names = new Map(suppliers.map((s) => [s.id, s.name]));
    return orders.map((order) => {
      const own = lines.filter((line) => line.po_id === order.id);
      return {
        ...order,
        ref: poRef(order.ref_no),
        supplier_name: names.get(order.supplier_id) ?? '',
        lines: own.length,
        gross: totalsOf(own.map(price), order.vat_rate).gross,
      };
    });
  }

  async get(id: string) {
    const order = await this.store.orders.findById(id);
    if (!order) throw new NotFoundException('Order not found.');
    const [lines, supplier] = await Promise.all([
      this.store.orderLines.findWhere({ po_id: id }, { orderBy: { position: 'asc' } }),
      this.store.suppliers.findById(order.supplier_id),
    ]);
    const items = await this.store.items.findWhere({
      id: { in: lines.map((line) => line.item_id) },
    });
    const byId = new Map(items.map((item) => [item.id, item]));
    return {
      ...order,
      ref: poRef(order.ref_no),
      supplier,
      items: lines.map((line) => {
        const item = byId.get(line.item_id)!;
        return {
          ...line,
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          size_note: item.size_note,
        };
      }),
      totals: totalsOf(lines.map(price), order.vat_rate),
    };
  }

  private async fields(dto: OrderDto) {
    if (!(await this.store.suppliers.findById(dto.supplier_id)))
      throw new BadRequestException('That supplier no longer exists.');
    const ids = [...new Set(dto.items.map((line) => line.item_id))];
    if (ids.length !== dto.items.length) throw new BadRequestException('Each item once per order.');
    if ((await this.store.items.countWhere({ id: { in: ids }, active: true })) !== ids.length)
      throw new BadRequestException('An item no longer exists or is switched off.');
    return {
      order: {
        supplier_id: dto.supplier_id,
        vat_rate: new Prisma.Decimal(dto.vat_rate ?? 20),
        expected_at: dto.expected_at ? new Date(dto.expected_at) : null,
        notes: dto.notes ?? null,
      },
      lines: dto.items.map((line, position) => ({
        item_id: line.item_id,
        quantity: line.quantity,
        unit_cost: new Prisma.Decimal(line.unit_cost).toNumber(),
        position,
      })),
    };
  }

  async create(principal: AuthPrincipal, dto: OrderDto) {
    const { order, lines } = await this.fields(dto);
    return this.get(await this.store.createDraft({ ...order, created_by: principal.name }, lines));
  }

  async update(id: string, dto: OrderDto) {
    const { order, lines } = await this.fields(dto);
    if (!(await this.store.replaceDraft(id, order, lines))) await this.refuseNotDraft(id);
    return this.get(id);
  }

  async move(id: string, kind: keyof typeof MOVES) {
    const { from, to } = MOVES[kind];
    const patch: Partial<PurchaseOrder> = {
      status: to,
      updated_at: new Date().toISOString(),
      ...(to === 'Sent' ? { sent_at: new Date().toISOString() } : {}),
    };
    if (!(await this.store.orders.updateWhere({ id, status: { in: from } } as never, patch))) {
      if (!(await this.store.orders.findById(id))) throw new NotFoundException('Order not found.');
      throw new ConflictException(
        `Only a${from.length > 1 ? ' Draft or Sent' : ` ${from[0]}`} order can do that.`,
      );
    }
    return this.get(id);
  }

  async remove(id: string) {
    if (!(await this.store.orders.deleteWhere({ id, status: 'Draft' })))
      await this.refuseNotDraft(id);
  }

  async receive(principal: AuthPrincipal, id: string, dto: ReceiveDto) {
    if (new Set(dto.lines.map((line) => line.line_id)).size !== dto.lines.length)
      throw new BadRequestException('Each line once.');
    let touched: string[];
    try {
      touched = await this.store.receive(id, dto.lines, principal);
    } catch (error) {
      if (!(error instanceof Refused)) throw error;
      if (error.refusal === 'missing')
        throw new NotFoundException('Order, line or item not found, or the item is switched off.');
      if (error.refusal === 'state')
        throw new ConflictException('Only a Sent or Part-received order can be booked in.');
      throw new ConflictException('That is more than is still to come on a line.');
    }
    for (const itemId of new Set(touched)) await this.low.check(itemId);
    return this.get(id);
  }

  /**
   * What to buy: enough of each item to cover the projects' unheld needs and to lift free stock
   * above its reorder level, less what is already on order. Grouped by the item's supplier in the UI.
   */
  async shortfall() {
    const rows = await this.store.shortfall();
    return rows
      .map((row) => {
        const free = row.on_hand - row.held;
        const floor = row.reorder_level === null ? 0 : row.reorder_level + 1;
        return { ...row, free, suggest: Math.max(0, row.wanted + floor - free - row.on_order) };
      })
      .filter((row) => row.suggest > 0);
  }

  private async refuseNotDraft(id: string): Promise<never> {
    if (!(await this.store.orders.findById(id))) throw new NotFoundException('Order not found.');
    throw new ConflictException('Only a Draft order can be changed or deleted.');
  }
}

const price = (line: { quantity: number; unit_cost: number }) => ({
  quantity: line.quantity,
  unit_price: line.unit_cost,
});

@Controller('inventory')
@Roles('Admin')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('orders') list() {
    return this.orders.list();
  }
  @Get('orders/:id') get(@Param('id') id: string) {
    return this.orders.get(id);
  }
  @Post('orders') create(@CurrentUser() principal: AuthPrincipal, @Body() dto: OrderDto) {
    return this.orders.create(principal, dto);
  }
  @Put('orders/:id') update(@Param('id') id: string, @Body() dto: OrderDto) {
    return this.orders.update(id, dto);
  }
  @Delete('orders/:id') @HttpCode(204) remove(@Param('id') id: string) {
    return this.orders.remove(id);
  }
  @Post('orders/:id/send') @HttpCode(200) send(@Param('id') id: string) {
    return this.orders.move(id, 'send');
  }
  @Post('orders/:id/draft') @HttpCode(200) draft(@Param('id') id: string) {
    return this.orders.move(id, 'draft');
  }
  @Post('orders/:id/cancel') @HttpCode(200) cancel(@Param('id') id: string) {
    return this.orders.move(id, 'cancel');
  }
  @Post('orders/:id/receive') @HttpCode(200) receive(
    @CurrentUser() principal: AuthPrincipal,
    @Param('id') id: string,
    @Body() dto: ReceiveDto,
  ) {
    return this.orders.receive(principal, id, dto);
  }
  @Get('shortfall') shortfall() {
    return this.orders.shortfall();
  }
}
