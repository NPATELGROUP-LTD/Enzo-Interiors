import * as React from 'react';

import { cn } from '../lib/utils';

type AccentTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const accentToneClass: Record<AccentTone, string> = {
  primary: 'before:bg-primary',
  success: 'before:bg-success',
  warning: 'before:bg-warning',
  danger: 'before:bg-destructive',
  neutral: 'before:bg-border',
};

export interface DashboardCardProps extends React.ComponentProps<'div'> {
  /** 11px uppercase muted label, e.g. "ACTIVE PROJECTS" */
  eyebrow: React.ReactNode;
  /** 38px/700 primary metric, e.g. "24" */
  metric: React.ReactNode;
  /** One short supporting sentence, max two lines */
  context?: React.ReactNode;
  /** Status tag (<Badge>) or <TextLink>, aligned to the bottom */
  bottom?: React.ReactNode;
  /** 3px left accent rail colour per Brief v6 card anatomy */
  accent?: AccentTone;
  /** Only set true for a fully interactive card (Brief v6: non-clickable cards never animate) */
  interactive?: boolean;
}

/**
 * "Improved Dashboard Card" per Brief v6 §Improved Dashboard Cards: eyebrow
 * label, primary metric, one-line context, bottom status/link slot, and a
 * 3px accent rail — hierarchy through content order, not decoration.
 */
function DashboardCard({
  eyebrow,
  metric,
  context,
  bottom,
  accent = 'primary',
  interactive = false,
  className,
  ...props
}: DashboardCardProps) {
  return (
    <div
      data-slot="dashboard-card"
      className={cn(
        "relative flex flex-col gap-2 rounded-xl border bg-card p-6 pl-7 before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-l-xl",
        accentToneClass[accent],
        interactive &&
          'transition-[transform,border-color,box-shadow] duration-[160ms] hover:-translate-y-0.5 hover:border-primary hover:shadow-sm',
        className,
      )}
      {...props}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {eyebrow}
      </span>
      <span className="text-[38px] font-bold leading-none tracking-tight text-primary">{metric}</span>
      {context ? <p className="line-clamp-2 text-sm text-muted-foreground">{context}</p> : null}
      {bottom ? <div className="mt-auto pt-2">{bottom}</div> : null}
    </div>
  );
}

export { DashboardCard };
