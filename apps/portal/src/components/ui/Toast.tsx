import {
  Bell,
  CheckCircle,
  Info,
  X,
  XCircle,
} from '@phosphor-icons/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'success' | 'error' | 'info' | 'notice';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  /** A notice's second line. */
  body?: string | null;
  /** A notice opens what it is about when tapped. */
  onOpen?: () => void;
}

interface ToastState {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  /** A new notification: title, optional detail, and where tapping it goes. */
  notice: (title: string, body?: string | null, onOpen?: () => void) => void;
}

const ToastContext = createContext<ToastState | null>(null);

const TONE_STYLES: Record<ToastTone, { bg: string; fg: string; Icon: typeof Info }> = {
  success: { bg: 'bg-success-bg', fg: 'text-success', Icon: CheckCircle },
  error: { bg: 'bg-danger-bg', fg: 'text-danger', Icon: XCircle },
  info: { bg: 'bg-green-100', fg: 'text-green-900', Icon: Info },
  notice: { bg: 'bg-surface', fg: 'text-green-900', Icon: Bell },
};

/** More than this at once is noise: the oldest goes first. */
const MAX_VISIBLE = 3;
/** Errors linger: they usually need reading and sometimes acting on. */
const lifetime = (tone: ToastTone) => (tone === 'error' ? 8000 : tone === 'notice' ? 6000 : 4000);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  /** (Re)start a toast's countdown; hovering or focusing it pauses it. */
  const arm = useCallback(
    (id: number, tone: ToastTone) => {
      window.clearTimeout(timers.current.get(id));
      timers.current.set(id, window.setTimeout(() => dismiss(id), lifetime(tone)));
    },
    [dismiss],
  );
  const hold = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    const live = timers.current;
    return () => live.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Date.now() + Math.random();
      setToasts((current) => {
        // The same thing said twice in a row (a double click, a retry) is said once.
        if (current.some((t) => t.tone === toast.tone && t.message === toast.message && t.body === toast.body)) return current;
        const dropped = current.slice(0, Math.max(0, current.length + 1 - MAX_VISIBLE));
        dropped.forEach((t) => hold(t.id));
        arm(id, toast.tone);
        return [...current.slice(dropped.length), { id, ...toast }];
      });
    },
    [arm, hold],
  );

  const value = useMemo<ToastState>(
    () => ({
      success: (message: string) => push({ tone: 'success', message }),
      error: (message: string) => push({ tone: 'error', message }),
      info: (message: string) => push({ tone: 'info', message }),
      notice: (title: string, body?: string | null, onOpen?: () => void) =>
        push({ tone: 'notice', message: title, body, onOpen }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/*
        aria-live so a screen reader announces the outcome of an action the
        user cannot see — the brief requires plain-English feedback, and a
        silent toast is invisible to assistive tech.
      */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-3 top-[max(2.5rem,env(safe-area-inset-top))] z-[100] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const { bg, fg, Icon } = TONE_STYLES[toast.tone];
          const open = toast.onOpen;
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              onMouseEnter={() => hold(toast.id)}
              onMouseLeave={() => arm(toast.id, toast.tone)}
              onFocus={() => hold(toast.id)}
              onBlur={() => arm(toast.id, toast.tone)}
              className={`pointer-events-auto flex items-center gap-2.5 rounded-[12px] border border-border ${bg} py-2 pl-3 pr-1.5 shadow-window`}
            >
              <Icon size={18} className={`shrink-0 ${fg}`} aria-hidden="true" />
              {open ? (
                <button
                  type="button"
                  onClick={() => {
                    dismiss(toast.id);
                    open();
                  }}
                  className="min-w-0 flex-1 rounded-control py-0.5 text-left text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-focus-ring/40"
                >
                  <span className="block font-semibold">{toast.message}</span>
                  {toast.body ? <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-muted">{toast.body}</span> : null}
                </button>
              ) : (
                <div className="min-w-0 flex-1 py-0.5 text-ink">
                  <p className={toast.tone === 'notice' ? 'font-semibold' : undefined}>{toast.message}</p>
                  {toast.body ? <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-muted">{toast.body}</p> : null}
                </div>
              )}
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="flex size-8 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-secondary-hover hover:text-ink pointer-coarse:size-10"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastState {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
