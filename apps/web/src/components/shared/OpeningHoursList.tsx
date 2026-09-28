import type { HoursRow } from "@/lib/content";

/**
 * The studio's printed hours on a light ground, with any day's own note under
 * it and the shared note beneath the list — the contact page and the booking
 * form. The footer draws its own on the dark ground.
 */
export function OpeningHoursList({
  label,
  rows,
  note,
  className,
}: {
  label: string;
  rows: readonly HoursRow[];
  note: string;
  className?: string;
}) {
  if (!rows.length) return null;
  return (
    <div className={className}>
      <p className="font-display text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <dl className="mt-3 divide-y divide-border/60">
        {rows.map((row) => (
          <div key={row.day} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2 text-[14px]">
            <dt className="text-primary">{row.day}</dt>
            <dd className="tabular-nums text-muted-foreground">{row.time}</dd>
            {row.note ? <dd className="basis-full text-[12.5px] text-enzo-forest-light">{row.note}</dd> : null}
          </div>
        ))}
      </dl>
      {note ? <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{note}</p> : null}
    </div>
  );
}
