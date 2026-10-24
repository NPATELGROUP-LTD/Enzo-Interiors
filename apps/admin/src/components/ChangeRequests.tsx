import { useState } from 'react';

import { Button, Card } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { useQuery } from '@/hooks/useApi';
import { ApiError, api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import type { ChangeRequest } from '@/types/api';

const FIELD: Record<string, string> = { phone: 'Phone', address: 'Address', notes: 'Notes', status: 'Stage' };

/**
 * Pending change requests on one client or project (modules/change-requests).
 * An Admin approves or declines them here; whoever asked sees theirs waiting.
 * Nothing renders when none are pending. Remount (key) to re-read after asking.
 */
export function ChangeRequests({
  clientId,
  projectId,
  onDecided,
}: {
  clientId?: string;
  projectId?: string;
  onDecided?: () => void;
}) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, refetch } = useQuery<ChangeRequest[]>(
    `/change-requests?status=Pending&${projectId ? `project_id=${projectId}` : `client_id=${clientId}`}`,
  );
  // The client page shows its own details asks; stage asks live on their project.
  const rows = (data ?? []).filter((row) => projectId || row.kind === 'client_details');
  if (!rows.length) return null;

  const decide = async (row: ChangeRequest, approve: boolean) => {
    setBusy(row.id);
    try {
      await api.post(`/change-requests/${row.id}/${approve ? 'approve' : 'decline'}`, {});
      toast.success(approve ? 'Approved and applied.' : 'Declined.');
      await refetch();
      onDecided?.();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : 'Could not decide this request.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-4 flex flex-col gap-3">
      {rows.map((row) => (
        <Card key={row.id} accent="warning" className="pl-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">
                {isAdmin ? `${row.requested_name} asks for a change` : 'Waiting for an Admin to approve'}
                <span className="ml-2 text-xs font-normal text-ink-muted">{dateTime(row.created_at)}</span>
              </p>
              <dl className="mt-2 grid gap-1 text-sm">
                {Object.entries(row.payload).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <dt className="w-16 shrink-0 text-ink-muted">{FIELD[key] ?? key}</dt>
                    <dd className="min-w-0 whitespace-pre-wrap break-words text-ink">{value || '(cleared)'}</dd>
                  </div>
                ))}
              </dl>
              {row.note ? <p className="mt-2 text-sm text-ink-muted">“{row.note}”</p> : null}
            </div>
            {isAdmin ? (
              <div className="flex gap-2">
                <Button variant="secondary" disabled={busy !== null} onClick={() => void decide(row, false)}>
                  Decline
                </Button>
                <Button loading={busy === row.id} disabled={busy !== null} onClick={() => void decide(row, true)}>
                  Approve
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
