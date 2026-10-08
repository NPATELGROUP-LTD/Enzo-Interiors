import {
  CheckCircle,
  Info,
  X,
  XCircle,
} from '@phosphor-icons/react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastState {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

const TONE_STYLES: Record<ToastTone, { bg: string; fg: string; Icon: typeof Info }> = {
  success: { bg: 'bg-success-bg', fg: 'text-success', Icon: CheckCircle },
  error: { bg: 'bg-danger-bg', fg: 'text-danger', Icon: XCircle },
  info: { bg: 'bg-green-100', fg: 'text-green-900', Icon: Info },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, tone, message }]);
      // Errors linger: they usually need reading and sometimes acting on.
      window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4000);
    },
    [dismiss],
  );

  const value = useMemo<ToastState>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
      info: (message: string) => push('info', message),
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
        className="pointer-events-none fixed right-3 top-10 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const { bg, fg, Icon } = TONE_STYLES[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex items-start gap-3 rounded-[12px] border border-border ${bg} p-3 shadow-window`}
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${fg}`} aria-hidden="true" />
              <p className="flex-1 text-ink">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-mr-2 flex min-h-11 min-w-11 items-center justify-center rounded-control text-ink-muted hover:text-ink"
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
