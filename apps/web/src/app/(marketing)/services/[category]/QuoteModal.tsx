"use client";

// Ported from Boilerplate:src/app/components/pages/ServiceDetailPage.tsx's
// inline `quoteModal` state + form. The boilerplate's page put the whole
// page body in one Client Component just to share this modal's open state
// across three separate CTA buttons (hero, each pricing tier, final CTA).
// Here the page itself stays a Server Component: this file exports a
// `QuoteModalRoot` Client Component that takes the static page JSX as
// `children` (still server-rendered — see
// https://react.dev/reference/react/use-client#serializable-types) and a
// `QuoteTriggerButton` that opens it via context. Same mock behavior as the
// boilerplate: no real submission endpoint exists yet, this is the
// lead-capture form's UI only — a `toast.success(...)` no-op.
//
// `QuoteRequestInfo` lets callers (namely `./QuoteEstimator.tsx`) attach
// which tier and instant-estimate range was selected, so the modal — and
// its mock submission toast — reflects the actual selection instead of just
// the bare service title. This is additive/backward-compatible: existing
// `QuoteTriggerButton` usages that pass no `quoteInfo` behave exactly as
// before.
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

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

export function QuoteModalRoot({
  serviceTitle,
  children,
}: {
  serviceTitle: string;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [requestInfo, setRequestInfo] = useState<QuoteRequestInfo>({});

  const handleOpen = (info?: QuoteRequestInfo) => {
    setRequestInfo(info ?? {});
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const suffix = requestInfo.tier ? ` (${requestInfo.tier} tier)` : "";
    toast.success(
      `Quote request submitted for ${serviceTitle}${suffix}! We'll be in touch within 24 hours.`
    );
    setIsOpen(false);
    setForm(EMPTY_FORM);
    setRequestInfo({});
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
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-primary" style={{ fontSize: "1.3rem" }}>
                    Get a Free Quote
                  </h3>
                  <p className="text-secondary text-[13px] mt-1">
                    {serviceTitle}
                    {requestInfo.tier ? ` — ${requestInfo.tier}` : ""}
                  </p>
                  {requestInfo.estimateLabel && (
                    <p className="text-primary text-[13px] mt-1" style={{ fontWeight: 600 }}>
                      Estimated {requestInfo.estimateLabel}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-primary"
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-foreground text-[12px] block mb-1">
                    Full Name
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary"
                    placeholder="Your name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-foreground text-[12px] block mb-1">
                      Email
                    </label>
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary"
                      placeholder="you@email.com"
                    />
                  </div>
                  <div>
                    <label className="text-foreground text-[12px] block mb-1">
                      Phone
                    </label>
                    <input
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                      className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary"
                      placeholder="07XXX XXXXXX"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-foreground text-[12px] block mb-1">
                    Budget Range
                  </label>
                  <select
                    value={form.budget}
                    onChange={(e) =>
                      setForm({ ...form, budget: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary"
                  >
                    <option value="">Select range...</option>
                    <option>Under £3,000</option>
                    <option>£3,000 - £5,000</option>
                    <option>£5,000 - £10,000</option>
                    <option>£10,000 - £20,000</option>
                    <option>£20,000+</option>
                  </select>
                </div>
                <div>
                  <label className="text-foreground text-[12px] block mb-1">
                    Project Details
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={form.details}
                    onChange={(e) =>
                      setForm({ ...form, details: e.target.value })
                    }
                    className="w-full px-4 py-3 rounded-xl bg-input-background border border-border text-[14px] focus:outline-none focus:border-primary resize-none"
                    placeholder="Tell us about your space and what you're looking for..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-full bg-primary text-primary-foreground text-[14px] hover:bg-enzo-forest-light transition-all duration-300"
                >
                  Submit Quote Request
                </button>
              </form>
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
  const ctx = useContext(QuoteModalContext);
  if (!ctx) {
    throw new Error("QuoteTriggerButton must be rendered within QuoteModalRoot");
  }
  return (
    <button onClick={() => ctx.open(quoteInfo)} className={className} {...rest}>
      {children}
    </button>
  );
}
