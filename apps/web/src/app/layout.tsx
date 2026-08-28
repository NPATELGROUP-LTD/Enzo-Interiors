import type { Metadata } from "next";
import { Archivo, Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "@/styles/theme.css";
import { SmoothScroll } from "@/components/shared/SmoothScroll";
import { Toaster } from "@/components/ui/sonner";

// next/font/google self-hosts and optimizes these at build time, and sets
// CSS variables on <html> that src/styles/theme.css reads as --font-heading
// / --font-body (see that file's --font-archivo / --font-inter aliases).
//
// Archivo replaces Fraunces as the display face. The site is sans-only now,
// and Archivo is the right kind of sans for fitted furniture: a grotesque
// drawn on a tight grid, with enough weight range to hold authority at 3rem
// without the softness a geometric brings. It pairs with Inter for reading
// and Space Grotesk for the technical numerals the measure-rule motif runs
// on — a combination the type reference lists for exactly this brief
// ("Minimalist Portfolio": Archivo + Space Grotesk).
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
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
      className={`${archivo.variable} ${inter.variable} ${spaceGrotesk.variable}`}
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
