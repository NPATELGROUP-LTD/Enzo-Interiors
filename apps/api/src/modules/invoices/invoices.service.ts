import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import { AccessService } from '../../common/access/access.service';
import { INVOICE_STATUSES, Invoice, InvoiceStatus } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { money, sum } from '../../common/util/money';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

export class CreateInvoiceDto {
  @IsString() client_id!: string;
  @IsOptional() @IsString() project_id?: string | null;

  /**
   * The GROSS amount payable, VAT included. `vat_rate` is stored alongside so
   * the net/VAT split can be shown, matching how the seed writes this column.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Amount must be a number with at most 2 decimal places' })
  @Min(0, { message: 'Amount cannot be negative' })
  amount!: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) vat_rate?: number;

  @IsDateString({}, { message: 'Enter a valid due date' })
  due_date!: string;

  @IsOptional()
  @IsIn(['Draft', 'Sent', 'Outstanding'], {
    message: 'A new invoice can only be Draft, Sent or Outstanding',
  })
  status?: Extract<InvoiceStatus, 'Draft' | 'Sent' | 'Outstanding'>;
}

export class UpdateInvoiceDto {
  @IsOptional() @IsString() project_id?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) amount?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) vat_rate?: number;
  @IsOptional() @IsDateString() due_date?: string;

  /**
   * Paid is deliberately NOT accepted here. Marking an invoice paid is a
   * distinct, Admin-only, audited action with its own endpoint, so it cannot
   * happen as a side effect of a general edit.
   */
  @IsOptional()
  @IsIn(['Draft', 'Sent', 'Outstanding', 'Overdue'], {
    message: 'Use the mark-paid action to record payment',
  })
  status?: Exclude<InvoiceStatus, 'Paid'>;
}

/* -------------------------------------------------------------------------- */
/* View model                                                                 */
/* -------------------------------------------------------------------------- */

export interface InvoiceView extends Invoice {
  client_name: string;
  project_name: string | null;
  /** Derived breakdown of the stored gross `amount`. */
  net_amount: number;
  vat_amount: number;
  /** True when unpaid and past its due date, regardless of the stored status. */
  is_overdue: boolean;
  days_overdue: number;
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
  ) {}

  async list(principal: AuthPrincipal): Promise<InvoiceView[]> {
    const all = await this.db.invoices.findAll();
    const scoped = await this.access.scopeToVisibleClients(principal, all, (row) => row.client_id);
    const [clients, projects] = await Promise.all([
      this.db.clients.findAll(),
      this.db.projects.findAll(),
    ]);
    const clientName = new Map(clients.map((c) => [c.id, c.name]));
    const projectName = new Map(projects.map((p) => [p.id, p.name]));

    return scoped
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((invoice) => this.toView(invoice, clientName, projectName));
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<InvoiceView> {
    const invoice = await this.db.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.access.assertClientAccess(principal, invoice.client_id);

    const [client, project] = await Promise.all([
      this.db.clients.findById(invoice.client_id),
      invoice.project_id ? this.db.projects.findById(invoice.project_id) : Promise.resolve(null),
    ]);
    return this.toView(
      invoice,
      new Map(client ? [[client.id, client.name]] : []),
      new Map(project ? [[project.id, project.name]] : []),
    );
  }

  /** Summary tiles for the portal Invoices screen and the admin dashboard. */
  async summary(principal: AuthPrincipal) {
    const invoices = await this.list(principal);
    const outstanding = invoices.filter(
      (invoice) => invoice.status === 'Outstanding' || invoice.status === 'Overdue',
    );
    const nextDue = invoices
      .filter((invoice) => invoice.status !== 'Paid' && invoice.status !== 'Draft')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

    return {
      paid_total: sum(invoices.filter((i) => i.status === 'Paid').map((i) => i.amount)),
      outstanding_total: sum(outstanding.map((i) => i.amount)),
      overdue_total: sum(invoices.filter((i) => i.is_overdue).map((i) => i.amount)),
      counts: {
        total: invoices.length,
        paid: invoices.filter((i) => i.status === 'Paid').length,
        outstanding: outstanding.length,
        overdue: invoices.filter((i) => i.is_overdue).length,
        draft: invoices.filter((i) => i.status === 'Draft').length,
      },
      next_due: nextDue ?? null,
    };
  }

  async create(principal: AuthPrincipal, dto: CreateInvoiceDto): Promise<InvoiceView> {
    await this.access.assertClientAccess(principal, dto.client_id);
    const client = await this.db.clients.findById(dto.client_id);
    if (!client) throw new BadRequestException('Client does not exist');

    if (dto.project_id) {
      const project = await this.db.projects.findById(dto.project_id);
      if (!project) throw new BadRequestException('Project does not exist');
      if (project.client_id !== dto.client_id) {
        throw new BadRequestException('That project belongs to a different client');
      }
    }

    const settings = await this.db.settings();
    const created = await this.db.invoices.create({
      number: await this.nextNumber(),
      client_id: dto.client_id,
      project_id: dto.project_id ?? null,
      amount: money(dto.amount),
      vat_rate: dto.vat_rate ?? settings.vat_rate,
      status: dto.status ?? 'Draft',
      due_date: dto.due_date.slice(0, 10),
      paid_at: null,
      created_at: new Date().toISOString(),
    });

    await this.activity.record({
      principal,
      action: 'invoice_create',
      targetTable: 'invoices',
      targetId: created.id,
      details: { number: created.number, amount: created.amount, client: client.name },
    });
    return this.findOne(principal, created.id);
  }

  async update(principal: AuthPrincipal, id: string, dto: UpdateInvoiceDto): Promise<InvoiceView> {
    const invoice = await this.db.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.access.assertClientAccess(principal, invoice.client_id);

    if (invoice.status === 'Paid') {
      throw new BadRequestException(
        'This invoice is marked Paid and can no longer be edited. Raise a credit note or a new invoice instead.',
      );
    }

    const patch: Partial<Invoice> = {};
    if (dto.project_id !== undefined) patch.project_id = dto.project_id;
    if (dto.amount !== undefined) patch.amount = money(dto.amount);
    if (dto.vat_rate !== undefined) patch.vat_rate = dto.vat_rate;
    if (dto.due_date !== undefined) patch.due_date = dto.due_date.slice(0, 10);
    if (dto.status !== undefined) patch.status = dto.status;

    const updated = await this.db.invoices.update(id, patch);
    if (!updated) throw new NotFoundException('Invoice not found');

    await this.activity.record({
      principal,
      action: 'invoice_update',
      targetTable: 'invoices',
      targetId: id,
      details: { fields: Object.keys(dto), number: updated.number },
    });
    return this.findOne(principal, id);
  }

  /**
   * PUT /invoices/:id/mark-paid — Admin only, manual, and the ONLY way an
   * invoice ever becomes Paid.
   *
   * There is no payment gateway in this platform and there never will be
   * (PRD section 10, TRD section 13, Architecture section 11). The client pays
   * by the business's own external means and the Admin records it here. Nothing
   * else in this codebase may write `status: 'Paid'` or `paid_at`.
   */
  async markPaid(principal: AuthPrincipal, id: string): Promise<InvoiceView> {
    const invoice = await this.db.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === 'Paid') {
      throw new BadRequestException('This invoice is already marked as paid.');
    }
    if (invoice.status === 'Draft') {
      throw new BadRequestException(
        'A draft invoice cannot be marked paid. Send it to the client first.',
      );
    }

    const paidAt = new Date().toISOString();
    await this.db.invoices.update(id, { status: 'Paid', paid_at: paidAt });

    // Lifetime value follows paid invoices, so it updates in the same action.
    const client = await this.db.clients.findById(invoice.client_id);
    if (client) {
      const clientInvoices = await this.db.invoices.findAll(
        (row) => row.client_id === client.id && row.status === 'Paid',
      );
      await this.db.clients.update(client.id, {
        total_spent: sum(clientInvoices.map((row) => row.amount)),
        updated_at: paidAt,
      });
    }

    await this.activity.record({
      principal,
      action: 'invoice_mark_paid',
      targetTable: 'invoices',
      targetId: id,
      details: { number: invoice.number, amount: invoice.amount, method: 'Manual (external payment)' },
    });
    return this.findOne(principal, id);
  }

  async remove(principal: AuthPrincipal, id: string): Promise<{ id: string; deleted: true }> {
    const invoice = await this.db.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === 'Paid') {
      throw new BadRequestException(
        'A paid invoice is a financial record and cannot be deleted.',
      );
    }

    await this.db.invoices.delete(id);

    await this.activity.record({
      principal,
      action: 'invoice_delete',
      targetTable: 'invoices',
      targetId: id,
      details: { number: invoice.number, amount: invoice.amount },
    });
    return { id, deleted: true };
  }

  /* ------------------------------------------------------------------ */

  private toView(
    invoice: Invoice,
    clientName: Map<string, string>,
    projectName: Map<string, string>,
  ): InvoiceView {
    // amount is gross; derive the net and VAT halves for display.
    const net = money(invoice.amount / (1 + invoice.vat_rate / 100));
    const unpaid = invoice.status !== 'Paid' && invoice.status !== 'Draft';
    const dueMs = new Date(`${invoice.due_date}T23:59:59.999Z`).getTime();
    const overdueMs = Date.now() - dueMs;
    const isOverdue = unpaid && overdueMs > 0;

    return {
      ...invoice,
      client_name: clientName.get(invoice.client_id) ?? 'Unknown client',
      project_name: invoice.project_id ? (projectName.get(invoice.project_id) ?? null) : null,
      net_amount: net,
      vat_amount: money(invoice.amount - net),
      is_overdue: isOverdue,
      days_overdue: isOverdue ? Math.floor(overdueMs / 86_400_000) : 0,
    };
  }

  private async nextNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const existing = await this.db.invoices.findAll((row) => row.number.startsWith(prefix));
    const highest = existing.reduce((max, invoice) => {
      const suffix = Number(invoice.number.slice(prefix.length));
      return Number.isFinite(suffix) && suffix > max ? suffix : max;
    }, 0);
    return `${prefix}${String(highest + 1).padStart(4, '0')}`;
  }
}
