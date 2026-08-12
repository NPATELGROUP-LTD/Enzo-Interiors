import * as React from 'react';

import { cn } from '../lib/utils';

type AccentTone = 'tint' | 'success' | 'warning' | 'danger' | 'neutral';

const accentToneClass: Record<AccentTone, string> = {
  tint: 'before:bg-accent',
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
  /** 3px left accent rail colour. Ignored when `priority` is true (rail is always primary green then). Defaults to the light tint — most cards on a dashboard are not the priority card. */
  accent?: AccentTone;
  /** Marks the single most important card on a dashboard: full-green rail, larger padding/min-height. The consuming grid is responsible for spanning it 2 rows (this component doesn't know its grid context). At most one per dashboard. */
  priority?: boolean;
  /** Only set true for a fully interactive card (Brief v6: non-clickable cards never animate) */
  interactive?: boolean;
}

/**
 * "Improved Dashboard Card" — bento-grid metric tile.
 *
 * Used by: apps/admin (Dashboard bento grid), apps/portal (Dashboard summary
 * cards). Composed by `StatWidget` for chart-augmented variants.
 * Variants: `accent` (tint/success/warning/danger/neutral rail colour),
 * `priority` (the one featured card per dashboard — full-green rail, larger
 * footprint), `interactive` (only for cards that are themselves clickable).
 * A11y: non-interactive cards never animate on hover — `interactive` gates
 * all transform/shadow classes. A card containing a `<TextLink>` bottom
 * slot is NOT fully clickable; only that link is the action (don't also
 * set `interactive` in that case).
 * Brief v6 deviations: none — eyebrow/metric/context/bottom/rail anatomy,
 * default-tint-vs-priority-full-green rail logic, and exact metric tracking
 * (-0.045em) / context size (13px) / padding (18px default, 24px priority)
 * all match docs/Enzo_Interiors_UI_UX_Visual_Brief_v6.html's rendered
 * mockup, which is more precise here than the markdown brief.
 */
function DashboardCard({
  eyebrow,
  metric,
  context,
  bottom,
  accent = 'tint',
  priority = false,
  interactive = false,
  className,
  ...props
}: DashboardCardProps) {
  return (
    <div
      data-slot="dashboard-card"
      data-priority={priority || undefined}
      className={cn(
        'relative flex flex-col gap-2 rounded-xl border bg-card before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-l-xl',
        priority ? 'before:bg-primary min-h-[354px] p-6 pl-7' : 'min-h-[170px] p-[18px] pl-[22px]',
        !priority && accentToneClass[accent],
        interactive &&
          '[transition:transform_160ms_ease,border-color_160ms_ease,box-shadow_160ms_ease] hover:-translate-y-0.5 hover:border-primary hover:shadow-raised',
        className,
      )}
      {...props}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {eyebrow}
      </span>
      <span className="text-[38px] font-bold leading-none tracking-[-0.045em] text-primary">
        {metric}
      </span>
      {context ? <p className="line-clamp-2 max-w-[260px] text-[13px] text-muted-foreground">{context}</p> : null}
      {bottom ? <div className="mt-auto pt-[18px]">{bottom}</div> : null}
    </div>
  );
}

export { DashboardCard };
