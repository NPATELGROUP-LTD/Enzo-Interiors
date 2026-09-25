// Small brand pieces: the logo, the site frame, the CTA pill and the badge.
import { useId } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { font } from "../brand/fonts";
import { color, DUR, EASE, sec } from "../brand/tokens";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** The logo files' own proportions (apps/api/seed-media/logo-*.png). */
const LOGO_ASPECT = 2622 / 1327;

/**
 * The Enzo signature, written on: a soft-edged mask sweeps left to right
 * along the script the way the pen would travel.
 */
export function Logo({
  tone,
  width,
  writeAt,
  duration = sec(1.4),
}: {
  tone: "white" | "forest";
  width: number;
  writeAt: number;
  duration?: number;
}) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [writeAt, writeAt + duration], [0, 1], { ...clamp, easing: EASE.drift });
  const edge = p * 130 - 20;
  const mask = `linear-gradient(100deg, #000 ${edge}%, transparent ${edge + 18}%)`;
  return (
    <Img
      src={staticFile(`brand/enzo-${tone}.png`)}
      style={{
        display: "block",
        width,
        height: width / LOGO_ASPECT,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    />
  );
}

/**
 * The site's desktop frame: a square sand border around the whole view. On
 * the homepage it is hidden while the intro plays and fades in when the site
 * "starts for real" — which is exactly the job it does here.
 */
export function SiteFrame({ at, thickness = 18 }: { at: number; thickness?: number }) {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + DUR.enter], [0, 1], clamp);
  if (o <= 0) return null;
  return <AbsoluteFill style={{ border: `${thickness}px solid ${color.sand}`, opacity: o, pointerEvents: "none" }} />;
}

export function ArrowUpRight({ size, stroke = 2.2 }: { size: number; stroke?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  );
}

/**
 * The hero CTA (HeroCtaButton): a cream pill with a forest chip, whose arrow
 * leaves through the top-right corner as a fresh one arrives from the
 * bottom-left — the site's hover, played on a loop.
 */
export function CtaPill({
  label,
  height = 108,
  enterAt,
  loopEvery = sec(2.2),
}: {
  label: string;
  height?: number;
  enterAt: number;
  loopEvery?: number;
}) {
  const frame = useCurrentFrame();
  const inP = interpolate(frame, [enterAt, enterAt + DUR.enter], [0, 1], { ...clamp, easing: EASE.enter });
  const since = frame - (enterAt + sec(0.9));
  const phase = since < 0 ? 0 : since % loopEvery;
  const swap = interpolate(phase, [0, sec(0.4)], [0, 1], { ...clamp, easing: EASE.enter });
  const chip = height - 16;
  const travel = chip * 0.45;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: height * 0.26,
        height,
        padding: `0 8px 0 ${height * 0.4}px`,
        borderRadius: height,
        background: color.cream,
        color: color.forest,
        opacity: inP,
        transform: `translateY(${(1 - inP) * 20}px) scale(${0.97 + inP * 0.03})`,
      }}
    >
      <span style={{ fontFamily: font.body, fontWeight: 600, fontSize: height * 0.31, letterSpacing: "0.02em" }}>{label}</span>
      <span
        style={{
          position: "relative",
          width: chip,
          height: chip,
          borderRadius: chip,
          overflow: "hidden",
          background: color.forest,
          color: color.cream,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ position: "absolute", transform: `translate(${swap * travel}px, ${-swap * travel}px)`, opacity: 1 - swap }}>
          <ArrowUpRight size={chip * 0.4} />
        </span>
        <span
          style={{
            position: "absolute",
            transform: `translate(${(swap - 1) * travel}px, ${(1 - swap) * travel}px)`,
            opacity: swap,
          }}
        >
          <ArrowUpRight size={chip * 0.4} />
        </span>
      </span>
    </div>
  );
}

/**
 * The rotating stamp (RotatingBadge): ring text turning once every 16s
 * around a chip. On a forest ground the chip takes the site's hover colours,
 * sage with a forest arrow, so it does not sink into the background.
 */
export function RotatingBadge({ size, label, enterAt }: { size: number; label: string; enterAt: number }) {
  const frame = useCurrentFrame();
  const id = useId().replace(/:/g, "");
  const inP = interpolate(frame, [enterAt, enterAt + DUR.editorial], [0, 1], { ...clamp, easing: EASE.editorial });
  const r = size / 2 - size * 0.14;
  const circumference = 2 * Math.PI * r;
  const fontSize = size * 0.074;
  const unit = `${label}  •  `;
  const repeats = Math.max(2, Math.round(circumference / (unit.length * fontSize * 0.7)));
  const rotation = (frame / sec(16)) * 360;
  const inset = size * 0.27;
  return (
    <div style={{ position: "relative", width: size, height: size, opacity: inP, transform: `scale(${0.8 + inP * 0.2})` }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: 0, transform: `rotate(${rotation}deg)` }}>
        <defs>
          <path id={id} d={`M ${size / 2},${size / 2} m -${r},0 a ${r},${r} 0 1,1 ${r * 2},0 a ${r},${r} 0 1,1 -${r * 2},0`} />
        </defs>
        <text
          fill="rgba(242,240,235,0.78)"
          fontFamily={font.display}
          fontWeight={600}
          fontSize={fontSize}
          letterSpacing={fontSize * 0.15}
          textLength={circumference - fontSize * 0.5}
          lengthAdjust="spacing"
        >
          <textPath href={`#${id}`}>{unit.repeat(repeats).toUpperCase()}</textPath>
        </text>
      </svg>
      <div
        style={{
          position: "absolute",
          inset,
          borderRadius: size,
          background: color.sage,
          color: color.forest,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 28px rgba(0,0,0,0.3)",
        }}
      >
        <ArrowUpRight size={size * 0.16} />
      </div>
    </div>
  );
}
