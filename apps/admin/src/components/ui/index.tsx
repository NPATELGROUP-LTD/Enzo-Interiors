import clsx from 'clsx';
import { AlertCircle, Check, ChevronDown, Loader2, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/**
 * The admin design system.
 *
 * Built directly from docs/Enzo_Interiors_UI_UX_Brief_v6.md, which calls itself
 * a strict implementation contract. The rules it enforces here:
 *   - 44px minimum control height and touch target
 *   - 8px corners on controls, 12px on cards/tiles/modals
 *   - No fully rounded/pill buttons anywhere
 *   - Status tags are written labels only — no dots or bullet markers
 *   - Text links never gain a background, box, shadow or movement on hover
 *   - 1px borders preferred over shadows; one permitted overlay shadow
 *   - No gradients, glows, floating shapes or decorative icons
 *
 * apps/portal has its own copy of this file. Per the build brief the two are
 * kept consistent by following the same document, not by sharing code.
 */

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ReactNode;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-green-900 text-on-primary hover:bg-green-800 border border-green-900 hover:border-green-800',
  secondary:
    'bg-secondary text-green-900 border border-green-900/25 hover:bg-secondary-hover hover:border-green-900/50',
  // Destructive is a surface with danger text/border until hovered, per the
  // brief's button table — it is used only behind a confirmation.
  destructive: 'bg-surface text-danger border border-danger/40 hover:bg-danger-bg hover:border-danger',
  ghost: 'bg-transparent text-ink border border-transparent hover:bg-surface-muted',
};

export function Button({
  variant = 'secondary',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        // 44px min height and 8px corners — never a pill.
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-sm font-semibold',
        'transition-colors duration-[160ms]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

interface CardProps {
  children: ReactNode;
  className?: string;
  /** A 3px semantic left rail, per the brief's card anatomy. */
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'none';
  /**
   * Fully interactive cards may shift 2px and take a border change. A card
   * containing its own action link is NOT fully clickable — the brief is
   * explicit that the text link is then the only action.
   */
  interactive?: boolean;
}

const ACCENT_RAIL: Record<NonNullable<CardProps['accent']>, string> = {
  primary: 'before:bg-green-900',
  success: 'before:bg-success',
  warning: 'before:bg-warning',
  danger: 'before:bg-danger',
  none: '',
};

export function Card({ children, className, accent = 'none', interactive = false }: CardProps) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-card border border-border bg-surface p-4',
        accent !== 'none' &&
          `before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-[''] ${ACCENT_RAIL[accent]}`,
        interactive &&
          'cursor-pointer transition-[border-color,transform] duration-[160ms] hover:-translate-y-0.5 hover:border-green-900 hover:shadow-overlay',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Eyebrow + metric + context + bottom slot — the brief's card anatomy. */
export function MetricCard({
  eyebrow,
  value,
  context,
  bottom,
  accent = 'primary',
}: {
  eyebrow: string;
  value: ReactNode;
  context?: ReactNode;
  bottom?: ReactNode;
  accent?: CardProps['accent'];
}) {
  return (
    <Card accent={accent} className="flex h-full flex-col pl-5">
      <p className="label-eyebrow">{eyebrow}</p>
      <p className="tabular mt-2 text-[38px] font-bold leading-none tracking-tight text-green-900">
        {value}
      </p>
      {context ? (
        // Max two lines, per the brief's content rules.
        <p className="mt-2 line-clamp-2 text-ink-muted">{context}</p>
      ) : null}
      {bottom ? <div className="mt-auto pt-3">{bottom}</div> : null}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Status tag — written labels only, never dots                                */
/* -------------------------------------------------------------------------- */

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const STATUS_TONES: Record<StatusTone, string> = {
  neutral: 'bg-surface-muted text-ink-muted border-border',
  success: 'bg-success-bg text-success border-success/30',
  warning: 'bg-warning-bg text-warning border-warning/30',
  danger: 'bg-danger-bg text-danger border-danger/30',
  info: 'bg-green-100 text-green-900 border-green-900/25',
};

export function StatusTag({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-control border px-2 py-1 text-xs font-semibold',
        STATUS_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */

const FIELD_BASE =
  'w-full min-h-11 rounded-control border border-border bg-surface px-3 text-ink placeholder:text-ink-muted/70 ' +
  'transition-colors duration-[160ms] focus:border-green-900 disabled:opacity-60';

interface FieldWrapProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

/** Label + control + hint/error, wired up with the right aria attributes. */
export function Field({ label, error, hint, required, children }: FieldWrapProps) {
  const id = useId();
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children(id, messageId)}
      {error ? (
        <p id={messageId} className="flex items-center gap-1.5 text-xs font-medium text-danger">
          <AlertCircle size={13} aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  label,
  error,
  hint,
  required,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(id, describedBy) => (
        <input
          {...rest}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={clsx(FIELD_BASE, error && 'border-danger', rest.className)}
        />
      )}
    </Field>
  );
}

export function Textarea({
  label,
  error,
  hint,
  required,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(id, describedBy) => (
        <textarea
          {...rest}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={clsx(FIELD_BASE, 'min-h-24 resize-y py-2 leading-relaxed', error && 'border-danger', rest.className)}
        />
      )}
    </Field>
  );
}

export function Select({
  label,
  error,
  hint,
  required,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; hint?: string }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(id, describedBy) => (
        <div className="relative">
          <select
            {...rest}
            id={id}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={clsx(FIELD_BASE, 'appearance-none pr-9', error && 'border-danger', rest.className)}
          >
            {children}
          </select>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
        </div>
      )}
    </Field>
  );
}

/** Accessible switch. 44px target, no pill on the control itself. */
export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="flex-1">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-6 w-11 shrink-0 rounded-control border transition-colors duration-[160ms] disabled:opacity-50',
          checked ? 'border-green-900 bg-green-900' : 'border-border bg-surface-muted',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-4 w-4 rounded-[3px] transition-[left] duration-[160ms]',
            checked ? 'left-[1.65rem] bg-on-primary' : 'left-0.5 bg-ink-muted',
          )}
        />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Escape closes, and the body cannot scroll behind the overlay.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog so the keyboard is not left behind it.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4">
      {/* Click-outside to dismiss. Not a focusable control — Escape and the
          explicit close button are the keyboard paths. */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx(
          'relative max-h-[92vh] w-full overflow-y-auto rounded-t-card border border-border bg-surface shadow-overlay sm:rounded-card',
          width === 'sm' && 'sm:max-w-md',
          width === 'md' && 'sm:max-w-2xl',
          width === 'lg' && 'sm:max-w-4xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description ? <p className="mt-1 text-ink-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-2 flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted hover:text-ink"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border bg-surface-muted/50 p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Confirmation for destructive actions. The brief and the PRD's reliability
 * requirement both call for these before any delete.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  pending,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-ink">{message}</div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* State placeholders — every list screen needs all three                      */
/* -------------------------------------------------------------------------- */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-muted" role="status">
      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Table-shaped shimmer, so a loading list does not collapse the layout. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="animate-pulse p-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 border-b border-border py-3 last:border-0">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <div
              key={columnIndex}
              className="h-4 flex-1 rounded-[4px] bg-surface-muted"
              style={{ maxWidth: columnIndex === 0 ? '30%' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="max-w-md text-ink-muted">{message}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center" role="alert">
      <AlertCircle size={22} className="text-danger" aria-hidden="true" />
      <p className="max-w-md text-ink">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout helpers                                                             */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/**
 * Horizontal scroll container for tables.
 *
 * Wide tables scroll inside their own box so the page body never scrolls
 * sideways, which is what keeps the 375px breakpoint usable.
 */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[44rem] border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={clsx(
        'label-eyebrow whitespace-nowrap border-b border-border bg-surface-muted px-3 py-2.5',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={clsx('border-b border-border px-3 py-3 align-middle', className)}>{children}</td>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={clsx(
              'min-h-11 whitespace-nowrap border-b-2 px-3 text-sm font-semibold transition-colors duration-[160ms]',
              selected
                ? 'border-green-900 text-green-900'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="tabular ml-1.5 text-xs text-ink-muted">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Progress bar. Semantic, not decorative — it carries the project's progress. */
export function Progress({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
        className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-surface-muted"
      >
        <div className="h-full bg-green-900" style={{ width: `${clamped}%` }} />
      </div>
      <span className="tabular w-9 shrink-0 text-right text-xs text-ink-muted">{clamped}%</span>
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-2.5">
      <span
        className={clsx(
          'flex h-5 w-5 items-center justify-center rounded-[4px] border transition-colors',
          checked ? 'border-green-900 bg-green-900' : 'border-border bg-surface',
        )}
      >
        {checked ? <Check size={13} className="text-on-primary" aria-hidden="true" /> : null}
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span className="text-sm text-ink">{label}</span>
    </label>
  );
}
