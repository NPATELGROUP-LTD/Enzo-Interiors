import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { getPage, getServiceDetails } from "@/lib/content";

/**
 * The share card for a page: forest ground, the Enzo mark, the page's title.
 *
 * Only known pages and service slugs render. Taking the title from the URL
 * would let anyone mint an Enzo-branded image saying anything, on our domain.
 * A page whose CMS entry sets a share image never links here at all.
 */

/** Open Graph (Facebook, LinkedIn, iMessage…) and X, whose large card is 2:1. */
export const OG_SIZE = { width: 1200, height: 630 };
export const TWITTER_SIZE = { width: 1200, height: 600 };
const FOREST = "#102E2D";
const CREAM = "#F2F0EB";
const SAGE = "#8A9E8C";

const PAGE_KEYS = ["home", "services", "portfolio", "about", "contact", "booking", "privacy", "terms", "cookies"];

/** Every key with a card. Routes prerender these; a service added later renders on first request. */
export async function cardKeys(): Promise<Array<{ key: string }>> {
  const services = await getServiceDetails();
  return [...PAGE_KEYS, ...services.map((row) => row.slug)].map((key) => ({ key }));
}

// Read once per server process. assets/ is copied into the image beside the
// standalone server (see Dockerfile), so process.cwd() finds it in both.
const assets = Promise.all([
  readFile(join(process.cwd(), "assets/archivo-600.ttf")),
  readFile(join(process.cwd(), "assets/archivo-400.ttf")),
  readFile(join(process.cwd(), "assets/enzo-mark.png")),
]);

/** "About — Enzo Interiors" -> "About". The brand is already on the card. */
function bare(title: string): string {
  return title.replace(/\s+[—–-]\s+Enzo Interiors$/, "").trim();
}

async function card(key: string): Promise<{ eyebrow: string; title: string; body: string } | null> {
  const pages: Record<string, () => Promise<{ title: string; description: string }>> = {
    home: async () => (await getPage("home")).metadata,
    services: async () => (await getPage("services")).metadata,
    portfolio: async () => (await getPage("portfolio")).metadata,
    about: async () => (await getPage("about")).metadata,
    contact: async () => (await getPage("contact")).metadata,
    booking: async () => (await getPage("booking")).metadata,
    privacy: async () => (await getPage("legal")).privacy.metadata,
    terms: async () => (await getPage("legal")).terms.metadata,
    cookies: async () => (await getPage("legal")).cookies.metadata,
  };

  if (pages[key]) {
    const meta = await pages[key]();
    return {
      eyebrow: key === "home" ? "Leicester · Bespoke interiors" : "Enzo Interiors",
      title: key === "home" ? "Fitted furniture, drawn for your room." : bare(meta.title),
      body: meta.description,
    };
  }

  const service = (await getServiceDetails()).find((row) => row.slug === key);
  if (!service) return null;
  return { eyebrow: "Enzo Interiors · Services", title: service.title, body: service.heroDesc };
}

export async function renderCard(
  key: string,
  size: { width: number; height: number },
): Promise<Response> {
  const content = await card(key);
  if (!content) return new Response("Not found", { status: 404 });

  const [semibold, regular, mark] = await assets;
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;
  // Cut at a word, never mid-word.
  const body =
    content.body.length > 150
      ? `${content.body.slice(0, 148).replace(/\s+\S*$/, "").replace(/[,;:—–-]$/, "")}…`
      : content.body;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: FOREST,
          color: CREAM,
          padding: "64px 72px",
          fontFamily: "Archivo",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- satori renders plain img only */}
          <img src={markSrc} width={180} height={91} alt="" />
          <div style={{ fontSize: 22, color: SAGE, letterSpacing: 3, textTransform: "uppercase" }}>
            {content.eyebrow}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            {content.title}
          </div>
          <div style={{ fontSize: 28, fontWeight: 400, lineHeight: 1.4, color: "rgba(242,240,235,0.78)", maxWidth: 940 }}>
            {body}
          </div>
        </div>
        <div style={{ display: "flex", height: 6, width: 120, background: SAGE, borderRadius: 3 }} />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo", data: semibold, weight: 600, style: "normal" },
        { name: "Archivo", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}
