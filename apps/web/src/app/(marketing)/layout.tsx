import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CookieBanner } from "@/components/legal/CookieBanner";
import { PageTransition } from "@/components/shared/PageTransition";
// Ported from Boilerplate:src/app/components/layout/Layout.tsx. That file
// used react-router's <Outlet/> + a useScrollToTop hook; the App Router
// gives us route nesting and scroll restoration natively, so this layout
// is just the Navbar/Footer shell. It stays a Server Component — Navbar
// and Footer are the only pieces that need "use client" (scroll listeners /
// local form state).
//
// There is no custom cursor, and there should not be one. It was tried: a dot
// and a lagging ring that changed shape with whatever was under it. Two
// problems in practice. Over a technical drawing — and half this site is
// technical drawings — a filled disc carrying the word "VIEW" covers the exact
// detail it is inviting you to look at. And hiding the native pointer means
// every affordance the operating system supplies for free (the text caret, the
// resize arrows, the not-allowed state on a disabled control) has to be
// re-implemented or simply lost. The pointer is the one piece of interface the
// visitor already owns and already understands.
//
// Smooth scroll (SmoothScroll, Lenis) is applied once at the root layout
// rather than here — Lenis animates the real document scrollTop instead of
// a transformed wrapper, so unlike GSAP's ScrollSmoother it doesn't need to
// exempt <Navbar> from anything.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* WCAG 2.4.1 (Bypass Blocks). The header is a five-item dock plus a
          hover panel, and on the homepage the first thing after it is a
          scroll-scrubbed sequence — a keyboard user should not have to travel
          through either to reach the page. Visually hidden until focused,
          then it lands on the sand frame at the top-left like every other
          floating piece in the header row. */}
      <a
        href="#main"
        className="sr-only rounded-2xl bg-enzo-forest px-5 py-3 text-[14px] font-medium text-enzo-cream focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[120] focus:outline-none focus:ring-2 focus:ring-enzo-sand focus:ring-offset-2"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer />
      <CookieBanner />
      <PageTransition />
    </div>
  );
}
