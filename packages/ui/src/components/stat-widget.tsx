import * as React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '../lib/utils';
import { DashboardCard, type DashboardCardProps } from './dashboard-card';

export interface StatWidgetTrend {
  /** e.g. 12 for "+12%" */
  value: number;
  direction: 'up' | 'down';
  /** Defaults to success for up / danger for down — override when "up" isn't good news (e.g. overdue invoices). */
  tone?: 'success' | 'danger';
  /** e.g. "vs last month" */
  label?: string;
}

export interface StatWidgetProps extends DashboardCardProps {
  trend?: StatWidgetTrend;
  /** A `<ChartContainer>` sparkline, rendered above the trend/bottom slot. */
  chart?: React.ReactNode;
}

/**
 * `DashboardCard` extended with a trend indicator and/or chart sparkline.
 *
 * Used by: apps/admin (bento dashboard — "Revenue this month" with a trend
 * + sparkline).
 * Variants: inherits `DashboardCard`'s `accent`/`priority`/`interactive`;
 * adds `trend` (delta arrow + %) and `chart` (a `ChartContainer` sparkline).
 * A11y: the trend arrow icon is decorative (`aria-hidden`) — the
 * direction/value is also stated as text, not conveyed by icon/colour alone.
 * Brief v6 deviations: none — new composition. Trend/chart are composed
 * through `DashboardCard`'s `bottom` slot (a `<div>`) rather than its
 * `context` slot (a `<p>`) — chart markup isn't valid inside a paragraph.
 */
function StatWidget({ trend, chart, bottom, ...cardProps }: StatWidgetProps) {
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : TrendingDown;
  const trendTone = trend?.tone ?? (trend?.direction === 'up' ? 'success' : 'danger');

  if (!trend && !chart) {
    return <DashboardCard {...cardProps} bottom={bottom} />;
  }

  return (
    <DashboardCard
      {...cardProps}
      bottom={
        <div className="flex flex-col gap-2">
          {trend ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[13px] font-semibold',
                trendTone === 'success' ? 'text-success' : 'text-destructive',
              )}
            >
              <TrendIcon className="size-3.5" aria-hidden="true" />
              {trend.direction === 'up' ? '+' : '-'}
              {Math.abs(trend.value)}%{trend.label ? <span className="font-normal text-muted-foreground"> {trend.label}</span> : null}
            </span>
          ) : null}
          {chart}
          {bottom}
        </div>
      }
    />
  );
}

export { StatWidget };
