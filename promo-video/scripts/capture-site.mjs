// Captures the real website at phone size, for the phone shots in the videos.
//
// The launch videos show the actual new site rather than a mock-up of one,
// so these screenshots are committed alongside the compositions and only
// need re-capturing when the site's pages change enough to matter.
//
//   1. Start the site:   cd apps/web && npm run dev      (http://localhost:3000)
//   2. Capture:          cd promo-video && npm run capture-site
//
// Needs a Playwright Chromium on this machine (`npx playwright install
// chromium` once). Set SITE_URL to capture from anywhere other than
// localhost:3000 — staging, for example.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "site");

// An iPhone-sized viewport. 2x rather than 3x: the phone in the videos
// renders its screen about 600px wide, so 780px of source is already more
// than it can show, and 3x full-page captures run into Chromium's texture
// size limit on long pages.
const VIEWPORT = { width: 390, height: 844 };
const SCALE = 2;

// How much of each page to keep, in CSS px. The phone scrolls through the
// top of a page, never the whole of it. Keep in step with siteCaptureHeight
// in src/brand/copy.ts.
const PAGES = [
  { name: "home", route: "/", height: 1400 },
  { name: "services", route: "/services", height: 2000 },
  { name: "portfolio", route: "/portfolio", height: 1400 },
  { name: "booking", route: "/booking", height: VIEWPORT.height },
];

// Recorded as "rejected" so the cookie banner never covers a capture — the
// same state a visitor who has already answered it would see.
const CONSENT = JSON.stringify({ analytics: false, marketing: false, decidedAt: new Date(0).toISOString(), version: 1 });

// The dev server's own overlay is not part of the site.
const HIDE_DEV_CHROME = "nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
    // The site sets every scroll-reveal to its finished state under reduced
    // motion, which is what a full-page capture needs: nothing is scrolled
    // into view, so without this most sections would be captured invisible.
    reducedMotion: "reduce",
  });
  await context.addInitScript((consent) => {
    window.localStorage.setItem("enzo.consent", consent);
  }, CONSENT);

  for (const page of PAGES) {
    const tab = await context.newPage();
    await tab.goto(SITE_URL + page.route, { waitUntil: "networkidle", timeout: 120_000 });
    await tab.addStyleTag({ content: HIDE_DEV_CHROME });
    // Fonts and lazy images settle after network idle on a cold dev server.
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(1500);
    // An image that failed to load (an unreachable CDN, say) would otherwise
    // be painted as a broken-image icon with its alt text across it. Hide
    // just those; everything that loaded is left exactly as the site draws it.
    const failed = await tab.evaluate(() => {
      const broken = [...document.images].filter((img) => img.complete && img.naturalWidth === 0);
      broken.forEach((img) => (img.style.visibility = "hidden"));
      return broken.length;
    });
    if (failed) console.warn(`  ! ${page.route}: ${failed} image(s) failed to load and were hidden`);

    const fullHeight = await tab.evaluate(() => document.documentElement.scrollHeight);
    const height = Math.min(page.height, fullHeight);
    const file = path.join(OUT_DIR, `${page.name}.jpg`);
    await tab.screenshot({
      path: file,
      type: "jpeg",
      quality: 86,
      fullPage: height > VIEWPORT.height,
      clip: { x: 0, y: 0, width: VIEWPORT.width, height },
    });
    console.log(`  ${page.route.padEnd(20)} → public/site/${page.name}.jpg  (${VIEWPORT.width}×${height} @${SCALE}x)`);
    await tab.close();
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
