import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "@/styles/theme.css";
import { SmoothScroll } from "@/components/shared/SmoothScroll";
import { Toaster } from "@/components/ui/sonner";

// next/font/google self-hosts and optimizes these at build time, and sets
// CSS variables on <html> that src/styles/theme.css reads as --font-heading
// / --font-body (see that file's --font-fraunces / --font-inter aliases).
//
// Fraunces replaces Cormorant Garamond as the heading face — the brief
// asked for the distinctive editorial character of a paid boutique foundry
// (notyourtype.nl), but their fonts aren't freely licensable for web
// embedding. Fraunces is a free, properly-licensed variable serif with a
// similarly expressive, high-contrast editorial feel (soft/wonk optical
// variants), commonly used for exactly this kind of bespoke-brand look.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Enzo Interiors",
  description:
    "Bespoke interior design & fitted furniture, designed and handcrafted in Leicester.",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        {/* Desktop-only decorative frame around the whole site — completely
            square, no rounded corners. Hidden on mobile entirely. The navbar
            (Navbar.tsx) docks against this frame's edge on desktop — it
            intentionally positions its pieces a couple of px *inside* the
            14px band (rather than exactly at 14px) so the frame's own paint
            (it's a higher z-index) always covers the seam, guaranteeing no
            gap regardless of sub-pixel rounding. */}
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] hidden border-[14px] border-enzo-sand md:block" />
        <SmoothScroll>{children}</SmoothScroll>
        <Toaster />
      </body>
    </html>
  );
}
