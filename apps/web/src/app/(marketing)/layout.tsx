import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SmoothScroll } from "@/components/shared/SmoothScroll";

// Ported from Boilerplate:src/app/components/layout/Layout.tsx. That file
// used react-router's <Outlet/> + a useScrollToTop hook; the App Router
// gives us route nesting and scroll restoration natively, so this layout
// is just the Navbar/Footer shell. It stays a Server Component — Navbar
// and Footer are the only pieces that need "use client" (scroll listeners /
// local form state). CustomCursor is disabled for now — see
// components/shared/CustomCursor.tsx — re-add it here to bring it back.
//
// SmoothScroll (GSAP ScrollSmoother) wraps only <main>+<Footer>, not
// <Navbar> — ScrollSmoother applies a CSS transform to its content
// wrapper, and a `position: fixed` descendant of a transformed ancestor
// stops being viewport-fixed (a CSS quirk: transform creates a new
// containing block). Navbar needs to stay a sibling, not nested inside it.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <SmoothScroll>
        <main className="flex-1">{children}</main>
        <Footer />
      </SmoothScroll>
    </div>
  );
}
