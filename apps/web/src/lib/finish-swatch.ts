// Turns a finish *name* into something that can be rendered.
//
// The materials list on a service is free text the client types in the
// Content Manager — "Walnut", "Matt Lacquer", "Concrete Effect", and
// whatever they add next year. The detail page shows those finishes on a 3D
// sample block, which needs a colour and a surface character per finish, and
// nobody is going to pick a hex value in the CMS.
//
// So: match the name against the vocabulary the trade actually uses, and
// fall back to a hashed hue inside the brand's warm-neutral band. An
// unrecognised finish therefore still looks like it belongs on this site
// rather than turning up as magenta.
//
// Pure and framework-free so it can run in a server render.

/** How the surface behaves under light — drives the CSS overlay. */
export type Grain = "wood" | "stone" | "gloss" | "mirror" | "fabric" | "matte";

export interface FinishSwatch {
  name: string;
  /** Face colour. */
  base: string;
  /** Slightly darker edge, for the returns and shadow faces. */
  shade: string;
  grain: Grain;
  /** True when the finish is light enough to need dark text over it. */
  light: boolean;
}

interface Recipe {
  base: string;
  grain: Grain;
}

// Ordered: the first keyword found in the name wins, so "White Gloss" is
// matched as gloss (its defining property) rather than as a white paint.
const VOCABULARY: [string, Recipe][] = [
  ["walnut", { base: "#6B4A32", grain: "wood" }],
  ["oak", { base: "#C3A277", grain: "wood" }],
  ["veneer", { base: "#A87F55", grain: "wood" }],
  ["mirror", { base: "#C2CFD4", grain: "mirror" }],
  ["glass", { base: "#CEDBDF", grain: "mirror" }],
  ["gloss", { base: "#EFEFEC", grain: "gloss" }],
  ["lacquer", { base: "#D8D4CC", grain: "matte" }],
  ["quartz", { base: "#E4E2DD", grain: "stone" }],
  ["granite", { base: "#3A3A3C", grain: "stone" }],
  ["dekton", { base: "#8C8C8A", grain: "stone" }],
  ["slate", { base: "#4A4E52", grain: "stone" }],
  ["stone", { base: "#9A948B", grain: "stone" }],
  ["concrete", { base: "#9E9C97", grain: "stone" }],
  ["marble", { base: "#E8E6E1", grain: "stone" }],
  ["graphite", { base: "#3C3F42", grain: "matte" }],
  ["cashmere", { base: "#D9CFC0", grain: "matte" }],
  ["linen", { base: "#D6CEBE", grain: "fabric" }],
  ["fabric", { base: "#B9AFA1", grain: "fabric" }],
  ["leather", { base: "#5A4433", grain: "fabric" }],
  ["brass", { base: "#B08D4F", grain: "gloss" }],
  ["mdf", { base: "#E4E0D8", grain: "matte" }],
  ["paint", { base: "#E4E0D8", grain: "matte" }],
  ["white", { base: "#F2F1ED", grain: "matte" }],
  ["black", { base: "#2A2A2A", grain: "matte" }],
];

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Darkens a hex colour by `amount` (0–1) for return faces and edges. */
function shade(hex: string, amount: number): string {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  const shaded = channels.map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel * (1 - amount)))),
  );
  return `#${shaded.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Perceived luminance, for deciding whether labels over it go dark. */
function isLight(hex: string): boolean {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

export function getFinishSwatch(name: string): FinishSwatch {
  const lower = name.toLowerCase();
  const match = VOCABULARY.find(([keyword]) => lower.includes(keyword));

  let recipe: Recipe;
  if (match) {
    recipe = match[1];
  } else {
    // Unknown finish: a hue in the 24–46° band (timber and stone territory)
    // at low saturation, so it reads as a material rather than a swatch of
    // paint. Deterministic, so the same name is always the same colour.
    const hash = hashString(lower);
    const hue = 24 + (hash % 22);
    const saturation = 12 + ((hash >> 5) % 16);
    const lightness = 42 + ((hash >> 9) % 34);
    recipe = { base: hslToHex(hue, saturation, lightness), grain: "matte" };
  }

  return {
    name,
    base: recipe.base,
    shade: shade(recipe.base, 0.22),
    grain: recipe.grain,
    light: isLight(recipe.base),
  };
}

function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n: number) =>
    lightness - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/**
 * CSS `background-image` layers that give a flat colour the character of the
 * named surface — grain for timber, speckle for stone, a hard sheen band for
 * gloss and mirror, a weave for fabric. Returned as a string so it can drop
 * straight into a style prop over the base colour.
 */
export function grainLayers(grain: Grain): string {
  switch (grain) {
    case "wood":
      return [
        "repeating-linear-gradient(93deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0) 2px, rgba(255,255,255,0.05) 4px, rgba(0,0,0,0) 7px)",
        "repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0) 18px)",
      ].join(", ");
    case "stone":
      return [
        "radial-gradient(circle at 22% 32%, rgba(255,255,255,0.18) 0 1.5px, transparent 2px)",
        "radial-gradient(circle at 68% 61%, rgba(0,0,0,0.16) 0 1.5px, transparent 2px)",
        "radial-gradient(circle at 44% 78%, rgba(255,255,255,0.12) 0 1px, transparent 2px)",
        "linear-gradient(122deg, rgba(255,255,255,0.10), rgba(0,0,0,0.08))",
      ].join(", ");
    case "gloss":
      return "linear-gradient(104deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.06) 26%, rgba(0,0,0,0.06) 52%, rgba(255,255,255,0.34) 78%, rgba(0,0,0,0.04) 100%)";
    case "mirror":
      return "linear-gradient(112deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.10) 22%, rgba(30,60,70,0.28) 46%, rgba(255,255,255,0.62) 62%, rgba(30,60,70,0.20) 100%)";
    case "fabric":
      return [
        "repeating-linear-gradient(45deg, rgba(0,0,0,0.07) 0 1px, transparent 1px 4px)",
        "repeating-linear-gradient(-45deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 4px)",
      ].join(", ");
    default:
      return "linear-gradient(140deg, rgba(255,255,255,0.09), rgba(0,0,0,0.07))";
  }
}
