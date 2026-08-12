"use client";

// Shared between /services (Boilerplate:ServicesPage.tsx's inline FAQItem,
// each item toggles independently) and /services/[category]
// (Boilerplate:ServiceDetailPage.tsx's FAQ section, which is a single-open
// accordion via `openFaq: number | null`). The `exclusive` prop preserves
// both original behaviors from one component instead of duplicating the
// markup. Local toggle state — Client Component.
import { useState } from "react";

export interface FAQEntry {
  q: string;
  a: string;
}

export function FAQAccordion({
  faqs,
  exclusive = false,
}: {
  faqs: FAQEntry[];
  exclusive?: boolean;
}) {
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setOpenIndexes((prev) => {
      const isOpen = prev.has(i);
      if (exclusive) {
        return isOpen ? new Set() : new Set([i]);
      }
      const next = new Set(prev);
      if (isOpen) {
        next.delete(i);
      } else {
        next.add(i);
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => {
        const isOpen = openIndexes.has(i);
        return (
          <div
            key={faq.q}
            className="border border-border rounded-xl overflow-hidden"
          >
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between p-5 text-left hover:bg-card transition-colors"
            >
              <span
                className="text-primary text-[15px]"
                style={{ fontWeight: 500 }}
              >
                {faq.q}
              </span>
              <span
                className={`text-primary transition-transform duration-300 ${isOpen ? "rotate-45" : ""}`}
              >
                +
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-5">
                <p className="text-muted-foreground text-[14px] leading-relaxed">
                  {faq.a}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
