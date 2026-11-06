import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { IsInt, Max, Min } from 'class-validator';

import { AccessService } from '../../common/access/access.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';
import { Refusal } from '../../data/inventory-store';
import { sumMoney } from '../invoices/totals';
import { stageListeners } from '../projects/projects.service';
import { LowStockWatch } from './low-stock';

export class NeededDto {
  @IsInt() @Min(0) @Max(1_000_000) needed!: number;
}

export class CountDto {
  @IsInt() @Min(1) @Max(1_000_000) quantity!: number;
}

export interface MaterialView {
  item_id: string;
  sku: string;
  name: string;
  unit: string;
  needed: number;
  reserved: number;
  issued: number;
  /** Free stock of the item for anyone, now. */
  available: number;
  /** Admin only: net cost of what was issued here (less returns). */
  cost?: number;
}

const refuse = (result: Refusal, short: string): never => {
  throw result === 'missing'
    ? new NotFoundException('That item is not on this project, or is switched off.')
    : new ConflictException(short);
};

/**
 * Stock per project: what it needs, holds and has used. Who reaches a project is AccessService's
 * call; what they may do is the route's @Roles. Money goes to the Admin only.
 */
@Injectable()
export class ProjectStockService implements OnModuleInit {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly low: LowStockWatch,
  ) {}

  private get store() {
    return this.db.inventory;
  }

  onModuleInit() {
    stageListeners.push((projectId, stage, last) => this.onStage(projectId, stage, last));
  }

  /** The last stage lets go of what is left; the chosen stage holds what each line still needs. */
  async onStage(projectId: string, stage: string, last: boolean): Promise<void> {
    if (last) return this.store.releaseAll(projectId);
    if (stage === (await this.store.reserveOnStage())) await this.reserveAll(projectId);
  }

  async cost(
    principal: AuthPrincipal,
    projectId: string,
  ): Promise<{ used: number; quoted: number | null }> {
    await this.access.requireProject(principal, projectId);
    const [used, quoted] = await Promise.all([
      this.store.projectCost(projectId),
      this.store.quotedCost(projectId),
    ]);
    return { used: sumMoney([...used.values()]), quoted };
  }

  async list(principal: AuthPrincipal, projectId: string): Promise<MaterialView[]> {
    await this.access.requireProject(principal, projectId);
    const lines = await this.store.materials.findWhere({ project_id: projectId });
    if (!lines.length) return [];
    const [items, held, cost] = await Promise.all([
      this.store.items.findWhere({ id: { in: lines.map((line) => line.item_id) } }),
      this.store.reservedByItem(),
      this.store.projectCost(projectId),
    ]);
    const byId = new Map(items.map((item) => [item.id, item]));
    const admin = principal.kind === 'Staff' && principal.role === 'Admin';
    return lines
      .map((line) => {
        const item = byId.get(line.item_id)!;
        const view: MaterialView = {
          item_id: item.id,
          sku: item.sku,
          name: item.name,
          unit: item.unit,
          needed: line.needed,
          reserved: line.reserved,
          issued: line.issued,
          available: item.on_hand - (held.get(item.id) ?? 0),
        };
        return admin ? { ...view, cost: cost.get(item.id) ?? 0 } : view;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async setNeeded(principal: AuthPrincipal, projectId: string, itemId: string, needed: number) {
    await this.access.requireProject(principal, projectId);
    if (!(await this.store.items.findById(itemId))) throw new NotFoundException('Item not found.');
    await this.store.setNeeded(projectId, itemId, needed);
    await this.low.check(itemId);
    return this.list(principal, projectId);
  }

  async remove(principal: AuthPrincipal, projectId: string, itemId: string) {
    await this.access.requireProject(principal, projectId);
    if (!(await this.store.removeLine(projectId, itemId)))
      throw new ConflictException('Stock has been used on this line. Return it first.');
    await this.low.check(itemId);
  }

  async reserve(principal: AuthPrincipal, projectId: string, itemId: string, delta: number) {
    await this.access.requireProject(principal, projectId);
    const result = await this.store.reserve(projectId, itemId, delta);
    if (typeof result !== 'number')
      refuse(
        result,
        delta > 0
          ? 'Not that much is free, or this project does not need that many more.'
          : 'Not that many are held.',
      );
    await this.low.check(itemId);
    return this.list(principal, projectId);
  }

  /** Hold as much as is free of what each line still needs; the rest stays a shortfall. */
  async reserveAll(projectId: string): Promise<void> {
    for (const line of await this.store.materials.findWhere({ project_id: projectId })) {
      const want = line.needed - line.issued - line.reserved;
      if (
        want > 0 &&
        typeof (await this.store.reserve(projectId, line.item_id, want, true)) === 'number'
      )
        await this.low.check(line.item_id);
    }
  }

  async reserveAllFor(principal: AuthPrincipal, projectId: string) {
    await this.access.requireProject(principal, projectId);
    await this.reserveAll(projectId);
    return this.list(principal, projectId);
  }

  async move(
    principal: AuthPrincipal,
    projectId: string,
    itemId: string,
    kind: 'issue' | 'return',
    quantity: number,
  ) {
    const project = await this.access.requireProject(principal, projectId);
    const result = await this.store.book({
      item_id: itemId,
      kind,
      quantity: kind === 'issue' ? -quantity : quantity,
      unit_cost: null,
      reason: project.name,
      by_id: principal.id,
      by_name: principal.name,
      project_id: projectId,
    });
    if (typeof result === 'string')
      refuse(
        result,
        kind === 'issue'
          ? 'There is not that much free in stock.'
          : 'That is more than was used here.',
      );
    await this.low.check(itemId);
    return this.list(principal, projectId);
  }
}

@Controller('inventory/projects/:projectId')
export class ProjectStockController {
  constructor(private readonly stock: ProjectStockService) {}

  @Get('materials')
  @Roles('Admin', 'Designer', 'Installer')
  list(@CurrentUser() principal: AuthPrincipal, @Param('projectId') projectId: string) {
    return this.stock.list(principal, projectId);
  }

  /** Stock used here at cost vs the cost side of its accepted quotes. Admin only: it is money. */
  @Get('cost')
  @Roles('Admin')
  cost(@CurrentUser() principal: AuthPrincipal, @Param('projectId') projectId: string) {
    return this.stock.cost(principal, projectId);
  }

  @Put('materials/:itemId')
  @Roles('Admin')
  setNeeded(
    @CurrentUser() principal: AuthPrincipal,
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
    @Body() dto: NeededDto,
  ) {
    return this.stock.setNeeded(principal, projectId, itemId, dto.needed);
  }

  @Delete('materials/:itemId')
  @Roles('Admin')
  @HttpCode(204)
  remove(
    @CurrentUser() principal: AuthPrincipal,
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.stock.remove(principal, projectId, itemId);
  }

  @Post('reserve-all')
  @Roles('Admin')
  @HttpCode(200)
  reserveAll(@CurrentUser() principal: AuthPrincipal, @Param('projectId') projectId: string) {
    return this.stock.reserveAllFor(principal, projectId);
  }

  @Post('materials/:itemId/reserve')
  @Roles('Admin')
  @HttpCode(200)
  reserve(
    @CurrentUser() principal: AuthPrincipal,
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CountDto,
  ) {
    return this.stock.reserve(principal, projectId, itemId, dto.quantity);
  }

  @Post('materials/:itemId/release')
  @Roles('Admin')
  @HttpCode(200)
  release(
    @CurrentUser() principal: AuthPrincipal,
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CountDto,
  ) {
    return this.stock.reserve(principal, projectId, itemId, -dto.quantity);
  }

  @Post('materials/:itemId/issue')
  @Roles('Admin', 'Installer')
  @HttpCode(200)
  issue(
    @CurrentUser() principal: AuthPrincipal,
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CountDto,
  ) {
    return this.stock.move(principal, projectId, itemId, 'issue', dto.quantity);
  }

  @Post('materials/:itemId/return')
  @Roles('Admin', 'Installer')
  @HttpCode(200)
  giveBack(
    @CurrentUser() principal: AuthPrincipal,
    @Param('projectId') projectId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CountDto,
  ) {
    return this.stock.move(principal, projectId, itemId, 'return', dto.quantity);
  }
}
