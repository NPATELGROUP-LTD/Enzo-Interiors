import type { Metadata } from "next";
import { Archivo, Inter, Space_Grotesk } from "next/font/google";
import { draftMode } from "next/headers";
import Script from "next/script";
import "@/styles/theme.css";
import { ComingSoon } from "@/components/coming-soon/ComingSoon";
import { SmoothScroll } from "@/components/shared/SmoothScroll";
import { Toaster } from "@/components/ui/sonner";
import { getMedia, getPage, getSiteStatus, isLive, type MediaLookup, type SiteStatus } from "@/lib/content";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

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

/**
 * The favicons chosen in the admin's Settings, else the ones in public/.
 * The dark one is listed last with a media query: a browser in dark mode
 * matches both and takes the last, one in light mode only matches the first.
 * A custom light icon without a dark one is used for both, rather than
 * pairing it with the shipped dark icon of a different design.
 */
function favicons(brand: SiteStatus["brand"], media: MediaLookup): NonNullable<Metadata["icons"]> {
  const light = brand?.favicon ? media(brand.favicon).src : "/icon.png";
  const dark = brand?.faviconDark ? media(brand.faviconDark).src : brand?.favicon ? null : "/icon-dark.png";
  return {
    icon: [{ url: light }, ...(dark ? [{ url: dark, media: "(prefers-color-scheme: dark)" }] : [])],
    apple: brand?.favicon ? light : "/apple-icon.png",
  };
}

/**
 * Site-wide defaults. Each page's own generateMetadata adds its canonical,
 * title and share card on top (see lib/seo.ts).
 */
export async function generateMetadata(): Promise<Metadata> {
  const [{ metadata }, site, media] = await Promise.all([getPage("site"), getSiteStatus(), getMedia()]);
  const verification = process.env.GOOGLE_SITE_VERIFICATION;
  return {
    metadataBase: new URL(SITE_URL),
    title: metadata.title,
    description: metadata.description,
    applicationName: SITE_NAME,
    icons: favicons(site.brand, media),
    openGraph: { type: "website", locale: "en_GB", siteName: SITE_NAME, images: ["/og/home"] },
    twitter: { card: "summary_large_image", images: ["/og/home/twitter"] },
    // Before launch every address is the coming-soon page; none of it
    // belongs in an index.
    ...(isLive(site) ? {} : { robots: { index: false, follow: false } }),
    ...(verification ? { verification: { google: verification } } : {}),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [site, draft] = await Promise.all([getSiteStatus(), draftMode()]);
  // Draft mode is the preview cookie from /api/preview: an editor looking at
  // the finished site before the public can.
  const gated = !isLive(site) && !draft.isEnabled;

  return (
    <html
      lang="en-GB"
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
            gap regardless of sub-pixel rounding.
            Not rendered at all before launch: the guard script above runs
            only once Next's runtime loads, after first paint, so hiding the
            frame from there flashed it on every coming-soon load. */}
        {gated ? null : (
          <div aria-hidden className="site-frame pointer-events-none fixed inset-0 z-[100] hidden border-[14px] border-enzo-sand md:block" />
        )}
        <SmoothScroll>{gated ? <ComingSoon site={site} /> : children}</SmoothScroll>
        {draft.isEnabled ? (
          <div className="fixed bottom-5 left-1/2 z-[110] flex -translate-x-1/2 items-center gap-4 rounded-full bg-enzo-dark/90 py-2 pl-5 pr-2 text-sm text-enzo-cream shadow-lg backdrop-blur">
            <span>Previewing — {isLive(site) ? "this is the live site" : "not public yet"}</span>
            {/* A plain link: this is a route handler, not a page. */}
            <a
              href="/api/preview/exit"
              className="rounded-full bg-enzo-cream px-3 py-1 font-medium text-enzo-forest hover:bg-white"
            >
              Exit preview
            </a>
          </div>
        ) : null}
        <Toaster />
      </body>
    </html>
  );
}
