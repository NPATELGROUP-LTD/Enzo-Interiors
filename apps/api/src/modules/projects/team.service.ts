import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';

import { AccessService } from '../../common/access/access.service';
import { InstallerAssignment, Project, ProjectMember } from '../../common/types/domain';
import { AuthPrincipal } from '../../common/types/principal';
import { ActivityLogService } from '../../core/activity-log.service';
import { DatabaseService } from '../../data/database.service';
import { NotificationsService } from '../notifications/notifications.module';
import { AddMemberDto, ApproveDatesDto, InstallationDto, PayDecisionDto, SuggestDatesDto, SuggestionDecisionDto } from './team.dto';

/**
 * An installer's dates, pay and approvals. This is the ONLY shape pay is ever
 * serialised in, built by `termsView` from an explicit list of fields, and
 * `TeamService.view` hands it to the Admin and to that installer (once sent)
 * and to nobody else.
 */
export interface AssignmentView {
  start_date: string | null;
  end_date: string | null;
  sent_at: string | null;
  pay: number | null;
  pay_note: string | null;
  pay_status: InstallerAssignment['pay_status'];
  dates_status: InstallerAssignment['dates_status'];
  suggested_start: string | null;
  suggested_end: string | null;
  suggestion_comment: string | null;
  suggested_at: string | null;
}

export interface TeamMemberView {
  id: string;
  staff_id: string;
  name: string;
  role: ProjectMember['role'];
  /** Present only for an installer, and only to the Admin or that installer. */
  assignment?: AssignmentView;
}

/** The repository hands back timestamps; a calendar day is its first ten characters. */
const day = (value: string | null): string | null => (value ? value.slice(0, 10) : null);

/** `2026-02-31` is not a day. */
function toDay(value: string): string {
  if (new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('That is not a real date.');
  }
  return value;
}

const nice = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const EMPTY: Omit<InstallerAssignment, 'id' | 'member_id' | 'updated_at'> = {
  start_date: null,
  end_date: null,
  sent_at: null,
  pay: null,
  pay_note: null,
  pay_status: 'pending',
  dates_status: 'pending',
  suggested_start: null,
  suggested_end: null,
  suggestion_comment: null,
  suggested_at: null,
};

const NO_SUGGESTION = { suggested_start: null, suggested_end: null, suggestion_comment: null, suggested_at: null } as const;

/** Allow-list: a column added to installer_assignments reaches nobody until it is named here. */
function termsView(row: Partial<InstallerAssignment> | undefined): AssignmentView {
  const a = { ...EMPTY, ...row };
  return {
    start_date: day(a.start_date),
    end_date: day(a.end_date),
    sent_at: a.sent_at,
    pay: a.pay,
    pay_note: a.pay_note,
    pay_status: a.pay_status,
    dates_status: a.dates_status,
    suggested_start: day(a.suggested_start),
    suggested_end: day(a.suggested_end),
    suggestion_comment: a.suggestion_comment,
    suggested_at: a.suggested_at,
  };
}

/**
 * Who works on a project, and the installers' dates and pay.
 *
 * Membership grants the project (AccessService.projectScope). The old
 * projects.assigned_designer_id / assigned_installer_id still grant it too, and
 * every write here first copies them into project_members (`members`) and ends by
 * mirroring the first designer / installer back (`syncLegacy`), so neither can
 * drop or resurrect someone, and the previous release keeps working on this data.
 *
 * Pay: visible to the Admin and to that installer only, and only after the
 * Admin has sent the assignment. Designers' views never even load it. Nothing
 * here writes an amount to a notification, an email or the activity log.
 */
@Injectable()
export class TeamService {
  constructor(
    private readonly db: DatabaseService,
    private readonly access: AccessService,
    private readonly activity: ActivityLogService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Reads                                                               */
  /* ------------------------------------------------------------------ */

  /** The team as `principal` may see it: names and roles for staff, plus terms for the Admin and the installer themself. */
  async view(principal: AuthPrincipal, project: Project): Promise<TeamMemberView[]> {
    if (this.access.isClient(principal)) return [];
    const members = await this.members(project);
    const termsReader = this.access.isAdmin(principal) || principal.role === 'Installer';
    const [staff, assignments] = await Promise.all([
      this.db.staffUsers.findWhere({ id: { in: members.map((member) => member.staff_id) } }),
      termsReader
        ? this.db.installerAssignments.findWhere({ member_id: { in: members.filter((m) => m.role === 'Installer').map((m) => m.id) } })
        : Promise.resolve([]),
    ]);
    const names = new Map(staff.map((person) => [person.id, person.name]));
    const terms = new Map(assignments.map((row) => [row.member_id, row]));

    return members
      .map((member) => {
        const row = terms.get(member.id);
        const base = { id: member.id, staff_id: member.staff_id, name: names.get(member.staff_id) ?? 'Former colleague', role: member.role };
        if (member.role !== 'Installer') return base;
        if (this.access.isAdmin(principal)) return { ...base, assignment: termsView(row) };
        const own = member.staff_id === principal.id && Boolean(row?.sent_at);
        return own ? { ...base, assignment: termsView(row) } : base;
      })
      .sort((a, b) => Number(a.role === 'Installer') - Number(b.role === 'Installer'));
  }

  /** For the project list: each project's designers' and installers' names, joined. No writes, no pay. */
  async names(projects: Project[]): Promise<Map<string, { designer: string | null; installer: string | null }>> {
    const members = await this.db.projectMembers.findWhere(
      { project_id: { in: projects.map((project) => project.id) } },
      { orderBy: { created_at: 'asc' } },
    );
    type Seat = { staff_id: string; role: string };
    const byProject = new Map<string, Seat[]>();
    const staffIds = new Set<string>();
    for (const project of projects) {
      const seats: Seat[] = members.filter((member) => member.project_id === project.id);
      // The legacy columns count until the backfill has copied them.
      for (const [role, id] of [['Designer', project.assigned_designer_id], ['Installer', project.assigned_installer_id]] as const) {
        if (id && !seats.some((seat) => seat.staff_id === id && seat.role === role)) seats.push({ staff_id: id, role });
      }
      seats.forEach((seat) => staffIds.add(seat.staff_id));
      byProject.set(project.id, seats);
    }
    const staff = await this.db.staffUsers.findWhere({ id: { in: [...staffIds] } });
    const names = new Map(staff.map((person) => [person.id, person.name]));
    const join = (seats: Seat[], role: string) =>
      [...new Set(seats.filter((seat) => seat.role === role).map((seat) => names.get(seat.staff_id)))].filter(Boolean).join(', ') || null;
    return new Map(
      projects.map((project) => {
        const seats = byProject.get(project.id)!;
        return [project.id, { designer: join(seats, 'Designer'), installer: join(seats, 'Installer') }];
      }),
    );
  }

  /** Activity on this project's installers' terms (the Admin's project page). Never holds an amount. */
  termsActivity(memberIds: string[]) {
    return this.db.activityLogs.findWhere({ target_table: 'project_members', target_id: { in: memberIds } }, { orderBy: { created_at: 'desc' } });
  }

  /* ------------------------------------------------------------------ */
  /* Admin writes                                                        */
  /* ------------------------------------------------------------------ */

  async add(principal: AuthPrincipal, projectId: string, dto: AddMemberDto): Promise<TeamMemberView[]> {
    const project = await this.access.requireProject(principal, projectId);
    const staff = await this.db.staffUsers.findById(dto.staff_id);
    if (!staff || staff.role !== dto.role) throw new BadRequestException(`Choose someone with the ${dto.role} role.`);
    const already = new ConflictException(`${staff.name} is already a ${dto.role.toLowerCase()} on this project.`);
    if ((await this.members(project)).some((member) => member.staff_id === staff.id && member.role === dto.role)) throw already;
    try {
      await this.db.projectMembers.create({
        project_id: projectId,
        staff_id: staff.id,
        role: dto.role,
        added_by: principal.id,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      // Two clicks at once: the unique index decides.
      throw (error as { code?: string }).code === 'P2002' ? already : error;
    }
    await this.syncLegacy(project);
    await this.activity.record({
      principal,
      action: 'project_team_add',
      targetTable: 'projects',
      targetId: projectId,
      details: { staff: staff.name, role: dto.role },
    });
    await this.notifications.notify(staff.id, {
      kind: 'project',
      title: `You're on ${project.name}`,
      body: `${principal.name} added you as ${dto.role === 'Designer' ? 'a designer' : 'an installer'}.`,
      link: `/projects/${project.id}`,
    });
    return this.view(principal, project);
  }

  async remove(principal: AuthPrincipal, projectId: string, memberId: string): Promise<TeamMemberView[]> {
    const project = await this.access.requireProject(principal, projectId);
    await this.members(project);
    const member = await this.db.projectMembers.findFirstWhere({ id: memberId, project_id: projectId });
    if (!member) throw new NotFoundException('Team member not found');
    const staff = await this.db.staffUsers.findById(member.staff_id);
    await this.db.projectMembers.delete(member.id); // its installer terms go with it (foreign key)
    await this.syncLegacy(project);
    await this.activity.record({
      principal,
      action: 'project_team_remove',
      targetTable: 'projects',
      targetId: projectId,
      details: { staff: staff?.name ?? null, role: member.role },
    });
    return this.view(principal, project);
  }

  /** Dates and pay for one installer. A change after the assignment was sent resets what they approved and tells them. */
  async setTerms(principal: AuthPrincipal, projectId: string, memberId: string, dto: InstallationDto): Promise<TeamMemberView[]> {
    const { project, member } = await this.installerMember(principal, projectId, memberId);
    const current = await this.assignment(member.id, true);
    const incoming = (value: string | null | undefined, now: string | null) => (value === undefined ? now : value === null ? null : toDay(value));
    const start = incoming(dto.start_date, current.start_date);
    const end = incoming(dto.end_date, current.end_date);
    const pay = dto.pay === undefined ? current.pay : dto.pay;
    const note = dto.pay_note === undefined ? current.pay_note : dto.pay_note?.trim() || null;

    if (start && end && end < start) throw new BadRequestException('The end date is before the start date.');
    if (current.sent_at && (!start || !end)) throw new BadRequestException('Dates already sent cannot be cleared; change them instead.');
    const datesChanged = start !== current.start_date || end !== current.end_date;
    const payChanged = pay !== current.pay || note !== current.pay_note;
    if (!datesChanged && !payChanged) return this.view(principal, project);

    await this.db.installerAssignments.update(current.id, {
      start_date: start,
      end_date: end,
      pay,
      pay_note: note,
      ...(datesChanged && { dates_status: 'pending' as const, ...NO_SUGGESTION }),
      ...(payChanged && { pay_status: 'pending' as const }),
      updated_at: new Date().toISOString(),
    });
    const changed = [datesChanged && 'dates', payChanged && 'pay'].filter(Boolean) as string[];
    await this.record(principal, 'installer_terms_update', member, project, { changed });
    // Before it is sent the installer sees none of this, so there is nobody to tell.
    if (current.sent_at) {
      await this.notifications.notifyByEmail(member.staff_id, {
        kind: 'project',
        title: `Your installation ${changed.join(' and ')} for ${project.name} changed`,
        body: `${datesChanged && start && end ? `New dates: ${nice(start)} to ${nice(end)}. ` : ''}Please review and approve again.`,
        link: `/projects/${project.id}`,
      });
    }
    return this.view(principal, project);
  }

  /** "Send to installer": from now on they see their dates and pay, and are told by bell, push and email. */
  async send(principal: AuthPrincipal, projectId: string, memberId: string): Promise<TeamMemberView[]> {
    const { project, member } = await this.installerMember(principal, projectId, memberId);
    const current = await this.assignment(member.id, true);
    if (!current.start_date || !current.end_date) throw new BadRequestException('Set the start and end dates first.');
    const now = new Date().toISOString();
    // One conditional UPDATE, so a double click cannot tell them twice.
    if (!(await this.db.installerAssignments.updateWhere({ id: current.id, sent_at: null }, { sent_at: now, updated_at: now }))) {
      throw new ConflictException('This was already sent to the installer.');
    }
    await this.record(principal, 'installer_terms_send', member, project);
    await this.notifications.notifyByEmail(member.staff_id, {
      kind: 'project',
      title: `Installation dates for ${project.name}`,
      body: `${nice(current.start_date)} to ${nice(current.end_date)}.${current.pay === null ? '' : ' Your pay is ready to review too.'} Open the project to approve, or suggest other dates.`,
      link: `/projects/${project.id}`,
    });
    return this.view(principal, project);
  }

  /** The Admin answers the installer's suggested dates: accepting makes them the dates (and the installer's approval). */
  async decideSuggestion(principal: AuthPrincipal, projectId: string, memberId: string, dto: SuggestionDecisionDto): Promise<TeamMemberView[]> {
    const { project, member } = await this.installerMember(principal, projectId, memberId);
    const current = await this.assignment(member.id, true);
    if (!current.suggested_start || !current.suggested_end || !current.suggested_at) {
      throw new ConflictException('There is no suggestion to answer.');
    }
    const accept = dto.decision === 'accept';
    const claimed = await this.db.installerAssignments.updateWhere(
      { id: current.id, suggested_at: current.suggested_at },
      {
        ...(accept && { start_date: current.suggested_start, end_date: current.suggested_end, dates_status: 'approved' as const }),
        ...NO_SUGGESTION,
        updated_at: new Date().toISOString(),
      },
    );
    if (!claimed) throw new ConflictException('The suggestion changed; look again.');
    await this.record(principal, accept ? 'installer_dates_accept' : 'installer_dates_decline', member, project);
    await this.notifications.notifyByEmail(member.staff_id, {
      kind: 'project',
      title: `Your suggested dates for ${project.name} were ${accept ? 'accepted' : 'declined'}`,
      body: [accept ? `Installation is ${nice(current.suggested_start)} to ${nice(current.suggested_end)}.` : null, dto.note?.trim()].filter(Boolean).join(' ') || undefined,
      link: `/projects/${project.id}`,
    });
    return this.view(principal, project);
  }

  /* ------------------------------------------------------------------ */
  /* The installer's own answers                                         */
  /* ------------------------------------------------------------------ */

  async decidePay(principal: AuthPrincipal, projectId: string, memberId: string, dto: PayDecisionDto): Promise<TeamMemberView[]> {
    const { project, member, current } = await this.own(principal, projectId, memberId);
    if (current.pay === null) throw new BadRequestException('No pay has been set for this job.');
    if (current.pay !== dto.pay) throw new ConflictException('The pay changed while you were looking. Reload and check it again.');
    await this.db.installerAssignments.update(current.id, { pay_status: dto.decision, updated_at: new Date().toISOString() });
    await this.record(principal, `installer_pay_${dto.decision}`, member, project);
    await this.notifications.notifyAdminsByEmail({
      kind: 'project',
      title: `${principal.name} ${dto.decision} the pay for ${project.name}`,
      link: `/projects/${project.id}`,
    });
    return this.view(principal, project);
  }

  /** Approves the dates as they stand, independently of the pay. Withdraws a suggestion of their own. */
  async approveDates(principal: AuthPrincipal, projectId: string, memberId: string, dto: ApproveDatesDto): Promise<TeamMemberView[]> {
    const { project, member, current } = await this.own(principal, projectId, memberId);
    if (dto.start_date !== current.start_date || dto.end_date !== current.end_date) {
      throw new ConflictException('The dates changed while you were looking. Reload and check them again.');
    }
    await this.db.installerAssignments.update(current.id, { dates_status: 'approved', ...NO_SUGGESTION, updated_at: new Date().toISOString() });
    await this.record(principal, 'installer_dates_approve', member, project);
    await this.notifications.notifyAdminsByEmail({
      kind: 'project',
      title: `${principal.name} approved the installation dates for ${project.name}`,
      body: `${nice(current.start_date!)} to ${nice(current.end_date!)}.`,
      link: `/projects/${project.id}`,
    });
    return this.view(principal, project);
  }

  async suggestDates(principal: AuthPrincipal, projectId: string, memberId: string, dto: SuggestDatesDto): Promise<TeamMemberView[]> {
    const { project, member, current } = await this.own(principal, projectId, memberId);
    const start = toDay(dto.start_date);
    const end = toDay(dto.end_date);
    const comment = dto.comment.trim();
    if (!comment) throw new BadRequestException('Say why these dates suit you better.');
    if (end < start) throw new BadRequestException('The end date is before the start date.');
    if (start === current.start_date && end === current.end_date) throw new BadRequestException('Those are the dates already set; approve them instead.');
    await this.db.installerAssignments.update(current.id, {
      suggested_start: start,
      suggested_end: end,
      suggestion_comment: comment,
      suggested_at: new Date().toISOString(),
      dates_status: 'pending',
      updated_at: new Date().toISOString(),
    });
    await this.record(principal, 'installer_dates_suggest', member, project);
    await this.notifications.notifyAdminsByEmail({
      kind: 'project',
      title: `${principal.name} suggests other dates for ${project.name}`,
      body: `${nice(start)} to ${nice(end)}: ${comment}`,
      link: `/projects/${project.id}`,
    });
    return this.view(principal, project);
  }

  /* ------------------------------------------------------------------ */

  /**
   * The project's members, oldest first, after copying in anyone only the
   * legacy columns name (a lazy `npm run team:backfill` for this project).
   */
  private async members(project: Project): Promise<ProjectMember[]> {
    const load = () => this.db.projectMembers.findWhere({ project_id: project.id }, { orderBy: { created_at: 'asc' } });
    const rows = await load();
    const missing = ([['Designer', project.assigned_designer_id], ['Installer', project.assigned_installer_id]] as const).some(
      ([role, id]) => id && !rows.some((member) => member.staff_id === id && member.role === role),
    );
    return missing && (await this.db.teamStore.backfill(project.id)) > 0 ? load() : rows;
  }

  /** Keep the legacy columns on the first designer / installer, so the previous release still sees someone. */
  private async syncLegacy(project: Project): Promise<void> {
    const rows = await this.db.projectMembers.findWhere({ project_id: project.id }, { orderBy: { created_at: 'asc' } });
    const first = (role: string) => rows.find((member) => member.role === role)?.staff_id ?? null;
    await this.db.projects.update(project.id, { assigned_designer_id: first('Designer'), assigned_installer_id: first('Installer') });
  }

  /** Admin routes: the project, and an installer member of it. */
  private async installerMember(principal: AuthPrincipal, projectId: string, memberId: string) {
    const project = await this.access.requireProject(principal, projectId);
    await this.members(project);
    const member = await this.db.projectMembers.findFirstWhere({ id: memberId, project_id: projectId });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.role !== 'Installer') throw new BadRequestException('Only an installer has dates and pay.');
    return { project, member };
  }

  /** The installer's routes: their own membership, and only once the Admin has sent it. Anything else is a 404. */
  private async own(principal: AuthPrincipal, projectId: string, memberId: string) {
    const project = await this.access.requireProject(principal, projectId);
    await this.members(project);
    const member = await this.db.projectMembers.findFirstWhere({ id: memberId, project_id: projectId, staff_id: principal.id, role: 'Installer' });
    const current = member && (await this.assignment(member.id));
    if (!member || !current?.sent_at) throw new NotFoundException('Team member not found');
    return { project, member, current };
  }

  /** The installer's terms row with calendar days trimmed; `create` makes the empty one the first edit needs. */
  private async assignment(memberId: string, create: true): Promise<InstallerAssignment>;
  private async assignment(memberId: string): Promise<InstallerAssignment | null>;
  private async assignment(memberId: string, create = false): Promise<InstallerAssignment | null> {
    // ponytail: two first edits at once would hit the unique member_id and 500 one of them; Admin-only, so not guarded.
    let row = await this.db.installerAssignments.findFirstWhere({ member_id: memberId });
    if (!row && create) {
      row = await this.db.installerAssignments.create({ ...EMPTY, member_id: memberId, updated_at: new Date().toISOString() });
    }
    return row && { ...row, start_date: day(row.start_date), end_date: day(row.end_date), suggested_start: day(row.suggested_start), suggested_end: day(row.suggested_end) };
  }

  /** Audit entry under the member row, not the project: designers read the project's activity. No amounts, ever. */
  private async record(principal: AuthPrincipal, action: string, member: ProjectMember, project: Project, extra: Record<string, unknown> = {}) {
    const installer = await this.db.staffUsers.findById(member.staff_id);
    await this.activity.record({
      principal,
      action,
      targetTable: 'project_members',
      targetId: member.id,
      details: { project_id: project.id, project: project.name, installer: installer?.name ?? null, ...extra },
    });
  }
}
