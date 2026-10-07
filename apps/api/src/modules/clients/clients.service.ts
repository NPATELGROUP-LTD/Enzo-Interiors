import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { AccessService } from '../../common/access/access.service';
import { Client } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { sum } from '../../common/util/money';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';
import { CreateClientDto, UpdateClientDto } from './dto';

/**
 * A client as returned over the wire. `password_hash` is stripped — a
 * credential never leaves the API, not even to an Admin.
 */
export type ClientView = Omit<Client, 'password_hash'> & { has_portal_access: boolean };

export function toClientView(client: Client): ClientView {
  const { password_hash, ...rest } = client;
  return { ...rest, has_portal_access: password_hash.length > 0 };
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
  ) {}

  /** Scoped list. A Designer sees their assigned clients only; Admin sees all. */
  async list(principal: AuthPrincipal): Promise<ClientView[]> {
    const all = await this.db.clients.findAll();
    const scoped = await this.access.scopeToVisibleClients(principal, all, (row) => row.id);
    return scoped
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(toClientView);
  }

  async findOne(principal: AuthPrincipal, id: string): Promise<ClientView> {
    await this.access.assertClientAccess(principal, id);
    const client = await this.db.clients.findById(id);
    if (!client) throw new NotFoundException('Client not found');
    return toClientView(client);
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
      // MOCK ONLY — plaintext. Empty string means "no portal access yet".
      password_hash: dto.password ?? '',
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
    return toClientView(created);
  }

  async update(principal: AuthPrincipal, id: string, dto: UpdateClientDto): Promise<ClientView> {
    await this.access.assertClientAccess(principal, id);
    const existing = await this.db.clients.findById(id);
    if (!existing) throw new NotFoundException('Client not found');

    if (dto.email && dto.email.toLowerCase() !== existing.email.toLowerCase()) {
      await this.assertEmailFree(dto.email);
    }
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
    // MOCK ONLY — plaintext.
    if (dto.password !== undefined) patch.password_hash = dto.password;

    const updated = await this.db.clients.update(id, patch);
    if (!updated) throw new NotFoundException('Client not found');

    await this.activity.record({
      principal,
      action: 'client_update',
      targetTable: 'clients',
      targetId: id,
      // Never log the password itself, only that it changed.
      details: {
        fields: Object.keys(dto).map((key) => (key === 'password' ? 'password (changed)' : key)),
      },
    });
    return toClientView(updated);
  }

  /**
   * Delete a client.
   *
   * Refuses while dependent records exist rather than cascading. The schema
   * doc scopes cascades tightly — a client delete must never silently take
   * invoices or projects with it, because those are financial and operational
   * records. The admin is told what to clear first.
   */
  async remove(principal: AuthPrincipal, id: string): Promise<{ id: string; deleted: true }> {
    const client = await this.db.clients.findById(id);
    if (!client) throw new NotFoundException('Client not found');

    const [projects, invoices] = await Promise.all([
      this.db.projects.count((row) => row.client_id === id),
      this.db.invoices.count((row) => row.client_id === id),
    ]);

    const blockers: string[] = [];
    if (projects > 0) blockers.push(`${projects} project${projects === 1 ? '' : 's'}`);
    if (invoices > 0) blockers.push(`${invoices} invoice${invoices === 1 ? '' : 's'}`);
    if (blockers.length > 0) {
      throw new BadRequestException(
        `Cannot delete ${client.name} while ${blockers.join(', ')} still reference them. ` +
          'Remove or reassign those records first, or set the client to Inactive instead.',
      );
    }

    // Only records that belong exclusively to this client and carry no
    // financial meaning are cleaned up alongside them.
    const conversations = await this.db.conversations.findAll((row) => row.client_id === id);
    for (const conversation of conversations) {
      await this.db.messages.deleteMany((row) => row.conversation_id === conversation.id);
    }
    await this.db.conversations.deleteMany((row) => row.client_id === id);
    await this.db.documents.deleteMany((row) => row.client_id === id);
    await this.db.bookings.deleteMany((row) => row.client_id === id);
    await this.db.notificationPreferences.deleteMany(
      (row) => row.owner_type === 'Client' && row.owner_id === id,
    );
    await this.db.clients.delete(id);

    await this.activity.record({
      principal,
      action: 'client_delete',
      targetTable: 'clients',
      targetId: id,
      details: { name: client.name, email: client.email },
    });
    return { id, deleted: true };
  }

  /**
   * Everything the Client Detail screen's tabs need, in one round trip:
   * Overview, Projects, Invoices, Documents, Notes and Activity Log.
   */
  async detail(principal: AuthPrincipal, id: string) {
    await this.access.assertClientAccess(principal, id);
    const client = await this.db.clients.findById(id);
    if (!client) throw new NotFoundException('Client not found');

    const [projects, invoices, documents, bookings, activity] = await Promise.all([
      this.db.projects.findAll((row) => row.client_id === id),
      this.db.invoices.findAll((row) => row.client_id === id),
      this.db.documents.findAll((row) => row.client_id === id),
      this.db.bookings.findAll((row) => row.client_id === id),
      this.activity.listForTarget('clients', id),
    ]);

    const assignedStaff = client.assigned_staff_id
      ? await this.db.staffUsers.findById(client.assigned_staff_id)
      : null;

    return {
      client: toClientView(client),
      assigned_staff: assignedStaff ? { id: assignedStaff.id, name: assignedStaff.name, role: assignedStaff.role } : null,
      projects: projects.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      invoices: invoices.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      documents: documents.sort((a, b) => b.upload_date.localeCompare(a.upload_date)),
      bookings: bookings.sort((a, b) => a.date_time.localeCompare(b.date_time)),
      activity,
      stats: {
        // Lifetime value counts only invoices actually marked Paid — the manual
        // Admin action is the single source of truth for money received.
        lifetime_value: sum(
          invoices.filter((invoice) => invoice.status === 'Paid').map((invoice) => invoice.amount),
        ),
        outstanding: sum(
          invoices
            .filter((invoice) => invoice.status === 'Outstanding' || invoice.status === 'Overdue')
            .map((invoice) => invoice.amount),
        ),
        active_projects: projects.filter((project) => project.status !== 'Completed').length,
        total_projects: projects.length,
      },
    };
  }

  private async assertEmailFree(email: string): Promise<void> {
    const clash = await this.db.clients.findOne(
      (row) => row.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (clash) {
      throw new BadRequestException('A client with that email address already exists');
    }
  }

  private async assertStaffExists(staffId: string): Promise<void> {
    const staff = await this.db.staffUsers.findById(staffId);
    if (!staff) throw new BadRequestException('Assigned staff member does not exist');
  }
}
