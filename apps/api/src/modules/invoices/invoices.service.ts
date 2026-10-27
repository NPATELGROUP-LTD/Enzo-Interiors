import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { AccessService } from '../../common/access/access.service';
import { BankDetails, Invoice, InvoiceItem, InvoiceStage, InvoiceStatus, PaymentScheduleRow } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { ItemInput } from '../../data/invoice-store';
import { DatabaseService } from '../../data/database.service';
import { confirmPassword } from '../auth/reauth';
import { NotificationsService } from '../notifications/notifications.module';
import { MAX_STAGES, StageDto, StagePaidDto, stageRows } from './stages';
import { MAX_AMOUNT, lateMs, splitGross, sumMoney, totalsOf } from './totals';

/* -------------------------------------------------------------------------- */
/* DTOs                                                                       */
/* -------------------------------------------------------------------------- */

/** Trims; an empty string becomes null (= cleared). */
const OptionalText = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() || null : value));

const MONEY = { maxDecimalPlaces: 2 } as const;

export class InvoiceItemDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @MinLength(1, { message: 'Describe each line' }) @MaxLength(300) description!: string;

  /** The heading the line sits under, e.g. "Materials". */
  @OptionalText() @IsOptional() @IsString() @MaxLength(120) section?: string | null;
  @OptionalText() @IsOptional() @IsString() @MaxLength(300) detail?: string | null;

  @Type(() => Number)
  @IsInt({ message: 'Quantity must be a whole number' })
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(100_000)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Price must have at most 2 decimal places' })
  @Min(0, { message: 'Price cannot be negative' })
  @Max(9_999_999.99)
  unit_price!: number; // 0 = a quantity-only row, printed without a price
}

export class PaymentScheduleRowDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @MinLength(1, { message: 'Name each payment' }) @MaxLength(120) label!: string;

  @Type(() => Number)
  @IsNumber(MONEY, { message: 'Payment amounts must have at most 2 decimal places' })
  @Min(0) @Max(9_999_999.99)
  amount!: number;

  @IsOptional() @IsDateString({}, { message: 'Enter a valid payment date' }) date?: string | null;
}

/** The parts of an invoice that are paperwork, not money: editable whatever the status. */
class InvoiceDocumentDto {
  @OptionalText() @IsOptional() @IsString() @MaxLength(200) job_name?: string | null;
  @OptionalText() @IsOptional() @IsString() @MaxLength(300) job_address?: string | null;
  @OptionalText() @IsOptional() @IsString() @MaxLength(4000) job_notes?: string | null;

  @IsOptional()
  @IsArray() @ArrayMaxSize(12, { message: 'A payment schedule can have at most 12 rows' }) @ValidateNested({ each: true }) @Type(() => PaymentScheduleRowDto)
  payment_schedule?: PaymentScheduleRowDto[];
}

export class CreateInvoiceDto extends InvoiceDocumentDto {
  @IsString() client_id!: string;
  @IsOptional() @IsString() project_id?: string | null;

  /** Net (ex-VAT) lines. The invoice's amount is worked out from them, never sent. */
  @IsArray() @ArrayMinSize(1, { message: 'Add at least one line' }) @ArrayMaxSize(50, { message: 'An invoice can have at most 50 lines' }) @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) vat_rate?: number;
  /** A fixed £ amount off the subtotal, before VAT. */
  @IsOptional() @Type(() => Number) @IsNumber(MONEY, { message: 'The discount must have at most 2 decimal places' }) @Min(0) @Max(9_999_999.99) discount?: number;

  @IsDateString({}, { message: 'Enter a valid due date' })
  due_date!: string;

  @IsOptional()
  @IsIn(['Draft', 'Sent'], { message: 'A new invoice can only be Draft or Sent' })
  status?: 'Draft' | 'Sent';

  /** Payment stages. Omitted or empty = paid in one go, as before; the admin form starts from DEFAULT_STAGES. */
  @IsOptional()
  @IsArray() @ArrayMaxSize(MAX_STAGES, { message: `An invoice can have at most ${MAX_STAGES} payment stages` }) @ValidateNested({ each: true }) @Type(() => StageDto)
  stages?: StageDto[];
}

export class UpdateInvoiceDto extends InvoiceDocumentDto {
  @IsOptional() @IsString() project_id?: string | null;
  @IsOptional()
  @IsArray() @ArrayMinSize(1, { message: 'Add at least one line' }) @ArrayMaxSize(50, { message: 'An invoice can have at most 50 lines' }) @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) vat_rate?: number;
  /** A fixed £ amount off the subtotal, before VAT. */
  @IsOptional() @Type(() => Number) @IsNumber(MONEY, { message: 'The discount must have at most 2 decimal places' }) @Min(0) @Max(9_999_999.99) discount?: number;
  @IsOptional() @IsDateString() due_date?: string;

  /** Paid is not accepted here: recording payment is its own audited action (mark-paid). */
  @IsOptional()
  @IsIn(['Draft', 'Sent', 'Overdue'], { message: 'Use the mark-paid action to record payment' })
  status?: 'Draft' | 'Sent' | 'Overdue';

  /** Replaces the stages; refused once one is paid. `[]` removes them. */
  @IsOptional()
  @IsArray() @ArrayMaxSize(MAX_STAGES, { message: `An invoice can have at most ${MAX_STAGES} payment stages` }) @ValidateNested({ each: true }) @Type(() => StageDto)
  stages?: StageDto[];
}

/**
 * Where an invoice may go next. Draft -> Sent -> Overdue; a sent invoice can go
 * back to Draft to be edited; Paid is final and only mark-paid gets there.
 * 'Outstanding' is the legacy name for Sent and is only ever left, never set.
 *
 * Lines, VAT and the discount can be edited only while the invoice is a Draft,
 * or in the same request that moves it back to Draft. Once it has been sent,
 * the client may have it, so the numbers do not change under them. The job
 * details and the payment schedule (DOCUMENT_FIELDS) change on any status,
 * Paid included: they never touch `amount`. The payment stages can be replaced
 * until one is paid; an invoice with a paid stage cannot go back to Draft.
 */
const NEXT: Record<InvoiceStatus, InvoiceStatus[]> = {
  Draft: ['Sent'],
  Sent: ['Draft', 'Overdue'],
  Outstanding: ['Draft', 'Sent', 'Overdue'],
  Overdue: ['Draft', 'Sent'],
  Paid: [],
};

/* -------------------------------------------------------------------------- */
/* View model                                                                 */
/* -------------------------------------------------------------------------- */

export interface InvoiceView extends Invoice {
  items: InvoiceItem[];
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  project_name: string | null;
  /** The lines added up, before the discount. */
  subtotal_amount: number;
  /** The ex-VAT amount after the discount and the VAT on it; `amount` is their sum, the gross payable. */
  net_amount: number;
  vat_amount: number;
  /** True when unpaid and past its due date, regardless of the stored status. */
  is_overdue: boolean;
  days_overdue: number;
  issuer: Issuer;
  /** Payment stages in order; empty = paid in one go. `paid_by` is left out for a client. */
  stages: Array<Omit<InvoiceStage, 'paid_by'> & { paid_by?: string | null }>;
  /** Money recorded as received: paid stages, or the whole amount once Paid. */
  paid_amount: number;
  /** `amount` less `paid_amount`: what is still owed. */
  balance_amount: number;
  /** Settings › Bank details, printed on the sheet. Only ever sent in an authenticated invoice payload. */
  bank_details: BankDetails | null;
}

const DOCUMENT_FIELDS = new Set(['job_name', 'job_address', 'job_notes', 'payment_schedule']);

/** GET /invoices/export takes at most this many ids. */
export const EXPORT_LIMIT = 200;

/** Who the invoice is from: the CMS company entry, else what the printed invoice has always said. */
export interface Issuer {
  name: string;
  address: string[];
  phone: string;
  email: string;
}

const NUMBER_ATTEMPTS = 8;

@Injectable()
export class InvoicesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Staff reach here only as Admin (controller). A client sees their own, never Drafts. */
  async list(principal: AuthPrincipal): Promise<InvoiceView[]> {
    const client = this.access.isClient(principal);
    const where = client ? { client_id: principal.id, status: { not: 'Draft' } } : {};
    return this.views(await this.db.invoices.findWhere(where, { orderBy: { created_at: 'desc' } }), client);
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<InvoiceView> {
    const invoice = await this.db.invoices.findById(id);
    // A client gets the same 404 for someone else's invoice and for their own Draft.
    if (!invoice || (this.access.isClient(principal) && (invoice.client_id !== principal.id || invoice.status === 'Draft'))) {
      throw new NotFoundException('Invoice not found');
    }
    return (await this.views([invoice], this.access.isClient(principal)))[0]!;
  }

  /** Admin only (controller): several invoices in full, in the order asked, for one print run. */
  async export(idList: unknown): Promise<InvoiceView[]> {
    // `?ids=a,b` is a string; a repeated `?ids=a&ids=b` arrives as an array.
    const raw = Array.isArray(idList) ? idList.join(',') : typeof idList === 'string' ? idList : '';
    const ids = [...new Set(raw.split(',').map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) throw new BadRequestException('Choose at least one invoice');
    if (ids.length > EXPORT_LIMIT) throw new BadRequestException(`Export at most ${EXPORT_LIMIT} invoices at a time`);
    const found = await this.views(await this.db.invoices.findWhere({ id: { in: ids } }));
    const order = new Map(ids.map((id, index) => [id, index]));
    return found.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }

  /** Summary tiles for the portal Invoices screen. Drafts never count for a client. */
  async summary(principal: AuthPrincipal) {
    const invoices = await this.list(principal);
    const outstanding = invoices.filter((i) => i.status === 'Outstanding' || i.status === 'Sent' || i.status === 'Overdue');
    // What is still owed, so an invoice part-paid in stages counts only for its balance.
    const balances = (rows: InvoiceView[]) => sumMoney(rows.map((i) => i.balance_amount));
    const nextDue = invoices
      .filter((i) => i.status !== 'Paid' && i.status !== 'Draft')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

    return {
      paid_total: sumMoney(invoices.map((i) => i.paid_amount)),
      outstanding_total: balances(outstanding),
      overdue_total: balances(invoices.filter((i) => i.is_overdue)),
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
    const client = await this.db.clients.findById(dto.client_id);
    if (!client) throw new BadRequestException('Client does not exist');
    await this.assertProjectOfClient(dto.project_id, dto.client_id);

    const vat_rate = dto.vat_rate ?? (await this.db.settings()).vat_rate;
    const discount = dto.discount ?? 0;
    const items = this.lines(dto.items);
    const { gross } = this.totals(items, vat_rate, discount);
    const stages = stageRows(gross, dto.stages ?? []);

    // Two invoices created at once can pick the same next number; the unique
    // index refuses the second, which then looks again. Each failed attempt
    // means another invoice was committed, so this is bounded by concurrency.
    for (let attempt = 1; ; attempt++) {
      try {
        const created = await this.db.invoiceStore.create(
          {
            number: await this.nextNumber(),
            client_id: dto.client_id,
            project_id: dto.project_id ?? null,
            amount: gross,
            vat_rate,
            status: dto.status ?? 'Draft',
            due_date: dto.due_date.slice(0, 10),
            paid_at: null,
            created_at: new Date().toISOString(),
            discount,
            job_name: dto.job_name ?? null,
            job_address: dto.job_address ?? null,
            job_notes: dto.job_notes ?? null,
            payment_schedule: this.schedule(dto.payment_schedule ?? []),
          },
          items,
          stages,
        );
        await this.activity.record({
          principal,
          action: 'invoice_create',
          targetTable: 'invoices',
          targetId: created.id,
          details: { number: created.number, amount: created.amount, client: client.name },
        });
        if (created.status !== 'Draft') await this.tellClient(created);
        return this.findOne(principal, created.id);
      } catch (error) {
        const taken = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!taken) throw error;
        if (attempt >= NUMBER_ATTEMPTS) throw new ConflictException('Could not reserve an invoice number. Please try again.');
      }
    }
  }

  async update(principal: AuthPrincipal, id: string, dto: UpdateInvoiceDto): Promise<InvoiceView> {
    const invoice = await this.db.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');

    const asked = Object.entries(dto).filter(([, value]) => value !== undefined).map(([key]) => key);
    const paid = invoice.status === 'Paid';
    if (paid && asked.some((key) => !DOCUMENT_FIELDS.has(key))) {
      throw new BadRequestException(
        'This invoice is marked Paid: only the job details and payment schedule can still change. Raise a credit note or a new invoice instead.',
      );
    }
    if (dto.status && dto.status !== invoice.status && !NEXT[invoice.status].includes(dto.status)) {
      throw new BadRequestException(`A ${invoice.status} invoice cannot be changed to ${dto.status}.`);
    }
    const status = dto.status ?? invoice.status;
    const editsMoney = dto.items !== undefined || dto.vat_rate !== undefined || dto.discount !== undefined;
    if (editsMoney && status !== 'Draft') {
      throw new BadRequestException('Lines, VAT and the discount can only be edited on a Draft. Move the invoice back to Draft first.');
    }
    if (dto.project_id !== undefined) await this.assertProjectOfClient(dto.project_id, invoice.client_id);

    const stored = paid ? [] : await this.db.invoiceStages.findWhere({ invoice_id: id }, { orderBy: { position: 'asc' } });
    const anyStagePaid = stored.some((stage) => stage.paid_at);
    if (anyStagePaid && dto.stages !== undefined) {
      throw new BadRequestException('A stage has been paid, so the stages can no longer change. Undo the payment first.');
    }
    if (anyStagePaid && status === 'Draft') {
      throw new BadRequestException('A stage has been paid, so this invoice cannot go back to Draft.');
    }

    const patch: Partial<Invoice> = paid ? {} : { status };
    if (dto.project_id !== undefined) patch.project_id = dto.project_id;
    if (dto.due_date !== undefined) patch.due_date = dto.due_date.slice(0, 10);
    if (dto.vat_rate !== undefined) patch.vat_rate = dto.vat_rate;
    if (dto.discount !== undefined) patch.discount = dto.discount;
    if (dto.job_name !== undefined) patch.job_name = dto.job_name;
    if (dto.job_address !== undefined) patch.job_address = dto.job_address;
    if (dto.job_notes !== undefined) patch.job_notes = dto.job_notes;
    if (dto.payment_schedule !== undefined) patch.payment_schedule = this.schedule(dto.payment_schedule);

    const given = dto.items ? this.lines(dto.items) : undefined;
    if (editsMoney) {
      // Re-total from the new lines, or the existing ones when only VAT changed.
      // An invoice with no lines at all (older than lines) keeps its stored amount.
      const lines = given ?? (await this.itemsOf(id));
      if (lines.length > 0) {
        patch.amount = this.totals(lines, patch.vat_rate ?? invoice.vat_rate, patch.discount ?? invoice.discount).gross;
      }
    }

    // New stages as asked, else the stored ones re-worked against a changed total (same mode and value).
    const stages =
      dto.stages !== undefined ? stageRows(patch.amount ?? invoice.amount, dto.stages)
      : patch.amount !== undefined && stored.length > 0 ? stageRows(patch.amount, stored)
      : undefined;

    if (Object.keys(patch).length === 0) return this.findOne(principal, id);
    const updated = await this.db.invoiceStore.update(id, patch, given, paid, stages);
    if (!updated) throw new BadRequestException('This invoice is marked Paid and can no longer be edited.');

    await this.activity.record({
      principal,
      action: 'invoice_update',
      targetTable: 'invoices',
      targetId: id,
      details: { fields: Object.keys(dto), number: updated.number },
    });
    if (invoice.status === 'Draft' && updated.status !== 'Draft') await this.tellClient(updated);
    return this.findOne(principal, id);
  }

  /** The client's bell (and devices) when an invoice leaves Draft: the moment they can see it. */
  private async tellClient(invoice: Invoice): Promise<void> {
    await this.notifications.notifyClient(invoice.client_id, {
      kind: 'invoice',
      title: `New invoice ${invoice.number}`,
      link: `/invoices/${invoice.id}`,
    });
  }

  /**
   * PUT /invoices/:id/mark-paid — Admin only, manual, and the ONLY way an
   * invoice ever becomes Paid.
   *
   * There is no payment gateway in this platform and there never will be
   * (PRD section 10, TRD section 13, Architecture section 11). The client pays
   * by the business's own external means and the Admin records it here. Nothing
   * else in this codebase may write `status: 'Paid'` or `paid_at`.
   *
   * The status change and the client's lifetime value are one transaction, and
   * the status change only matches a payable row, so a repeat is refused rather
   * than recorded twice.
   */
  async markPaid(principal: AuthPrincipal, id: string): Promise<InvoiceView> {
    const invoice = await this.db.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'Draft') {
      throw new BadRequestException('A draft invoice cannot be marked paid. Send it to the client first.');
    }

    const paid = await this.db.invoiceStore.markPaid(id, new Date().toISOString());
    if (!paid) throw new BadRequestException('This invoice is already marked as paid.');

    await this.activity.record({
      principal,
      action: 'invoice_mark_paid',
      targetTable: 'invoices',
      targetId: id,
      details: { number: invoice.number, amount: invoice.amount, method: 'Manual (external payment)' },
    });
    return this.findOne(principal, id);
  }

  /**
   * PUT /invoices/:id/stages/:stageId/paid — Admin only, manual. Records that one
   * stage's money arrived on `paid_at` (default today). The last stage to be paid
   * settles the whole invoice in the same transaction (the mark-paid rules: the
   * client's total_spent once, never repeated). No gateway.
   */
  async payStage(principal: AuthPrincipal, id: string, stageId: string, dto: StagePaidDto): Promise<InvoiceView> {
    const invoice = await this.db.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    const stage = await this.db.invoiceStages.findById(stageId);
    if (!stage || stage.invoice_id !== id) throw new NotFoundException('Payment stage not found');
    if (invoice.status === 'Draft') throw new BadRequestException('A draft invoice cannot take payment. Send it to the client first.');

    const today = new Date().toISOString().slice(0, 10);
    const day = dto.paid_at ?? today;
    // One day of slack: London can be a day ahead of UTC for an hour.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(day))) throw new BadRequestException('Enter a valid payment date');
    if (day > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) throw new BadRequestException('A payment date cannot be in the future');

    const updated = await this.db.invoiceStore.payStage(id, stageId, `${day}T00:00:00.000Z`, principal.name);
    if (!updated) throw new BadRequestException('That stage is already marked as paid.');

    await this.activity.record({
      principal,
      action: 'invoice_stage_paid',
      targetTable: 'invoices',
      targetId: id,
      details: { number: invoice.number, stage: stage.label, amount: stage.amount, paid_at: day, invoice_paid: updated.status === 'Paid' },
    });
    return this.findOne(principal, id);
  }

  /** DELETE /invoices/:id/stages/:stageId/paid — undo a recorded stage payment while the invoice is not fully paid. */
  async unpayStage(principal: AuthPrincipal, id: string, stageId: string): Promise<InvoiceView> {
    const invoice = await this.db.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    const stage = await this.db.invoiceStages.findById(stageId);
    if (!stage || stage.invoice_id !== id) throw new NotFoundException('Payment stage not found');
    if (invoice.status === 'Paid') throw new BadRequestException('This invoice is fully paid, so a payment can no longer be undone.');

    if (!(await this.db.invoiceStore.unpayStage(id, stageId))) throw new BadRequestException('That stage is not marked as paid.');

    await this.activity.record({
      principal,
      action: 'invoice_stage_unpaid',
      targetTable: 'invoices',
      targetId: id,
      details: { number: invoice.number, stage: stage.label, amount: stage.amount },
    });
    return this.findOne(principal, id);
  }

  /**
   * A Paid invoice is a financial record: deleting one needs the Admin's
   * password again, and takes its amount out of the client's lifetime value.
   * So is one with a stage paid: money has been recorded against it.
   */
  async remove(principal: AuthPrincipal, id: string, password?: string): Promise<{ id: string; deleted: true }> {
    const invoice = await this.db.invoices.findById(id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'Paid' || (await this.db.invoiceStages.countWhere({ invoice_id: id, paid_at: { not: null } })) > 0) {
      await confirmPassword(this.db, principal, password);
    }

    if (!(await this.db.invoiceStore.remove(id))) throw new NotFoundException('Invoice not found');

    await this.activity.record({
      principal,
      action: 'invoice_delete',
      targetTable: 'invoices',
      targetId: id,
      details: { number: invoice.number, amount: invoice.amount, status: invoice.status },
    });
    return { id, deleted: true };
  }

  /* ------------------------------------------------------------------ */

  private lines(dtos: InvoiceItemDto[]): ItemInput[] {
    return dtos.map(({ description, section, detail, quantity, unit_price }) => ({
      description,
      section: section ?? null,
      detail: detail ?? null,
      quantity,
      unit_price,
    }));
  }

  private schedule(rows: PaymentScheduleRowDto[]): PaymentScheduleRow[] {
    return rows.map(({ label, amount, date }) => ({ label, amount, date: date ? date.slice(0, 10) : null }));
  }

  private totals(items: ItemInput[], vatRate: number, discount: number) {
    const totals = totalsOf(items, vatRate, discount);
    if (totals.net < 0) throw new BadRequestException('The discount cannot be more than the lines add up to.');
    if (totals.gross >= MAX_AMOUNT) throw new BadRequestException('That total is too large for one invoice.');
    return totals;
  }

  /** The company block printed at the top. One indexed read per request, however many invoices. */
  private async issuer(): Promise<Issuer> {
    const entry = await this.db.cmsEntries.findFirstWhere({ collection: 'company' });
    const company = (entry?.published ?? entry?.draft ?? {}) as {
      legalName?: string;
      city?: string;
      phone?: { display?: string };
      email?: string;
      address?: { street?: string; postcode?: string };
    };
    const street = company.address?.street?.trim();
    const town = [company.city, company.address?.postcode].filter((part) => part?.trim()).join(', ');
    return {
      name: company.legalName?.trim() || 'Enzo Interiors LTD.',
      address: street ? [street, town, 'United Kingdom'].filter(Boolean) : ['51 Forest Road, Leicester,', 'LE5 0DW, United Kingdom'],
      phone: company.phone?.display?.trim() || '077 77 333 052',
      email: company.email?.trim() || 'info@enzointeriors.co.uk',
    };
  }

  private itemsOf(invoiceId: string): Promise<InvoiceItem[]> {
    return this.db.invoiceItems.findWhere({ invoice_id: invoiceId }, { orderBy: { position: 'asc' } });
  }

  /** A project may only be invoiced to its own client. */
  private async assertProjectOfClient(projectId: string | null | undefined, clientId: string): Promise<void> {
    if (!projectId) return;
    const project = await this.db.projects.findById(projectId);
    if (!project) throw new BadRequestException('Project does not exist');
    if (project.client_id !== clientId) throw new BadRequestException('That project belongs to a different client');
  }

  /**
   * Invoices with their lines, stages and names, in a handful of queries however many there are.
   * `forClient` hides what only staff see (who recorded a payment).
   */
  private async views(invoices: Invoice[], forClient = false): Promise<InvoiceView[]> {
    if (invoices.length === 0) return [];
    const ids = (pick: (i: Invoice) => string | null) => [...new Set(invoices.map(pick).filter((v): v is string => !!v))];
    const [items, stages, clients, projects, issuer, settings] = await Promise.all([
      this.db.invoiceItems.findWhere({ invoice_id: { in: ids((i) => i.id) } }, { orderBy: { position: 'asc' } }),
      this.db.invoiceStages.findWhere({ invoice_id: { in: ids((i) => i.id) } }, { orderBy: { position: 'asc' } }),
      this.db.clients.findWhere({ id: { in: ids((i) => i.client_id) } }),
      this.db.projects.findWhere({ id: { in: ids((i) => i.project_id) } }),
      this.issuer(),
      this.db.siteSettings.findById('site'),
    ]);
    const clientOf = new Map(clients.map((c) => [c.id, c]));
    const projectName = new Map(projects.map((p) => [p.id, p.name]));
    return invoices.map((invoice) => {
      const own = items.filter((item) => item.invoice_id === invoice.id);
      const split = own.length > 0 ? totalsOf(own, invoice.vat_rate, invoice.discount) : splitGross(invoice.amount, invoice.vat_rate);
      const client = clientOf.get(invoice.client_id);
      const unpaid = invoice.status !== 'Paid' && invoice.status !== 'Draft';
      const late = unpaid ? lateMs(invoice.due_date) : 0;
      const ownStages = stages
        .filter((stage) => stage.invoice_id === invoice.id)
        .map(({ paid_by, ...stage }) => (forClient ? stage : { ...stage, paid_by }));
      const paidAmount = invoice.status === 'Paid' ? invoice.amount : sumMoney(ownStages.filter((s) => s.paid_at).map((s) => s.amount));
      return {
        ...invoice,
        items: own,
        stages: ownStages,
        paid_amount: paidAmount,
        balance_amount: sumMoney([invoice.amount, -paidAmount]),
        bank_details: settings?.bank_details ?? null,
        payment_schedule: Array.isArray(invoice.payment_schedule) ? invoice.payment_schedule : [],
        client_name: client?.name ?? 'Unknown client',
        client_email: client?.email ?? null,
        client_phone: client?.phone ?? null,
        project_name: invoice.project_id ? (projectName.get(invoice.project_id) ?? null) : null,
        subtotal_amount: split.subtotal,
        net_amount: split.net,
        vat_amount: split.vat,
        is_overdue: late > 0,
        days_overdue: late > 0 ? Math.floor(late / 86_400_000) : 0,
        issuer,
      };
    });
  }

  private async nextNumber(): Promise<string> {
    const prefix = `INV-${new Date().getFullYear()}-`;
    const existing = await this.db.invoices.findWhere({ number: { startsWith: prefix } });
    const highest = existing.reduce((max, { number }) => Math.max(max, Number(number.slice(prefix.length)) || 0), 0);
    return `${prefix}${String(highest + 1).padStart(4, '0')}`;
  }
}
