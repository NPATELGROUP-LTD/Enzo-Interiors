import * as React from 'react';
import { Check, CheckCheck } from 'lucide-react';

import { cn } from '../lib/utils';

export interface MessageBubbleProps {
  sender: 'self' | 'other';
  body: React.ReactNode;
  timestamp?: React.ReactNode;
  /** Read receipt — only meaningful for `sender="self"`. */
  read?: boolean;
  /** Rendered to the left of "other" messages, e.g. an `<Avatar>`. */
  avatar?: React.ReactNode;
  attachments?: React.ReactNode;
}

/**
 * Single chat message.
 *
 * Used by: `MessageThread` (this component is rarely used standalone).
 * Variants: `sender` (self/other) — self is right-aligned/primary-filled,
 * other is left-aligned/muted with an avatar slot.
 * A11y: read receipts use both an icon AND are announced via `aria-label`
 * ("Read"/"Sent") — not icon-only.
 * Brief v6 deviations: none — new composition, not ported.
 */
function MessageBubble({ sender, body, timestamp, read, avatar, attachments }: MessageBubbleProps) {
  const isSelf = sender === 'self';

  return (
    <div data-slot="message-bubble" className={cn('flex items-end gap-2', isSelf ? 'flex-row-reverse' : 'flex-row')}>
      {!isSelf ? <div className="shrink-0">{avatar}</div> : null}
      <div className={cn('flex max-w-[75%] flex-col gap-1', isSelf ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-xl px-3 py-2 text-sm',
            isSelf ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm',
          )}
        >
          {body}
        </div>
        {attachments}
        {timestamp ? (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {timestamp}
            {isSelf ? (
              read ? (
                <CheckCheck className="size-3.5 text-primary" aria-label="Read" />
              ) : (
                <Check className="size-3.5" aria-label="Sent" />
              )
            ) : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export { MessageBubble };
