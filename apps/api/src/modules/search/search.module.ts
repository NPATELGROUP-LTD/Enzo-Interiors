import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AccessService } from '../../common/access/access.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { AuthPrincipal } from '../../common/types/principal';
import { DatabaseService } from '../../data/database.service';
import { Where } from '../../data/prisma-repository';

export interface SearchResult {
  type: 'client' | 'project' | 'invoice' | 'enquiry' | 'booking';
  id: string;
  title: string;
  detail: string;
  /** An address inside the admin that opens this record. */
  link: string;
}

const PER_KIND = 5;
const ref = (prefix: string, n: number | undefined) => `${prefix}-${String(n ?? 0).padStart(4, '0')}`;

/**
 * The top search bar's records: a reference ("PRJ-0012", "ENQ-4", "EZ-7K3Q9P", "INV-0007") or a
 * small detail (a name, an email, a phone number, a postcode word) finds the record and its address,
 * so it opens directly. Scoped like everything else: an Admin searches all of it, a Designer or
 * Installer only their own clients and projects (AccessService), nobody else anything.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
  ) {}

  async search(principal: AuthPrincipal, query: string | undefined): Promise<{ results: SearchResult[] }> {
    const term = (typeof query === 'string' ? query : '').trim().slice(0, 60);
    if (term.length < 2) return { results: [] };
    const contains = <T>(...fields: string[]): Where<T> => ({ OR: fields.map((field) => ({ [field]: { contains: term, mode: 'insensitive' } })) }) as Where<T>;
    // Scope and search are both OR-shaped for a Designer, so they are ANDed rather than spread together.
    const both = <T>(scope: Where<T>, search: Where<T>): Where<T> => (Object.keys(scope).length ? ({ AND: [scope, search] } as unknown as Where<T>) : search);
    const number = (prefix: string) => {
      const found = term.match(new RegExp(`^${prefix}[-\\s]?0*(\\d{1,9})$`, 'i'));
      return found ? Number(found[1]) : null;
    };
    const admin = this.access.isAdmin(principal);

    const visible = await this.access.visibleClientIds(principal);
    const prj = number('prj');
    const enq = number('enq');

    const [clients, projects, invoices, enquiries, bookings] = await Promise.all([
      this.db.clients.findWhere(
        both(visible === 'all' ? {} : { id: { in: [...visible] } }, contains('name', 'email', 'phone', 'address')),
        { take: PER_KIND, orderBy: { name: 'asc' } },
      ),
      this.db.projects.findWhere(
        both(this.access.projectScope(principal), { OR: [{ name: { contains: term, mode: 'insensitive' } }, ...(prj ? [{ ref_no: prj }] : [])] }),
        { take: PER_KIND, orderBy: { updated_at: 'desc' } },
      ),
      admin ? this.db.invoices.findWhere(contains('number'), { take: PER_KIND, orderBy: { created_at: 'desc' } }) : [],
      admin
        ? this.db.contactSubmissions.findWhere(
            { OR: [{ name: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } }, { phone: { contains: term, mode: 'insensitive' } }, ...(enq ? [{ ref_no: enq }] : [])] },
            { take: PER_KIND, orderBy: { created_at: 'desc' } },
          )
        : [],
      admin ? this.db.appointments.findWhere(contains('reference', 'name', 'email', 'phone'), { take: PER_KIND, orderBy: { starts_at: 'desc' } }) : [],
    ]);

    const names = new Map(
      (await this.db.clients.findWhere({ id: { in: [...new Set([...projects, ...invoices].map((row) => row.client_id))] } })).map((client) => [client.id, client.name]),
    );
    const results: SearchResult[] = [
      ...clients.map((client) => ({ type: 'client' as const, id: client.id, title: client.name, detail: [client.email, client.phone].filter(Boolean).join(' · '), link: `/clients/${client.id}` })),
      ...projects.map((project) => ({ type: 'project' as const, id: project.id, title: `${ref('PRJ', project.ref_no)} · ${project.name}`, detail: `${names.get(project.client_id) ?? ''} · ${project.current_stage ?? project.status}`, link: `/projects/${project.id}` })),
      ...invoices.map((invoice) => ({ type: 'invoice' as const, id: invoice.id, title: invoice.number, detail: `${names.get(invoice.client_id) ?? ''} · ${invoice.status}`, link: `/invoices?open=${invoice.id}` })),
      ...enquiries.map((row) => ({ type: 'enquiry' as const, id: row.id, title: `${ref('ENQ', row.ref_no)} · ${row.name}`, detail: `${row.email} · ${row.status}`, link: `/enquiries?id=${row.id}` })),
      ...bookings.map((row) => ({ type: 'booking' as const, id: row.id, title: `${row.reference} · ${row.name}`, detail: `${row.service_label} · ${row.status}`, link: `/bookings?open=${row.id}` })),
    ];
    return { results };
  }
}

@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  /** Names the roles that have records to search; an Editor's search is the CMS's own (`/cms/search`). */
  @Get()
  @Roles('Admin', 'Designer', 'Installer')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  find(@CurrentUser() principal: AuthPrincipal, @Query('q') q?: string) {
    return this.search.search(principal, q);
  }
}

@Module({ controllers: [SearchController], providers: [SearchService] })
export class SearchModule {}
