"use client";

// The quote-request sheet, and the context that lets any button on the
// service page open it.
//
// Moved here from app/(marketing)/services/[category]/QuoteModal.tsx: the
// investment sheets under components/services/detail/ trigger it, and a
// component importing upward into the app/ route folder is the wrong
// direction of dependency.
//
// Structure is unchanged and deliberately so: `QuoteModalRoot` is a Client
// Component that takes the server-rendered page as `children`, so the page
// itself stays a Server Component while three separate CTAs share one
// modal's open state. `QuoteRequestInfo` carries the tier and the live
// estimate the visitor was looking at when they pressed the button, so the
// form knows what they were pricing.
//
// Rebuilt surface, same behaviour: a paper sheet with registration marks
// rather than a white rounded box, real <label> associations, Escape to
// close, focus moved into the sheet on open and returned to the trigger on
// close, and the page scroll held while it is open (Lenis needs
// `data-lenis-prevent` on the scrollable panel, or it keeps driving the
// document underneath).
//
// Submission is still a mock — there is no endpoint yet. See
// docs/architecture.md for the eventual POST target.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { fill, type SharedContent } from "@/lib/content";

export interface QuoteRequestInfo {
  /** Pricing tier the visitor selected, e.g. "Premium". */
  tier?: string;
  /** Pre-formatted instant estimate range, e.g. "£8,000 – £10,800". */
  estimateLabel?: string;
}

interface QuoteModalContextValue {
  open: (info?: QuoteRequestInfo) => void;
}

const QuoteModalContext = createContext<QuoteModalContextValue | null>(null);

const EMPTY_FORM = { name: "", email: "", phone: "", budget: "", details: "" };

function bookingHref(category: string, tier?: string) {
  const params = new URLSearchParams({ service: category });
  if (tier) params.set("tier", tier);
  return `/booking?${params.toString()}`;
}

const FIELD_CLASS =
  "w-full rounded-[10px] border border-border bg-input-background px-4 py-3 text-[14px] text-foreground transition-colors duration-200 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30";
const LABEL_CLASS =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-enzo-forest-light";

export function QuoteModalRoot({
  serviceTitle,
  category,
  content,
  children,
}: {
  serviceTitle: string;
  /** Service slug, e.g. "kitchens" — feeds the "Book a Consultation" link. */
  category: string;
  /** The sheet's labels and its budget bands, from src/data/pages/shared.json. */
  content: SharedContent["quoteModal"];
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [requestInfo, setRequestInfo] = useState<QuoteRequestInfo>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const handleOpen = useCallback((info?: QuoteRequestInfo) => {
    // Remembered before the modal steals focus, so closing puts the caret
    // back on the button the visitor actually pressed.
    returnFocusTo.current = document.activeElement as HTMLElement | null;
    setRequestInfo(info ?? {});
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    returnFocusTo.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);

    // Hold the page still. The scrollbar's width is added back as padding
    // so the layout behind the overlay doesn't jump sideways as it locks.
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousPadding = root.style.paddingRight;
    const gap = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (gap > 0) root.style.paddingRight = `${gap}px`;

    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      root.style.overflow = previousOverflow;
      root.style.paddingRight = previousPadding;
      window.clearTimeout(focusTimer);
    };
  }, [isOpen, close]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const suffix = requestInfo.tier
      ? fill(content.toastTierSuffix, { tier: requestInfo.tier })
      : "";
    toast.success(fill(content.toast, { service: serviceTitle, suffix }));
    setIsOpen(false);
    setForm(EMPTY_FORM);
    setRequestInfo({});
    returnFocusTo.current?.focus();
  };

  return (
    <QuoteModalContext.Provider value={{ open: handleOpen }}>
      {children}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-enzo-dark/70 p-4 backdrop-blur-sm"
            onClick={close}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="quote-modal-heading"
              data-lenis-prevent
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[22px] bg-background p-7 sm:p-9"
              onClick={(event) => event.stopPropagation()}
            >
              {/* Registration marks — the same sheet motif the CTA uses. */}
              {["left-3 top-3", "right-3 top-3", "left-3 bottom-3", "right-3 bottom-3"].map(
                (position) => (
                  <span
                    key={position}
                    aria-hidden="true"
                    className={`pointer-events-none absolute ${position} h-3.5 w-3.5`}
                  >
                    <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border" />
                    <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border" />
                  </span>
                ),
              )}

              <div className="flex items-start justify-between gap-6">
                <div>
                  <span className="font-display text-[10.5px] font-semibold uppercase tracking-[0.26em] text-enzo-forest-light">
                    {content.eyebrow}
                  </span>
                  <h2
                    id="quote-modal-heading"
                    className="mt-2 font-title text-[1.45rem] font-semibold leading-[1.15] tracking-[-0.03em] text-primary"
                  >
                    {serviceTitle}
                  </h2>
                  {requestInfo.tier && (
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {fill(content.tierNote, { tier: requestInfo.tier })}
                    </p>
                  )}
                  {requestInfo.estimateLabel && (
                    <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/70 px-3.5 py-1.5 text-[12.5px] tabular-nums text-primary">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-enzo-sand"
                      />
                      {fill(content.estimateLabel, {
                        estimate: requestInfo.estimateLabel,
                      })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label={content.closeLabel}
                  className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors duration-200 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                <div>
                  <label htmlFor="quote-name" className={LABEL_CLASS}>
                    {content.fields.name.label}
                  </label>
                  <input
                    id="quote-name"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(event) =>
                      setForm({ ...form, name: event.target.value })
                    }
                    className={FIELD_CLASS}
                    placeholder={content.fields.name.placeholder}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="quote-email" className={LABEL_CLASS}>
                      {content.fields.email.label}
                    </label>
                    <input
                      id="quote-email"
                      required
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm({ ...form, email: event.target.value })
                      }
                      className={FIELD_CLASS}
                      placeholder={content.fields.email.placeholder}
                    />
                  </div>
                  <div>
                    <label htmlFor="quote-phone" className={LABEL_CLASS}>
                      {content.fields.phone.label}
                    </label>
                    <input
                      id="quote-phone"
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={(event) =>
                        setForm({ ...form, phone: event.target.value })
                      }
                      className={FIELD_CLASS}
                      placeholder={content.fields.phone.placeholder}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="quote-budget" className={LABEL_CLASS}>
                    {content.fields.budget.label}
                  </label>
                  <select
                    id="quote-budget"
                    value={form.budget}
                    onChange={(event) =>
                      setForm({ ...form, budget: event.target.value })
                    }
                    className={FIELD_CLASS}
                  >
                    <option value="">{content.fields.budget.placeholder}</option>
                    {content.budgets.map((budget) => (
                      <option key={budget}>{budget}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="quote-details" className={LABEL_CLASS}>
                    {content.fields.details.label}
                  </label>
                  <textarea
                    id="quote-details"
                    required
                    rows={4}
                    value={form.details}
                    onChange={(event) =>
                      setForm({ ...form, details: event.target.value })
                    }
                    className={`${FIELD_CLASS} resize-none`}
                    placeholder={content.fields.details.placeholder}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full bg-primary py-3.5 text-[14px] font-medium text-primary-foreground transition-colors duration-300 hover:bg-enzo-forest-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {content.submitLabel}
                </button>
              </form>

              <Link
                href={bookingHref(category, requestInfo.tier)}
                onClick={close}
                className="mt-3 block rounded-full border border-border py-3 text-center text-[13.5px] text-primary transition-colors duration-300 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {content.bookingLinkLabel}
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </QuoteModalContext.Provider>
  );
}

export function QuoteTriggerButton({
  children,
  className,
  quoteInfo,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { quoteInfo?: QuoteRequestInfo }) {
  const context = useContext(QuoteModalContext);
  if (!context) {
    throw new Error("QuoteTriggerButton must be rendered within QuoteModalRoot");
  }
  return (
    <button
      type="button"
      onClick={() => context.open(quoteInfo)}
      className={className}
      {...rest}
    >
      {children}
    </button>
  );
}
