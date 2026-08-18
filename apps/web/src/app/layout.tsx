import type { Metadata } from "next";
import { Fraunces, Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
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

// Distinctive geometric sans used sparingly for small display labels (hero
// showcase captions) where Inter reads too neutral — see --font-display in
// theme.css and the .font-display utility it generates.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
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
      className={`${fraunces.variable} ${inter.variable} ${spaceGrotesk.variable}`}
      data-scroll-behavior="smooth"
    >
      {/* suppressHydrationWarning is scoped to this element only (it does
          not suppress mismatches in children) and is needed because the
          beforeInteractive script below deliberately sets
          data-hero-chrome on <body> before React hydrates — the server
          never rendered that attribute (it doesn't know the pathname at
          the point of a static shell render), so without this, React logs
          a hydration-mismatch warning for an intentional, expected
          difference. This is the same pattern next-themes recommends for
          its own flash-prevention script. */}
      <body suppressHydrationWarning>
        {/* Prevents a flash of the decorative site-frame border (and, by
            extension, the Navbar) on the homepage's first paint.
            HeroSequence hides both via document.body.dataset.heroChrome =
            "hidden" in a client effect, but that only runs after
            hydration — on a slow connection the raw server-rendered HTML
            (frame visible) can paint first. next/script's "beforeInteractive"
            strategy is Next's supported way to inject a script that Next
            itself guarantees runs before hydration (a plain <script> tag
            here gets swallowed by React 19's script de-duplication/
            hoisting instead of executing inline where placed), so the
            attribute is reliably set before styles are ever computed — no
            transition plays for the initial state. */}
        <Script id="hero-chrome-guard" strategy="beforeInteractive">
          {'if(location.pathname==="/"){document.body.dataset.heroChrome="hidden"}'}
        </Script>
        {/* Desktop-only decorative frame around the whole site — completely
            square, no rounded corners. Hidden on mobile entirely. The navbar
            (Navbar.tsx) docks against this frame's edge on desktop — it
            intentionally positions its pieces a couple of px *inside* the
            14px band (rather than exactly at 14px) so the frame's own paint
            (it's a higher z-index) always covers the seam, guaranteeing no
            gap regardless of sub-pixel rounding. */}
        <div aria-hidden className="site-frame pointer-events-none fixed inset-0 z-[100] hidden border-[14px] border-enzo-sand md:block" />
        <SmoothScroll>{children}</SmoothScroll>
        <Toaster />
      </body>
    </html>
  );
}
