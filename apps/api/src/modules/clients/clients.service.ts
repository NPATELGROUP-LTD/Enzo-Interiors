import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { AccessService } from '../../common/access/access.service';
import { Client } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { PrivateStorage } from '../../core/storage';
import { DatabaseService } from '../../data/database.service';
import { AuthService, looksHashed } from '../auth/auth.service';
import { confirmPassword } from '../auth/reauth';
import { sumMoney } from '../invoices/totals';
import { doneStage, loadStages } from '../projects/stages';
import { CreateClientDto, UpdateClientDto } from './dto';

/**
 * A client as returned over the wire. `password_hash` and `token_version` are
 * stripped — a credential never leaves the API, not even to an Admin.
 */
export type ClientView = Omit<Client, 'password_hash' | 'token_version' | 'total_spent'> & {
  has_portal_access: boolean;
  /** Admin only: money is not a Designer's business. */
  total_spent?: number;
};

export function toClientView(client: Client): ClientView {
  const { password_hash, ...rest } = client;
  delete rest.token_version;
  return { ...rest, has_portal_access: looksHashed(password_hash) };
}

/** What a Designer may change on a client they can see. The rest is the Admin's. */
const DESIGNER_FIELDS = new Set(['phone', 'address', 'notes']);

@Injectable()
export class ClientsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
    private readonly auth: AuthService,
    private readonly storage: PrivateStorage,
  ) {}

  /** Scoped list. A Designer sees the clients of their assigned projects; Admin sees all. */
  async list(principal: AuthPrincipal): Promise<ClientView[]> {
    const visible = await this.access.visibleClientIds(principal);
    const rows = await this.db.clients.findWhere(visible === 'all' ? {} : { id: { in: [...visible] } }, {
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.view(principal, row));
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<ClientView> {
    return this.view(principal, await this.require(principal, id));
  }

  /** The client as this viewer may see it: a Designer gets no money. */
  private view(principal: AuthPrincipal, client: Client): ClientView {
    const view = toClientView(client);
    if (!this.access.isAdmin(principal)) delete view.total_spent;
    return view;
  }

  /** Access first, then existence: a Designer cannot probe ids outside their scope. */
  private async require(principal: AuthPrincipal, id: string): Promise<Client> {
    await this.access.assertClientAccess(principal, id);
    const client = await this.db.clients.findById(id);
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async create(principal: AuthPrincipal, dto: CreateClientDto): Promise<ClientView> {
    await this.assertEmailFree(dto.email);
    if (dto.assigned_staff_id) await this.assertStaffExists(dto.assigned_staff_id);

    const now = new Date().toISOString();
    const created = await this.db.clients.create({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      phone: dto.phone ?? null,
      address: dto.address ?? null,
      status: dto.status ?? 'Active',
      assigned_staff_id: dto.assigned_staff_id ?? null,
      joined_date: now.slice(0, 10),
      total_spent: 0,
      notes: dto.notes ?? null,
      // No portal access until they accept an invitation; '' never matches (auth verify()).
      password_hash: '',
      created_at: now,
      updated_at: now,
    });

    await this.activity.record({
      principal,
      action: 'client_create',
      targetTable: 'clients',
      targetId: created.id,
      details: { name: created.name, email: created.email },
    });
    return this.view(principal, created);
  }

  async update(principal: AuthPrincipal, id: string, dto: UpdateClientDto): Promise<ClientView> {
    const existing = await this.require(principal, id);
    const fields = Object.keys(dto).filter((key) => dto[key as keyof UpdateClientDto] !== undefined);
    if (!this.access.isAdmin(principal)) {
      const adminOnly = fields.filter((key) => !DESIGNER_FIELDS.has(key));
      if (adminOnly.length > 0) {
        throw new ForbiddenException(`Only an Admin can change ${adminOnly.join(', ')}.`);
      }
    }

    const emailChanged = dto.email !== undefined && dto.email.trim().toLowerCase() !== existing.email.toLowerCase();
    if (emailChanged) await this.assertEmailFree(dto.email!);
    if (dto.assigned_staff_id) await this.assertStaffExists(dto.assigned_staff_id);

    const patch: Partial<Client> = { updated_at: new Date().toISOString() };
    if (dto.name !== undefined) patch.name = dto.name.trim();
    if (dto.email !== undefined) patch.email = dto.email.trim().toLowerCase();
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.address !== undefined) patch.address = dto.address;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.assigned_staff_id !== undefined) patch.assigned_staff_id = dto.assigned_staff_id;
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (dto.total_spent !== undefined) patch.total_spent = dto.total_spent;
    // The sign-in moved: portal sessions and any set-password link sent to the
    // old address stop working (a mistyped address may belong to someone else).
    if (emailChanged) patch.token_version = (existing.token_version ?? 0) + 1;

    const updated = await this.db.clients.update(id, patch);
    if (!updated) throw new NotFoundException('Client not found');

    await this.activity.record({
      principal,
      action: 'client_update',
      targetTable: 'clients',
      targetId: id,
      details: { fields },
    });
    return this.view(principal, updated);
  }

  /**
   * Emails an active client without a portal password a one-time link to
   * choose one (auth.service portal passwords). Sending again is how a lost or
   * expired invitation is replaced.
   */
  async invite(principal: AuthPrincipal, id: string): Promise<{ emailed: boolean }> {
    const client = await this.require(principal, id);
    if (client.status !== 'Active') {
      throw new BadRequestException(`${client.name} is Inactive. Set them to Active before inviting them.`);
    }
    if (looksHashed(client.password_hash)) {
      throw new BadRequestException(`${client.name} already has portal access. They can reset their password from the portal.`);
    }
    const emailed = await this.auth.sendPortalInvite(client, principal.name);
    await this.activity.record({
      principal,
      action: 'client_portal_invite',
      targetTable: 'clients',
      targetId: id,
      details: { email: client.email, emailed },
    });
    return { emailed };
  }

  /**
   * Delete a client and everything that is only theirs: projects, invoices
   * (paid ones too), documents and messages. Irreversible, so it needs the
   * Admin's password again. Rows go in one transaction; their files are
   * removed from storage afterwards, best effort. The activity log keeps a line.
   */
  async remove(principal: AuthPrincipal, id: string, password?: string): Promise<{ id: string; deleted: true }> {
    const client = await this.db.clients.findById(id);
    if (!client) throw new NotFoundException('Client not found');
    await confirmPassword(this.db, principal, password);

    const removed = await this.db.deleteClient(id);
    for (const key of removed.storageKeys) await this.storage.remove(key);

    await this.activity.record({
      principal,
      action: 'client_delete',
      targetTable: 'clients',
      targetId: id,
      details: { name: client.name, email: client.email, projects: removed.projects, invoices: removed.invoices },
    });
    return { id, deleted: true };
  }

  /**
   * Everything the Client Detail screen's tabs need, in one round trip:
   * Overview, Projects, Invoices, Documents, Notes and Activity Log. A
   * Designer gets only the projects assigned to them.
   */
  async detail(principal: AuthPrincipal, id: string) {
    const client = await this.require(principal, id);
    const isAdmin = this.access.isAdmin(principal);

    const [projects, invoices, documents, activity] = await Promise.all([
      this.db.projects.findWhere(
        { client_id: id, ...this.access.projectScope(principal) },
        { orderBy: { created_at: 'desc' } },
      ),
      // Invoices are the Admin's: a Designer gets none, and no totals from them.
      isAdmin ? this.db.invoices.findWhere({ client_id: id }, { orderBy: { created_at: 'desc' } }) : Promise.resolve([]),
      // A Designer sees only the files of their own projects, not the whole client's.
      this.access
        .documentScope(principal)
        .then((scope) => this.db.documents.findWhere({ ...scope, client_id: id }, { orderBy: { upload_date: 'desc' } })),
      this.activity.listForTarget('clients', id),
    ]);

    const done = doneStage(await loadStages(this.db));
    const assignedStaff = client.assigned_staff_id
      ? await this.db.staffUsers.findById(client.assigned_staff_id)
      : null;

    return {
      client: this.view(principal, client),
      assigned_staff: assignedStaff ? { id: assignedStaff.id, name: assignedStaff.name, role: assignedStaff.role } : null,
      projects,
      invoices,
      // Where a file is stored is the API's business, not the screen's.
      documents: documents.map(({ storage_url: _storage, ...document }) => document),
      activity,
      stats: {
        // Lifetime value counts only invoices actually marked Paid — the manual
        // Admin action is the single source of truth for money received.
        ...(isAdmin && {
          lifetime_value: sumMoney(
            invoices.filter((invoice) => invoice.status === 'Paid').map((invoice) => invoice.amount),
          ),
          outstanding: sumMoney(
            invoices
              .filter((invoice) => ['Sent', 'Outstanding', 'Overdue'].includes(invoice.status))
              .map((invoice) => invoice.amount),
          ),
        }),
        active_projects: projects.filter((project) => project.status !== done).length,
        total_projects: projects.length,
      },
    };
  }

  private async assertEmailFree(email: string): Promise<void> {
    const clash = await this.db.clients.findFirstWhere({
      email: { equals: email.trim().toLowerCase(), mode: 'insensitive' },
    });
    if (clash) {
      throw new BadRequestException('A client with that email address already exists');
    }
  }

  private async assertStaffExists(staffId: string): Promise<void> {
    const staff = await this.db.staffUsers.findById(staffId);
    if (!staff) throw new BadRequestException('Assigned staff member does not exist');
  }
}
