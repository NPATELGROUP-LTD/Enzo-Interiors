import { Controller, Get, Injectable, Module } from '@nestjs/common';

import { AccessService } from '../../common/access/access.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { Project } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';
import { Where } from '../../data/prisma-repository';
import { addDays, studioInstant, studioParts } from '../booking/slots';
import { lateMs, sumMoney } from '../invoices/totals';
import { approvalStages, doneStage, loadStages } from '../projects/stages';
import { lastMonths } from './months';

/** Money still to come in: not a Draft, not Paid. */
const UNPAID = { in: ['Sent', 'Outstanding', 'Overdue'] };
const DAY = 86_400_000;

/**
 * The dashboards, one per audience, each answering from SQL (counts, sums and
 * bounded lists; no table is read whole):
 *
 *   /dashboard/admin     Admin: money, enquiries, consultations, every project.
 *   /dashboard/designer  Designer/Installer: only the projects they are on.
 *                        No money, no enquiries, no consultations.
 *   /dashboard/portal    Client: their own shared projects, files and invoices.
 *
 * Editors get 403 on all three. The audiences differ in shape, not just in
 * scope, so they are separate routes with their own @Roles rather than one
 * route that quietly drops fields.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
  ) {}

  /**
   * Projects by configured stage within `scope` (one count each, at most 20),
   * plus the headline numbers. `stages` carries the order for the charts.
   */
  private async projectCounts(scope: Where<Project>) {
    const stages = await loadStages(this.db);
    const names = stages.map((stage) => stage.name);
    const counts = await Promise.all(names.map((status) => this.db.projects.countWhere({ ...scope, status })));
    const by_stage: Record<string, number> = Object.fromEntries(names.map((name, i) => [name, counts[i]!]));
    const approval = approvalStages(stages);
    const completed = by_stage[doneStage(stages)]!;
    return {
      stages: names,
      active: counts.reduce((a, b) => a + b, 0) - completed,
      completed,
      awaiting_decision: approval.reduce((sum, name) => sum + by_stage[name]!, 0),
      by_stage,
    };
  }

  async admin() {
    const now = new Date();
    const nowIso = now.toISOString();
    const today = studioParts(now).date;
    const months = lastMonths(today.slice(0, 7), 12);
    const since = studioInstant(`${months[0]!.month}-01`, '00:00').toISOString();
    const thisMonth = studioInstant(`${months[11]!.month}-01`, '00:00').toISOString();
    // due_date is midnight UTC of the due day; late once that day has ended.
    const utcToday = `${nowIso.slice(0, 10)}T00:00:00.000Z`;
    const inAWeek = new Date(Date.parse(utcToday) + 8 * DAY).toISOString();
    const upcoming = { status: 'Confirmed', starts_at: { gte: nowIso } };
    const store = this.db.invoiceStore;

    const [
      projects, nextAppointment, appointmentsToday, appointmentsUpcoming, appointmentRows,
      enquiriesTotal, enquiriesNew, enquiriesRecent,
      outstanding, dueThisWeek, overdue, paid, paidThisMonth, paidRows,
      clientsTotal, clientsActive,
    ] = await Promise.all([
      this.projectCounts({}),
      this.db.appointments.findFirstWhere(upcoming, { starts_at: 'asc' }),
      this.db.appointments.countWhere({
        status: 'Confirmed',
        starts_at: { gte: studioInstant(today, '00:00').toISOString(), lt: studioInstant(addDays(today, 1), '00:00').toISOString() },
      }),
      this.db.appointments.countWhere(upcoming),
      this.db.appointments.findWhere({ status: 'Confirmed', starts_at: { gte: since } }),
      this.db.contactSubmissions.countWhere({}),
      this.db.contactSubmissions.countWhere({ status: 'New' }),
      this.db.contactSubmissions.countWhere({ created_at: { gt: new Date(now.getTime() - DAY).toISOString() } }),
      store.sum({ status: UNPAID }),
      store.sum({ status: UNPAID, due_date: { gte: utcToday, lt: inAWeek } }),
      this.db.invoices.countWhere({ status: UNPAID, due_date: { lt: utcToday } }),
      store.sum({ status: 'Paid' }),
      store.sum({ status: 'Paid', paid_at: { gte: thisMonth } }),
      this.db.invoices.findWhere({ status: 'Paid', paid_at: { gte: since } }),
      this.db.clients.countWhere({}),
      this.db.clients.countWhere({ status: 'Active' }),
    ]);

    const appointments_chart = lastMonths(today.slice(0, 7), 12);
    for (const row of appointmentRows) {
      const bucket = appointments_chart.find((b) => b.month === studioParts(new Date(row.starts_at)).date.slice(0, 7));
      if (bucket) bucket.value += 1;
    }
    const revenue_chart = lastMonths(today.slice(0, 7), 12);
    for (const bucket of revenue_chart) {
      bucket.value = sumMoney(
        paidRows.filter((row) => studioParts(new Date(row.paid_at!)).date.startsWith(bucket.month)).map((row) => row.amount),
      );
    }

    return {
      appointments: {
        today: appointmentsToday,
        upcoming: appointmentsUpcoming,
        next: nextAppointment && {
          id: nextAppointment.id,
          reference: nextAppointment.reference,
          name: nextAppointment.name,
          service_label: nextAppointment.service_label,
          starts_at: nextAppointment.starts_at,
        },
      },
      projects,
      enquiries: { total: enquiriesTotal, new: enquiriesNew, since_yesterday: enquiriesRecent },
      invoices: {
        outstanding_total: outstanding.toNumber(),
        due_this_week_total: dueThisWeek.toNumber(),
        overdue_count: overdue,
        paid_total: paid.toNumber(),
        paid_this_month: paidThisMonth.toNumber(),
      },
      clients: { total: clientsTotal, active: clientsActive },
      appointments_chart,
      revenue_chart,
    };
  }

  /** Designer/Installer: the projects they are assigned to and what is open on them. Nothing financial. */
  async designer(principal: AuthPrincipal) {
    const scope = this.access.projectScope(principal);
    const done = doneStage(await loadStages(this.db));
    const [projects, open] = await Promise.all([
      this.projectCounts(scope),
      this.db.projects.findWhere({ ...scope, status: { not: done } }, { orderBy: { updated_at: 'desc' }, take: 10 }),
    ]);
    const clients = await this.db.clients.findWhere({ id: { in: [...new Set(open.map((p) => p.client_id))] } });
    const names = new Map(clients.map((client) => [client.id, client.name]));
    return {
      projects,
      tasks: open.map((project) => ({
        id: project.id,
        name: project.name,
        type: project.type,
        client_name: names.get(project.client_id) ?? 'Unknown client',
        status: project.status,
        progress_pct: project.progress_pct,
        current_stage: project.current_stage,
        // What they are on it for, since one person can be both.
        roles: [
          project.assigned_designer_id === principal.id ? 'Designer' : null,
          project.assigned_installer_id === principal.id ? 'Installer' : null,
        ].filter((role) => role !== null),
        updated_at: project.updated_at,
      })),
    };
  }

  /** A client: only their own, only what has been shared, never a Draft invoice. */
  async portal(principal: AuthPrincipal) {
    const mine = { client_id: principal.id };
    const nowIso = new Date().toISOString();
    const store = this.db.invoiceStore;
    const client = await this.db.clients.findById(principal.id);
    const stages = await loadStages(this.db);
    const done = doneStage(stages);
    const approval = approvalStages(stages);

    const [projects, documents, paid, outstanding, nextDue, appointment] = await Promise.all([
      this.db.projects.findWhere({ ...mine, client_visible: true }, { orderBy: { updated_at: 'desc' } }),
      this.access.documentScope(principal).then((scope) => this.db.documents.countWhere(scope)),
      store.sum({ ...mine, status: 'Paid' }),
      store.sum({ ...mine, status: UNPAID }),
      this.db.invoices.findFirstWhere({ ...mine, status: { notIn: ['Draft', 'Paid'] } }, { due_date: 'asc' }),
      // A consultation booked on the website is theirs when it carries their email.
      client
        ? this.db.appointments.findFirstWhere(
            { email: { equals: client.email, mode: 'insensitive' }, status: 'Confirmed', starts_at: { gte: nowIso } },
            { starts_at: 'asc' },
          )
        : Promise.resolve(null),
    ]);

    return {
      next_appointment: appointment && {
        id: appointment.id,
        service_label: appointment.service_label,
        starts_at: appointment.starts_at,
      },
      documents_count: documents,
      invoices: {
        paid_total: paid.toNumber(),
        outstanding_total: outstanding.toNumber(),
        next_due: nextDue && {
          ...nextDue,
          is_overdue: lateMs(nextDue.due_date) > 0,
          days_overdue: Math.max(0, Math.floor(lateMs(nextDue.due_date) / DAY)),
        },
      },
      projects: {
        total: projects.length,
        active: projects.filter((project) => project.status !== done).length,
        /** The decision awaiting the client: the portal's most important tile. */
        awaiting_your_approval: projects
          .filter((project) => approval.includes(project.status))
          .map((project) => ({ id: project.id, name: project.name, type: project.type })),
      },
      /** Progress bars for the dashboard timeline widget. */
      timeline: projects.map((project) => ({
        id: project.id,
        name: project.name,
        type: project.type,
        status: project.status,
        progress_pct: project.progress_pct,
        current_stage: project.current_stage,
        updated_at: project.updated_at,
      })),
    };
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('admin')
  @Roles('Admin')
  admin() {
    return this.dashboard.admin();
  }

  @Get('designer')
  @Roles('Designer', 'Installer')
  designer(@CurrentUser() principal: AuthPrincipal) {
    return this.dashboard.designer(principal);
  }

  @Get('portal')
  @Roles('Client')
  portal(@CurrentUser() principal: AuthPrincipal) {
    return this.dashboard.portal(principal);
  }
}

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
