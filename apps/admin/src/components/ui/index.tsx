import clsx from 'clsx';
import {
  CaretDown,
  Check,
  CircleNotch,
  Eye,
  EyeSlash,
  WarningCircle,
  X,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyEvent,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';

/**
 * The admin design system.
 *
 * Built directly from docs/Enzo_Interiors_UI_UX_Brief_v6.md, which calls itself
 * a strict implementation contract, restyled for the macOS-style desktop shell
 * (see styles/theme.css). The rules it enforces here:
 *   - 44px minimum touch target; mouse users get compact 36px macOS controls
 *   - 8px corners on controls, 12px on cards/tiles, 14px on windows/sheets
 *   - No pill buttons; switches, tags and segmented controls are capsules
 *   - Status tags are written labels only — no dots or bullet markers
 *   - Text links never gain a background, box, shadow or movement on hover
 *   - No hairline grids: cards float on soft shadows, lists and tables use
 *     Finder-style striped rows, and tone (not rails or lines) carries meaning
 *   - No glows, floating shapes or decorative icons
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
  primary:
    'bg-green-900 text-on-primary hover:bg-green-800 border border-green-900 hover:border-green-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_2px_rgba(0,0,0,0.15)]',
  secondary:
    'bg-surface text-ink border border-border shadow-card hover:bg-secondary-hover hover:border-green-900/40',
  // Destructive is a surface with danger text/border until hovered, per the
  // brief's button table — it is used only behind a confirmation.
  destructive: 'bg-surface text-danger border border-danger/40 shadow-card hover:bg-danger-bg hover:border-danger',
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
        // 44px on touch, 36px with a mouse; 8px corners — never a pill.
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-3.5 text-sm font-semibold pointer-fine:min-h-9',
        'transition-colors duration-[160ms] active:brightness-95',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {loading ? (
        <CircleNotch size={16} className="animate-spin" aria-hidden="true" />
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
  /** Semantic tone, shown as a tinted surface rather than a left rail. */
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'none';
  /**
   * Fully interactive cards may shift 2px and take a border change. A card
   * containing its own action link is NOT fully clickable — the brief is
   * explicit that the text link is then the only action.
   */
  interactive?: boolean;
}

const ACCENT_TINT: Record<NonNullable<CardProps['accent']>, string> = {
  primary: 'bg-surface',
  success: 'bg-success-bg',
  warning: 'bg-warning-bg',
  danger: 'bg-danger-bg',
  none: 'bg-surface',
};

const TONE_TEXT: Record<NonNullable<CardProps['accent']>, string> = {
  primary: 'text-green-900',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  none: 'text-ink',
};

export function Card({ children, className, accent = 'none', interactive = false }: CardProps) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-card p-4 shadow-soft',
        ACCENT_TINT[accent],
        interactive &&
          'cursor-pointer transition-[box-shadow,transform] duration-[160ms] hover:-translate-y-0.5 hover:shadow-overlay',
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
    <Card accent={accent} className="flex h-full flex-col p-5">
      <p className="label-eyebrow">{eyebrow}</p>
      <p className={clsx('tabular mt-3 text-[40px] font-bold leading-none tracking-tight', TONE_TEXT[accent])}>
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
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
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

export const FIELD_BASE =
  'w-full min-h-11 rounded-[7px] border border-border bg-surface px-3 text-ink shadow-card placeholder:text-ink-muted/70 pointer-fine:min-h-9 ' +
  'transition-[border-color,box-shadow] duration-[160ms] focus:border-green-900 focus:ring-[3px] focus:ring-focus-ring/35 focus-visible:outline-none disabled:opacity-60';

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
          <WarningCircle size={13} aria-hidden="true" />
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
  const [shown, setShown] = useState(false);
  const isPassword = rest.type === 'password';
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {(id, describedBy) => {
        const input = (
          <input
            {...rest}
            type={isPassword && shown ? 'text' : rest.type}
            id={id}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={clsx(FIELD_BASE, error && 'border-danger', isPassword && 'pr-11', rest.className)}
          />
        );
        // Every password field in the app gets the eye: see what you typed.
        return isPassword ? (
          <div className="relative">
            {input}
            <button
              type="button"
              onClick={() => setShown((value) => !value)}
              aria-label={shown ? 'Hide password' : 'Show password'}
              aria-pressed={shown}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-[7px] text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35"
            >
              {shown ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        ) : (
          input
        );
      }}
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

interface Opt {
  value: string;
  label: ReactNode;
  text: string;
  disabled?: boolean;
}

function readOptions(children: ReactNode, out: Opt[] = []): Opt[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
    if (child.type === 'option') {
      const text = Children.toArray(props.children).join('');
      out.push({ value: String(props.value ?? text), label: props.children, text, disabled: props.disabled });
    } else if (props.children) readOptions(props.children, out); // fragments
  });
  return out;
}

/**
 * Themed replacement for a native <select>: same props, same
 * `onChange(event.target.value)` contract, but the list is ours (so it follows
 * light/dark, radius and brand green) and renders in a portal so modals and
 * scroll areas never clip it. Keys: Up/Down/Home/End/Enter/Space/Escape/type-ahead.
 */
export function Listbox({
  value,
  onChange,
  children,
  className,
  id,
  name,
  disabled,
  required,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  'aria-describedby': describedBy,
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value'> & { value?: string | number | readonly string[] }) {
  const options = readOptions(children);
  const current = String(value ?? '');
  const selected = options.findIndex((o) => o.value === current);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, up: false, max: 288 });
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const listId = useId();

  function show() {
    const r = button.current?.getBoundingClientRect();
    if (!r || disabled) return;
    const below = window.innerHeight - r.bottom - 8;
    const above = r.top - 8;
    const up = below < Math.min(options.length * 38 + 8, 220) && above > below;
    setBox({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, width: r.width, up, max: Math.min(288, up ? above : below) });
    setActive(Math.max(selected, 0));
    setOpen(true);
  }

  function pick(i: number) {
    const o = options[i];
    if (!o || o.disabled) return;
    setOpen(false);
    button.current?.focus();
    if (o.value !== current) {
      const target = { value: o.value, name: name ?? '' };
      onChange?.({ target, currentTarget: target } as unknown as ChangeEvent<HTMLSelectElement>);
    }
  }

  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => {
      const t = e.target as Node;
      if (!button.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    const close = (e: Event) => {
      if (!list.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function onKeyDown(e: ReactKeyEvent<HTMLButtonElement>) {
    const last = options.length - 1;
    const go = (i: number) => {
      e.preventDefault();
      if (!open) show();
      setActive(Math.max(0, Math.min(last, i)));
    };
    if (e.key === 'ArrowDown') go(open ? active + 1 : Math.max(selected, 0));
    else if (e.key === 'ArrowUp') go(open ? active - 1 : Math.max(selected, 0));
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(last);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) pick(active);
      else show();
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation(); // keep a surrounding modal open
      setOpen(false);
    } else if (e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const t = typed.current;
      t.text = Date.now() - t.at > 700 ? e.key.toLowerCase() : t.text + e.key.toLowerCase();
      t.at = Date.now();
      const hit = options.findIndex((o) => !o.disabled && o.text.toLowerCase().startsWith(t.text));
      if (hit >= 0) go(hit);
    }
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <button
        ref={button}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        aria-describedby={describedBy}
        aria-required={required}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={clsx(FIELD_BASE, 'relative flex items-center text-left', 'pr-9', className)}
      >
        <span className="min-w-0 flex-1 truncate">{options[selected]?.label ?? ' '}</span>
        <CaretDown
          size={16}
          aria-hidden="true"
          className={clsx('absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open
        ? createPortal(
            <ul
              ref={list}
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              style={{
                position: 'fixed',
                left: box.left,
                minWidth: box.width,
                maxHeight: box.max,
                ...(box.up ? { bottom: window.innerHeight - box.top } : { top: box.top }),
              }}
              className="z-[1000] max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain rounded-card border border-border bg-surface p-1 text-sm text-ink shadow-overlay"
            >
              {options.map((o, i) => (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={i === selected}
                  aria-disabled={o.disabled}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => pick(i)}
                  className={clsx(
                    'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[6px] px-2.5 pointer-fine:min-h-8',
                    i === active && 'bg-surface-muted',
                    i === selected && 'font-semibold text-green-900 dark:text-ink',
                    o.disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <span className="truncate">{o.label}</span>
                  {i === selected ? <Check size={14} weight="bold" aria-hidden="true" className="shrink-0 text-green-900 dark:text-ink" /> : null}
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </>
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
        <Listbox
          {...rest}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={clsx(error && 'border-danger', rest.className)}
        >
          {children}
        </Listbox>
      )}
    </Field>
  );
}

/** Accessible macOS-style switch. */
export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  hideLabel = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Just the switch, e.g. in a table cell whose column header says what it is. */
  hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div className={clsx('flex items-start justify-between py-1', !hideLabel && 'gap-4')}>
      <div className={clsx(hideLabel ? 'sr-only' : 'flex-1')}>
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
          'relative h-6 w-10 shrink-0 rounded-full transition-colors duration-[160ms] disabled:opacity-50',
          checked ? 'bg-green-900' : 'bg-ink/20',
        )}
      >
        <span
          className={clsx(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.3)] transition-transform duration-[160ms]',
            checked && 'translate-x-4',
          )}
        />
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The open modals, oldest first. Each one listens for Escape on the document,
 * so with a confirm dialog on top of an editor one keypress would close both;
 * only the last to open answers.
 */
const openModals: symbol[] = [];

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
  // Callers pass an inline onClose, a new function every render. Held in a ref
  // so the effect below runs once per opening: when it depended on onClose it
  // re-ran on every keystroke and pulled focus out of the field being typed in.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Escape closes, and the body cannot scroll behind the overlay.
  useEffect(() => {
    if (!open) return;
    const self = Symbol('modal');
    openModals.push(self);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openModals[openModals.length - 1] === self) closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Move focus into the dialog so the keyboard is not left behind it —
    // unless a field inside has already taken it with autoFocus.
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openModals.splice(openModals.indexOf(self), 1);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-0 backdrop-blur-[3px] sm:items-center sm:p-4">
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
          'relative max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-[16px] bg-surface pb-[env(safe-area-inset-bottom)] shadow-window sm:rounded-[16px] sm:pb-0',
          width === 'sm' && 'sm:max-w-md',
          width === 'md' && 'sm:max-w-2xl',
          width === 'lg' && 'sm:max-w-4xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5">
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
        <div className="px-5 py-3">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 bg-canvas/70 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Confirmation for destructive actions. The brief and the PRD's reliability
 * requirement both call for these before any delete. `password` adds a
 * "Your password" field for the ones that cannot be undone; onConfirm gets
 * what was typed, and the dialog stays open so a wrong one can be retyped.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
  pending,
  password = false,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  onConfirm: (password: string) => void;
  onCancel: () => void;
  pending?: boolean;
  password?: boolean;
}) {
  const [typed, setTyped] = useState('');
  const formId = useId();
  // Never keep a password around between openings.
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

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
          <Button
            variant="destructive"
            type={password ? 'submit' : 'button'}
            form={password ? formId : undefined}
            onClick={password ? undefined : () => onConfirm('')}
            loading={pending}
            disabled={password && !typed}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-ink">{message}</div>
      {password ? (
        <form
          id={formId}
          className="mt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (typed) onConfirm(typed);
          }}
        >
          <Input
            label="Your password"
            hint="The password you sign in with. Needed because this cannot be undone."
            type="password"
            autoComplete="current-password"
            autoFocus
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </form>
      ) : null}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* State placeholders — every list screen needs all three                      */
/* -------------------------------------------------------------------------- */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-muted" role="status">
      <CircleNotch size={18} className="animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/** Table-shaped shimmer, so a loading list does not collapse the layout. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="animate-pulse p-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 rounded-control px-3 py-3 even:bg-ink/[0.03]">
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
      <WarningCircle size={22} className="text-danger" aria-hidden="true" />
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

/**
 * A page's heading. Only the Dashboard shows it (`prominent`); everywhere else
 * the window's title bar already names the page, so the heading is kept for
 * screen readers alone and only the actions show.
 */
export function PageHeader({
  title,
  description,
  actions,
  prominent = false,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  prominent?: boolean;
}) {
  if (!prominent) {
    return (
      <>
        <h1 className="sr-only">{title}</h1>
        {actions ? <div className="mb-4 flex flex-wrap items-center justify-end gap-2">{actions}</div> : null}
      </>
    );
  }
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px] sm:leading-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** One step of a breadcrumb trail: a place to go back to, or (last) where you are. */
export interface Crumb {
  label: string;
  to?: string;
  onClick?: () => void;
}

/** "CMS › Services › Kitchens": every step but the last goes back there. */
export function Crumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const step = 'rounded-[4px] text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35 pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center';
  return (
    <nav aria-label="Breadcrumb" className={clsx('min-w-0', className)}>
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${index}-${item.label}`} className={clsx('flex items-center gap-1.5', last ? 'min-w-0' : 'shrink-0')}>
              {index > 0 ? (
                <span aria-hidden="true" className="text-ink-muted/60">
                  ›
                </span>
              ) : null}
              {last ? (
                <span aria-current="page" className="truncate text-ink">
                  {item.label}
                </span>
              ) : item.to ? (
                <Link to={item.to} className={step}>
                  {item.label}
                </Link>
              ) : (
                <button type="button" onClick={item.onClick} className={step}>
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Horizontal scroll container for tables.
 *
 * Wide tables scroll inside their own box so the page body never scrolls
 * sideways, which is what keeps the 375px breakpoint usable.
 */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto rounded-card bg-surface p-2 shadow-soft">
      <table className={clsx('data-table w-full min-w-[44rem] border-separate border-spacing-0 text-left', className)}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={clsx(
        'label-eyebrow whitespace-nowrap px-3 py-2',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={clsx('px-3 py-3 align-middle', className)}>{children}</td>
  );
}

export function Tabs({
  tabs,
  active,
  onChange,
  vertical = false,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
  /** A System Settings style sidebar from lg up; a segmented control below. */
  vertical?: boolean;
}) {
  // A macOS segmented control. The outer box scrolls if the segments outgrow a
  // phone screen, so the page itself never scrolls sideways.
  return (
    <div className={clsx('mb-4 max-w-full overflow-x-auto', vertical && 'lg:mb-0')}>
      <div
        role="tablist"
        aria-orientation={vertical ? 'vertical' : undefined}
        className={clsx(
          'inline-flex flex-wrap gap-0.5 rounded-[9px] bg-ink/[0.07] p-0.5',
          vertical && 'lg:flex lg:flex-col lg:gap-1 lg:rounded-card lg:bg-surface lg:p-2 lg:shadow-soft',
        )}
      >
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
                'min-h-11 whitespace-nowrap rounded-[7px] px-3 text-sm font-semibold transition-colors duration-[160ms] pointer-fine:min-h-8',
                vertical && 'lg:flex lg:items-center lg:justify-between lg:text-left pointer-fine:lg:min-h-9',
                selected
                  ? clsx('bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]', vertical && 'lg:bg-green-900 lg:text-on-primary lg:shadow-none')
                  : clsx('text-ink-muted hover:text-ink', vertical && 'lg:hover:bg-ink/[0.05]'),
              )}
            >
              {tab.label}
              {tab.count !== undefined ? (
                <span className={clsx('tabular ml-1.5 text-xs text-ink-muted', selected && vertical && 'lg:text-on-primary/75')}>{tab.count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * macOS-style Appearance picker: two large swatches instead of a dropdown.
 * Each swatch is a real pressed-state button, so it reads correctly to
 * assistive tech as well as by eye.
 */
export function AppearancePicker({
  value,
  onChange,
}: {
  value: 'light' | 'dark';
  onChange: (next: 'light' | 'dark') => void;
}) {
  const options = [
    { id: 'light' as const, label: 'Light', ground: '#f7f5f0', panel: '#fffefa', bar: '#173c30', line: '#d8d2c6' },
    { id: 'dark' as const, label: 'Dark', ground: '#14170f', panel: '#1c201a', bar: '#7fb99b', line: '#333a2e' },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Appearance">
      {options.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.id)}
            className={clsx(
              'flex flex-col gap-2.5 rounded-card p-2.5 text-left transition-colors duration-[160ms]',
              selected ? 'bg-green-100 ring-2 ring-green-900' : 'bg-ink/[0.035] hover:bg-ink/[0.06]',
            )}
          >
            <span
              aria-hidden="true"
              className="flex h-28 items-end gap-2 rounded-[10px] p-3"
              style={{ background: option.ground }}
            >
              <span className="flex h-full flex-1 flex-col gap-1.5 rounded-[7px] p-2.5" style={{ background: option.panel }}>
                <span className="h-2 w-1/2 rounded-full" style={{ background: option.bar }} />
                <span className="h-1.5 w-4/5 rounded-full" style={{ background: option.line }} />
                <span className="h-1.5 w-3/5 rounded-full" style={{ background: option.line }} />
              </span>
            </span>
            <span className="flex items-center justify-between px-1 text-sm font-semibold text-ink">
              {option.label}
              {selected ? <Check size={15} className="text-green-900" aria-hidden="true" /> : null}
            </span>
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
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10"
      >
        <div className="h-full rounded-full bg-green-900" style={{ width: `${clamped}%` }} />
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
          'flex h-5 w-5 items-center justify-center rounded-[5px] border shadow-card transition-colors',
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

/* -------------------------------------------------------------------------- */
/* System Settings layout                                                     */
/* -------------------------------------------------------------------------- */

export interface SettingsSection {
  id: string;
  label: string;
  Icon: PhosphorIcon;
}

const SIDEBAR_ROW =
  'flex min-h-9 w-full items-center gap-2.5 rounded-[7px] px-2.5 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/35 pointer-coarse:min-h-11';

/**
 * Laid out like System Settings: the panes down the left, the open one on the
 * right. Below lg there is no sidebar: a native dropdown takes one line.
 */
export function SettingsShell({
  label,
  sections,
  active,
  to,
  children,
}: {
  label: string;
  sections: SettingsSection[];
  active: string;
  to: (id: string) => string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex h-full min-h-0">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface-muted/45 lg:flex">
        <nav aria-label={label} className="flex flex-col gap-px px-2.5 py-5">
          {sections.map(({ id, label: name, Icon }) => (
            <Link
              key={id}
              to={to(id)}
              aria-current={id === active ? 'page' : undefined}
              className={clsx(SIDEBAR_ROW, id === active ? 'bg-green-900 font-semibold text-on-primary' : 'text-ink hover:bg-ink/[0.06]')}
            >
              <Icon size={16} aria-hidden="true" className="shrink-0" />
              {name}
            </Link>
          ))}
        </nav>
      </aside>

      {/* relative: hidden absolutely-positioned inputs (switches, checkboxes) must scroll in here, not stretch the page. */}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-surface">
        <div className="px-5 pb-16 pt-6 sm:px-8 lg:pt-8">
          <label className="mb-7 block lg:hidden">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">{label}</span>
            <Listbox value={active} onChange={(event) => navigate(to(event.target.value))} className={clsx(FIELD_BASE, 'w-full')}>
              {sections.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.label}
                </option>
              ))}
            </Listbox>
          </label>
          {children}
        </div>
      </div>
    </div>
  );
}

/** A pane's title, what it is for, and an optional action at the right. */
export function PaneHeader({ title, help, action }: { title: string; help: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-ink-muted">{help}</p>
      </div>
      {action}
    </header>
  );
}

/** A rounded group of settings rows, as in System Settings. */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mt-6 max-w-2xl">
      {title ? <h3 className="mb-2 px-1 text-[13px] font-semibold text-ink-muted">{title}</h3> : null}
      <div className="divide-y divide-border/70 rounded-[10px] border border-border bg-surface">{children}</div>
    </section>
  );
}

/** One setting: what it is on the left, its value or control on the right (below it on a phone). */
export function SettingsRow({ label, help, children }: { label: ReactNode; help?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-52">
        <p className="text-sm font-medium text-ink">{label}</p>
        {help ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{help}</p> : null}
      </div>
      {children ? <div className="flex min-w-0 max-w-full shrink-0 flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
