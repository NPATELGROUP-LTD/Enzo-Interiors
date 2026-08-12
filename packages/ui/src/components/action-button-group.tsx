import * as React from 'react';
import { RotateCcw, Check } from 'lucide-react';

import { Button } from './button';

export interface ActionButtonGroupProps {
  onApprove: () => void;
  onDecline: () => void;
  approveLabel?: string;
  declineLabel?: string;
  /** Which action is mid-flight, if any — shows a loading spinner on that button only. */
  pending?: 'approve' | 'decline' | null;
  className?: string;
}

/**
 * Paired approve/decline actions with equal visual weight.
 *
 * Used by: apps/portal (design approval — "Approve design" / "Request
 * changes"), apps/admin (quote accept/decline on the client's behalf,
 * rare).
 * Variants: none — both buttons are always `variant="secondary"`. This is
 * the whole point: the brief requires "Approve design" and "Request
 * changes" to read as equally understandable outcomes, not a primary/
 * destructive pair where one option visually dominates.
 * A11y: only the icon differs by meaning (check vs. undo) — both labels
 * are always visible text, never icon-only.
 * Brief v6 deviations: none — new composition enforcing the brief's
 * "Project Journeys > Client Portal" approval requirement.
 */
function ActionButtonGroup({
  onApprove,
  onDecline,
  approveLabel = 'Approve design',
  declineLabel = 'Request changes',
  pending,
  className,
}: ActionButtonGroupProps) {
  return (
    <div data-slot="action-button-group" className={className} style={{ display: 'flex', gap: 12 }}>
      <Button variant="secondary" onClick={onDecline} loading={pending === 'decline'} disabled={pending === 'approve'}>
        <RotateCcw />
        {declineLabel}
      </Button>
      <Button variant="secondary" onClick={onApprove} loading={pending === 'approve'} disabled={pending === 'decline'}>
        <Check />
        {approveLabel}
      </Button>
    </div>
  );
}

export { ActionButtonGroup };
