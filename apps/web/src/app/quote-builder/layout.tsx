import type { Metadata } from "next";

// Outside the (marketing) group, like /booking: a working tool, so no
// marketing navbar or footer. Each screen brings its own compact header.
export const metadata: Metadata = {
  title: {
    template: "%s | Enzo Interiors",
    default: "Price your room | Enzo Interiors",
  },
  robots: { index: false, follow: false },
};

export default function QuoteBuilderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
