import { Plus, X } from '@phosphor-icons/react';
import { useState, type FormEvent } from 'react';

import { Button, Card, Input, Select, StatusTag, Textarea, type StatusTone } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { ApiError, api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import type { InstallerAssignment, TeamMember } from '@/types/api';

import type { StaffOption } from '@/pages/Projects';

/** `2026-12-03` -> 3 Dec 2026, without letting the viewer's time zone move the day. */
const day = (value: string | null): string =>
  value ? new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
const span = (a: { start_date: string | null; end_date: string | null }) => `${day(a.start_date)} to ${day(a.end_date)}`;

const TONE: Record<string, StatusTone> = { pending: 'warning', approved: 'success', declined: 'danger' };

/** Runs one team request and hands the new team up; the toast says what went wrong. */
function useTeamAction(projectId: string, onChange: (team: TeamMember[]) => void) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, request: () => Promise<TeamMember[]>, done?: string): Promise<boolean> => {
    setBusy(key);
    try {
      onChange(await request());
      if (done) toast.success(done);
      return true;
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not save that.');
      return false;
    } finally {
      setBusy(null);
    }
  };
  const base = `/projects/${projectId}/team`;
  return { busy, run, base };
}

/**
 * Who works on the project. The Admin adds and removes designers and installers
 * and sets each installer's dates and pay and when to send them; a designer or
 * another installer sees names only; an installer sees their own assignment once
 * it is sent, and approves or answers it here. The API decides who gets what:
 * this only draws the `assignment` it was given.
 */
export function ProjectTeam({
  projectId,
  team,
  staff,
  onChange,
}: {
  projectId: string;
  team: TeamMember[];
  /** The Admin's pick-list: Settings › Users cut down to Designers and Installers. */
  staff: StaffOption[];
  onChange: (team: TeamMember[]) => void;
}) {
  const { isAdmin, user } = useAuth();
  const own = team.find((member) => member.staff_id === user?.id && member.assignment);

  return (
    <div className="mb-5 flex flex-col gap-4">
      {own?.assignment ? <MyAssignment member={own} assignment={own.assignment} projectId={projectId} onChange={onChange} /> : null}

      <Card>
        <p className="label-eyebrow">Team</p>
        {isAdmin ? (
          <div className="mt-3 grid gap-x-6 gap-y-5 lg:grid-cols-2">
            <Side role="Designer" label="Designers" team={team} staff={staff} projectId={projectId} onChange={onChange} />
            <Side role="Installer" label="Installers" team={team} staff={staff} projectId={projectId} onChange={onChange} />
          </div>
        ) : team.length === 0 ? (
          <p className="py-4 text-center text-ink-muted">Nobody is on this project yet.</p>
        ) : (
          <ul className="mt-3 rows">
            {team.map((member) => (
              <li key={member.id} className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <span className="font-medium text-ink">{member.name}</span>
                <span className="text-ink-muted">{member.role}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** One side of the Admin's panel: the people in a role, an add control, and (installers) their terms. */
function Side({
  role,
  label,
  team,
  staff,
  projectId,
  onChange,
}: {
  role: 'Designer' | 'Installer';
  label: string;
  team: TeamMember[];
  staff: StaffOption[];
  projectId: string;
  onChange: (team: TeamMember[]) => void;
}) {
  const { busy, run, base } = useTeamAction(projectId, onChange);
  const [pick, setPick] = useState('');
  const members = team.filter((member) => member.role === role);
  const free = staff.filter((person) => person.role === role && !members.some((member) => member.staff_id === person.id));
  const noun = role.toLowerCase();

  return (
    <section aria-label={label} className="flex min-w-0 flex-col gap-3">
      <p className="text-sm font-semibold text-ink">{label}</p>
      {members.length === 0 ? <p className="text-ink-muted">No {noun}s yet.</p> : null}
      {role === 'Designer' ? (
        <ul className="rows">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="font-medium text-ink">{member.name}</span>
              <Button
                variant="ghost"
                aria-label={`Remove ${member.name}`}
                icon={<X size={14} aria-hidden="true" />}
                loading={busy === member.id}
                onClick={() => void run(member.id, () => api.delete<TeamMember[]>(`${base}/${member.id}`), `${member.name} removed.`)}
              />
            </li>
          ))}
        </ul>
      ) : (
        members.map((member) => (
          <InstallerTerms
            key={`${member.id}:${JSON.stringify(member.assignment)}`}
            member={member}
            projectId={projectId}
            onChange={onChange}
          />
        ))
      )}
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto]">
        <Select label={`Add ${role === 'Designer' ? 'a' : 'an'} ${noun}`} value={pick} onChange={(event) => setPick(event.target.value)}>
          <option value="">{free.length ? 'Choose someone…' : `No other ${noun}s`}</option>
          {free.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          icon={<Plus size={15} aria-hidden="true" />}
          disabled={!pick}
          loading={busy === 'add'}
          onClick={async () => {
            if (await run('add', () => api.post<TeamMember[]>(base, { staff_id: pick, role }), 'Added.')) setPick('');
          }}
        >
          Add
        </Button>
      </div>
    </section>
  );
}

/** The Admin's controls for one installer: dates, pay, send, and what they have answered. */
function InstallerTerms({ member, projectId, onChange }: { member: TeamMember; projectId: string; onChange: (team: TeamMember[]) => void }) {
  const { busy, run, base } = useTeamAction(projectId, onChange);
  const a: InstallerAssignment = member.assignment ?? {
    start_date: null, end_date: null, sent_at: null, pay: null, pay_note: null, pay_status: 'pending',
    dates_status: 'pending', suggested_start: null, suggested_end: null, suggestion_comment: null, suggested_at: null,
  };
  const [form, setForm] = useState({ start: a.start_date ?? '', end: a.end_date ?? '', pay: a.pay === null ? '' : String(a.pay), note: a.pay_note ?? '' });
  const changed = form.start !== (a.start_date ?? '') || form.end !== (a.end_date ?? '') || form.pay !== (a.pay === null ? '' : String(a.pay)) || form.note !== (a.pay_note ?? '');
  const terms = `${base}/${member.id}`;

  const save = (event: FormEvent) => {
    event.preventDefault();
    void run(
      'save',
      () =>
        api.put<TeamMember[]>(`${terms}/installation`, {
          start_date: form.start || null,
          end_date: form.end || null,
          pay: form.pay === '' ? null : Number(form.pay),
          pay_note: form.note.trim() || null,
        }),
      a.sent_at ? 'Saved. The installer has been told.' : 'Saved.',
    );
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3 rounded-card bg-surface-muted p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-ink">{member.name}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {a.sent_at ? (
            <>
              <StatusTag tone={TONE[a.dates_status]}>Dates {a.dates_status}</StatusTag>
              {a.pay !== null ? <StatusTag tone={TONE[a.pay_status]}>Pay {a.pay_status}</StatusTag> : null}
            </>
          ) : (
            <StatusTag>Not sent</StatusTag>
          )}
          <Button
            type="button"
            variant="ghost"
            aria-label={`Remove ${member.name}`}
            icon={<X size={14} aria-hidden="true" />}
            loading={busy === 'remove'}
            onClick={() => void run('remove', () => api.delete<TeamMember[]>(terms), `${member.name} removed.`)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Start" type="date" value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} />
        <Input label="End" type="date" value={form.end} min={form.start || undefined} onChange={(event) => setForm({ ...form, end: event.target.value })} />
        <Input
          label="Pay (£)"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={form.pay}
          hint="Only you and this installer can see it."
          onChange={(event) => setForm({ ...form, pay: event.target.value })}
        />
        <Input label="Pay note" maxLength={500} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
      </div>

      {a.suggested_start && a.suggested_end ? (
        <Card accent="warning" className="p-3">
          <p className="font-semibold text-ink">
            Suggests {span({ start_date: a.suggested_start, end_date: a.suggested_end })}
          </p>
          {a.suggestion_comment ? <p className="mt-1 text-ink-muted">“{a.suggestion_comment}”</p> : null}
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              loading={busy === 'accept'}
              onClick={() => void run('accept', () => api.post<TeamMember[]>(`${terms}/suggestion`, { decision: 'accept' }), 'Dates updated.')}
            >
              Accept
            </Button>
            <Button
              type="button"
              variant="secondary"
              loading={busy === 'decline'}
              onClick={() => void run('decline', () => api.post<TeamMember[]>(`${terms}/suggestion`, { decision: 'decline' }), 'Suggestion declined.')}
            >
              Decline
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="secondary" loading={busy === 'save'} disabled={!changed}>
          Save
        </Button>
        {a.sent_at ? (
          <p className="text-xs text-ink-muted">Sent to {member.name}. Saving a change tells them and asks again.</p>
        ) : (
          <Button
            type="button"
            loading={busy === 'send'}
            disabled={changed || !a.start_date || !a.end_date}
            onClick={() => void run('send', () => api.post<TeamMember[]>(`${terms}/send`, {}), `Sent to ${member.name}.`)}
          >
            Send to installer
          </Button>
        )}
      </div>
      {!a.sent_at ? (
        <p className="text-xs text-ink-muted">{member.name} sees nothing until you send it. Save first, then send.</p>
      ) : null}
    </form>
  );
}

/** The installer's own card: their dates and pay, approved or answered separately. */
function MyAssignment({
  member,
  assignment: a,
  projectId,
  onChange,
}: {
  member: TeamMember;
  assignment: InstallerAssignment;
  projectId: string;
  onChange: (team: TeamMember[]) => void;
}) {
  const { busy, run, base } = useTeamAction(projectId, onChange);
  const [suggesting, setSuggesting] = useState(false);
  const [form, setForm] = useState({ start: a.start_date ?? '', end: a.end_date ?? '', comment: '' });
  const mine = `${base}/${member.id}`;

  const suggest = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await run(
      'suggest',
      () => api.post<TeamMember[]>(`${mine}/dates/suggest`, { start_date: form.start, end_date: form.end, comment: form.comment.trim() }),
      'Sent to the Admin.',
    );
    if (ok) setSuggesting(false);
  };

  return (
    <Card accent="primary">
      <p className="label-eyebrow">Your installation</p>
      <dl className="mt-3 rows">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-ink-muted">Dates</dt>
          <dd className="flex flex-wrap items-center justify-end gap-2 text-right font-medium text-ink">
            {span(a)}
            <StatusTag tone={TONE[a.dates_status]}>{a.dates_status === 'approved' ? 'You approved' : 'Not approved yet'}</StatusTag>
          </dd>
        </div>
        {a.pay !== null ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-muted">Your pay</dt>
            <dd className="flex flex-wrap items-center justify-end gap-2 text-right font-medium text-ink">
              <span className="tabular">{money(a.pay)}</span>
              <StatusTag tone={TONE[a.pay_status]}>{a.pay_status === 'pending' ? 'Not answered yet' : a.pay_status === 'approved' ? 'You approved' : 'You declined'}</StatusTag>
            </dd>
          </div>
        ) : null}
        {a.pay_note ? (
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">Pay note</dt>
            <dd className="text-right text-ink">{a.pay_note}</dd>
          </div>
        ) : null}
      </dl>

      {a.suggested_start && a.suggested_end ? (
        <p className="mt-3 rounded-control bg-warning-bg px-3 py-2 text-warning">
          You suggested {span({ start_date: a.suggested_start, end_date: a.suggested_end })}. Waiting for the Admin.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {a.dates_status !== 'approved' ? (
          <Button loading={busy === 'dates'} onClick={() => void run('dates', () => api.post<TeamMember[]>(`${mine}/dates/approve`, { start_date: a.start_date, end_date: a.end_date }), 'Dates approved.')}>
            Approve dates
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => setSuggesting((open) => !open)} aria-expanded={suggesting}>
          Suggest other dates
        </Button>
        {a.pay !== null && a.pay_status !== 'approved' ? (
          <Button loading={busy === 'approved'} onClick={() => void run('approved', () => api.post<TeamMember[]>(`${mine}/pay`, { decision: 'approved', pay: a.pay }), 'Pay approved.')}>
            Approve pay
          </Button>
        ) : null}
        {a.pay !== null && a.pay_status !== 'declined' ? (
          <Button variant="destructive" loading={busy === 'declined'} onClick={() => void run('declined', () => api.post<TeamMember[]>(`${mine}/pay`, { decision: 'declined', pay: a.pay }), 'Pay declined.')}>
            Decline pay
          </Button>
        ) : null}
      </div>

      {suggesting ? (
        <form onSubmit={suggest} className="mt-4 flex flex-col gap-3 rounded-card bg-surface-muted p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Start" type="date" required value={form.start} onChange={(event) => setForm({ ...form, start: event.target.value })} />
            <Input label="End" type="date" required min={form.start || undefined} value={form.end} onChange={(event) => setForm({ ...form, end: event.target.value })} />
          </div>
          <Textarea
            label="Why these dates?"
            required
            rows={2}
            maxLength={1000}
            value={form.comment}
            onChange={(event) => setForm({ ...form, comment: event.target.value })}
          />
          <div className="flex gap-2">
            <Button type="submit" loading={busy === 'suggest'} disabled={!form.start || !form.end || !form.comment.trim()}>
              Send to the Admin
            </Button>
            <Button type="button" variant="ghost" onClick={() => setSuggesting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
