import { Controller, Get, Injectable, Module } from '@nestjs/common';

import { AccessService } from '../../common/access/access.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { money, sum } from '../../common/util/money';
import { DatabaseService } from '../../data/database.service';

/**
 * Dashboard aggregates.
 *
 * ADDITION beyond the documented endpoint table, deliberately. The bento
 * dashboards in both apps need counts and sums across eight tables; composing
 * them in the frontend would mean eight list requests per dashboard load, each
 * pulling far more data than the tile displays, and would put business
 * arithmetic (what counts as overdue, what counts as unread) in two frontends
 * instead of one API. Everything here is derived from data the caller could
 * already read through the documented endpoints, and the same RBAC scoping
 * applies, so this adds convenience rather than reach.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
  ) {}

  /** The admin bento: bookings, active projects, enquiries, invoices, messages, chart. */
  async admin(principal: AuthPrincipal) {
    const [
      allProjects,
      allInvoices,
      allBookings,
      allConversations,
      allMessages,
      submissions,
      clients,
      quotes,
    ] = await Promise.all([
      this.db.projects.findAll(),
      this.db.invoices.findAll(),
      this.db.bookings.findAll(),
      this.db.conversations.findAll(),
      this.db.messages.findAll(),
      this.db.contactSubmissions.findAll(),
      this.db.clients.findAll(),
      this.db.quotes.findAll(),
    ]);

    const scope = <T>(rows: T[], clientIdOf: (row: T) => string) =>
      this.access.scopeToVisibleClients(principal, rows, clientIdOf);

    const [projects, invoices, bookings, conversations, scopedClients, scopedQuotes] =
      await Promise.all([
        scope(allProjects, (r) => r.client_id),
        scope(allInvoices, (r) => r.client_id),
        scope(allBookings, (r) => r.client_id),
        scope(allConversations, (r) => r.client_id),
        scope(clients, (r) => r.id),
        scope(quotes, (r) => r.client_id),
      ]);

    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const nowIso = now.toISOString();

    const conversationIds = new Set(conversations.map((c) => c.id));
    // Unread for staff means unread messages sent BY clients.
    const unreadMessages = allMessages.filter(
      (message) =>
        conversationIds.has(message.conversation_id) &&
        message.sender_type === 'Client' &&
        message.read_at === null,
    );

    const unpaid = invoices.filter(
      (invoice) => invoice.status === 'Outstanding' || invoice.status === 'Overdue',
    );
    const overdue = unpaid.filter(
      (invoice) => new Date(`${invoice.due_date}T23:59:59.999Z`).getTime() < now.getTime(),
    );
    const dueThisWeek = unpaid.filter((invoice) => {
      const due = new Date(`${invoice.due_date}T23:59:59.999Z`).getTime();
      return due >= now.getTime() && due <= now.getTime() + 7 * 86_400_000;
    });

    // The dashboard tile names the client, so the raw booking row is not
    // enough on its own — decorate it the same way BookingsService would.
    const clientNames = new Map(clients.map((client) => [client.id, client]));
    const nextBooking =
      bookings
        .filter((booking) => booking.date_time >= nowIso && booking.status !== 'Cancelled')
        .sort((a, b) => a.date_time.localeCompare(b.date_time))[0] ?? null;
    const decoratedNext = nextBooking
      ? {
          ...nextBooking,
          client_name: clientNames.get(nextBooking.client_id)?.name ?? 'Unknown client',
          client_email: clientNames.get(nextBooking.client_id)?.email ?? '',
        }
      : null;

    return {
      bookings: {
        today: bookings.filter(
          (booking) => booking.date_time.slice(0, 10) === todayKey && booking.status !== 'Cancelled',
        ).length,
        upcoming: bookings.filter(
          (booking) => booking.date_time >= nowIso && booking.status !== 'Cancelled',
        ).length,
        awaiting_confirmation: bookings.filter(
          (booking) => booking.status === 'Pending' && booking.date_time >= nowIso,
        ).length,
        next: decoratedNext,
      },
      projects: {
        active: projects.filter((project) => project.status !== 'Completed').length,
        completed: projects.filter((project) => project.status === 'Completed').length,
        awaiting_decision: projects.filter((project) => project.status === 'Approval').length,
        by_stage: {
          Consultation: projects.filter((p) => p.status === 'Consultation').length,
          Design: projects.filter((p) => p.status === 'Design').length,
          Approval: projects.filter((p) => p.status === 'Approval').length,
          Installation: projects.filter((p) => p.status === 'Installation').length,
          Completed: projects.filter((p) => p.status === 'Completed').length,
        },
      },
      enquiries: {
        // Contact submissions are not client-scoped — they are leads with no
        // client record yet, so every staff member sees the same inbox.
        total: submissions.length,
        new: submissions.filter((submission) => submission.status === 'New').length,
        since_yesterday: submissions.filter(
          (submission) =>
            new Date(submission.created_at).getTime() > now.getTime() - 86_400_000,
        ).length,
      },
      invoices: {
        outstanding_total: sum(unpaid.map((invoice) => invoice.amount)),
        due_this_week_total: sum(dueThisWeek.map((invoice) => invoice.amount)),
        overdue_count: overdue.length,
        paid_total: sum(
          invoices.filter((invoice) => invoice.status === 'Paid').map((invoice) => invoice.amount),
        ),
      },
      messages: {
        unread: unreadMessages.length,
        conversations_needing_reply: new Set(
          unreadMessages.map((message) => message.conversation_id),
        ).size,
      },
      clients: {
        total: scopedClients.length,
        active: scopedClients.filter((client) => client.status === 'Active').length,
      },
      quotes: {
        draft: scopedQuotes.filter((quote) => quote.status === 'Draft').length,
        sent: scopedQuotes.filter((quote) => quote.status === 'Sent').length,
        accepted_awaiting_invoice: scopedQuotes.filter(
          (quote) => quote.status === 'Accepted' && quote.invoice_id === null,
        ).length,
      },
      /** Monthly bookings chart — the trailing 12 months, oldest first. */
      bookings_chart: this.monthlySeries(bookings.map((booking) => booking.date_time), 12),
      /** Monthly revenue from invoices actually marked Paid. */
      revenue_chart: this.monthlyRevenue(
        invoices
          .filter((invoice) => invoice.status === 'Paid' && invoice.paid_at)
          .map((invoice) => ({ at: invoice.paid_at!, amount: invoice.amount })),
        12,
      ),
    };
  }

  /** The portal bento: next appointment, unread, documents, invoices, timeline. */
  async portal(principal: AuthPrincipal) {
    const clientId = principal.id;
    const [projects, invoices, bookings, documents, conversations, messages, quotes] =
      await Promise.all([
        this.db.projects.findAll((row) => row.client_id === clientId && row.client_visible),
        this.db.invoices.findAll((row) => row.client_id === clientId),
        this.db.bookings.findAll((row) => row.client_id === clientId),
        this.db.documents.findAll((row) => row.client_id === clientId && row.client_visible),
        this.db.conversations.findAll((row) => row.client_id === clientId),
        this.db.messages.findAll(),
        this.db.quotes.findAll((row) => row.client_id === clientId),
      ]);

    const nowIso = new Date().toISOString();
    const conversationIds = new Set(conversations.map((c) => c.id));
    // Unread for a client means unread messages sent BY staff.
    const unread = messages.filter(
      (message) =>
        conversationIds.has(message.conversation_id) &&
        message.sender_type === 'Staff' &&
        message.read_at === null,
    );

    const unpaid = invoices.filter(
      (invoice) => invoice.status === 'Outstanding' || invoice.status === 'Overdue',
    );
    const nextInvoice = invoices
      .filter((invoice) => invoice.status !== 'Paid' && invoice.status !== 'Draft')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

    const client = await this.db.clients.findById(clientId);
    const nextAppointment =
      bookings
        .filter((booking) => booking.date_time >= nowIso && booking.status !== 'Cancelled')
        .sort((a, b) => a.date_time.localeCompare(b.date_time))[0] ?? null;

    return {
      next_appointment: nextAppointment
        ? {
            ...nextAppointment,
            client_name: client?.name ?? 'Unknown client',
            client_email: client?.email ?? '',
          }
        : null,
      unread_messages: unread.length,
      documents_count: documents.length,
      invoices: {
        paid_total: sum(
          invoices.filter((invoice) => invoice.status === 'Paid').map((invoice) => invoice.amount),
        ),
        outstanding_total: sum(unpaid.map((invoice) => invoice.amount)),
        next_due: nextInvoice ?? null,
      },
      projects: {
        total: projects.length,
        active: projects.filter((project) => project.status !== 'Completed').length,
        /** The decision awaiting the client — the portal's most important tile. */
        awaiting_your_approval: projects
          .filter((project) => project.status === 'Approval')
          .map((project) => ({ id: project.id, name: project.name, type: project.type })),
      },
      quotes: {
        awaiting_your_decision: quotes.filter((quote) => quote.status === 'Sent').length,
      },
      /** Progress bars for the dashboard timeline widget. */
      timeline: projects
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((project) => ({
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

  /** Count per month for the trailing `months` months, oldest first. */
  private monthlySeries(timestamps: string[], months: number) {
    const buckets = this.emptyBuckets(months);
    for (const timestamp of timestamps) {
      const key = timestamp.slice(0, 7);
      const bucket = buckets.find((entry) => entry.month === key);
      if (bucket) bucket.value += 1;
    }
    return buckets;
  }

  private monthlyRevenue(entries: Array<{ at: string; amount: number }>, months: number) {
    const buckets = this.emptyBuckets(months);
    for (const entry of entries) {
      const bucket = buckets.find((b) => b.month === entry.at.slice(0, 7));
      if (bucket) bucket.value = money(bucket.value + entry.amount);
    }
    return buckets;
  }

  private emptyBuckets(months: number): Array<{ month: string; label: string; value: number }> {
    const buckets: Array<{ month: string; label: string; value: number }> = [];
    const cursor = new Date();
    cursor.setDate(1);
    for (let i = months - 1; i >= 0; i -= 1) {
      const date = new Date(cursor);
      date.setMonth(date.getMonth() - i);
      buckets.push({
        month: date.toISOString().slice(0, 7),
        label: date.toLocaleString('en-GB', { month: 'short' }),
        value: 0,
      });
    }
    return buckets;
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('admin')
  @Roles('Admin', 'Designer', 'Installer')
  admin(@CurrentUser() principal: AuthPrincipal) {
    return this.dashboard.admin(principal);
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
