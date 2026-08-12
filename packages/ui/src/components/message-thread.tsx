import * as React from 'react';

import { cn } from '../lib/utils';
import { MessageBubble, type MessageBubbleProps } from './message-bubble';

export interface MessageThreadItem extends MessageBubbleProps {
  id: string | number;
  /** Renders a centered date divider above this message, e.g. "Today", "12 Aug". */
  dateDivider?: React.ReactNode;
}

export interface MessageThreadProps extends React.ComponentProps<'div'> {
  items: MessageThreadItem[];
  /** Shows a typing indicator at the bottom of the thread. */
  typing?: boolean;
}

/**
 * Scrollable message list — auto-scrolls to the newest message.
 *
 * Used by: apps/portal and apps/admin Messages modules (WebSocket-driven —
 * this component just renders whatever list of messages the app's
 * real-time subscription hands it; it has no socket logic of its own).
 * Variants: none; date dividers via `items[].dateDivider`.
 * A11y: the scroll container has `aria-live="polite"` so new messages are
 * announced without interrupting the user; the typing indicator is
 * announced via its own `aria-label`.
 * Brief v6 deviations: none — new composition, not ported.
 */
function MessageThread({ items, typing, className, ...props }: MessageThreadProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [items.length, typing]);

  return (
    <div data-slot="message-thread" aria-live="polite" className={cn('flex flex-col gap-3 overflow-y-auto p-4', className)} {...props}>
      {items.map((item) => (
        <React.Fragment key={item.id}>
          {item.dateDivider ? (
            <div className="flex items-center gap-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {item.dateDivider}
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : null}
          <MessageBubble {...item} />
        </React.Fragment>
      ))}
      {typing ? (
        <div aria-label="Typing" className="flex items-center gap-1 pl-2 text-muted-foreground">
          <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
          <span className="size-1.5 animate-bounce rounded-full bg-current" />
        </div>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}

export { MessageThread };
