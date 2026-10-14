// The kinetic cut's building blocks — the reference reel's grammar, in Enzo's
// palette and type:
//
//   Sweep    a giant tilted word whipping across the frame to open a scene
//   Word     a line that pops in on the beat (solid or outlined)
//   Sticker  a word that slams in huge and snaps into a tilted, outlined box
//            with a hard offset shadow
//   Chip     a small pill label ("SIGN 1/4")
//   Card / CheckItem   list rows that fly in from the side, one per beat
//   Ribbon   a tilted marquee band
//   PhoneMock, Burst, Seal, Flash, Wedge
//
// Everything is positioned on a 1080×1500 stage that scales to the frame, so
// one scene serves the 9:16 Reel and the 4:5 post.
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { font } from "../brand/fonts";
import { k } from "./palette";
import { fitWide, mono, wide, wideWidth } from "./type";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ── Motion ────────────────────────────────────────────────────────────────

/** The slam: lands in about six frames, overshooting a touch. */
export function useSlam(at: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return {
    shown: frame >= at,
    t: spring({ frame: frame - at, fps, config: { damping: 11, stiffness: 340, mass: 0.55 } }),
  };
}

/** The pop: quicker and flatter than a slam, for plain words. */
export function usePop(at: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return {
    shown: frame >= at,
    t: spring({ frame: frame - at, fps, config: { damping: 15, stiffness: 420, mass: 0.45 } }),
  };
}

/** A slow float, so nothing on screen is ever quite still. */
export function useBob(amount = 1, seed = 0) {
  const frame = useCurrentFrame();
  return {
    y: Math.sin((frame + seed * 13) / 14) * 7 * amount,
    r: Math.sin((frame + seed * 7) / 21) * 0.9 * amount,
  };
}

// ── Stage and grounds ─────────────────────────────────────────────────────

export const STAGE = { w: 1080, h: 1500, pad: 72 } as const;

/** Scales the 1080×1500 stage to fit the frame, centred. */
export function Stage({ children }: { children: ReactNode }) {
  const { width, height } = useVideoConfig();
  const scale = Math.min(width / STAGE.w, height / STAGE.h);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: (width - STAGE.w * scale) / 2,
          top: (height - STAGE.h * scale) / 2,
          width: STAGE.w,
          height: STAGE.h,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
}

export function GroundFill({ color, pattern, dark }: { color: string; pattern: "dots" | "grid" | "none"; dark?: boolean }) {
  const ink = dark ? "rgba(242,240,235,0.09)" : "rgba(11,35,32,0.15)";
  const line = dark ? "rgba(242,240,235,0.06)" : "rgba(11,35,32,0.07)";
  const backgroundImage =
    pattern === "dots"
      ? `radial-gradient(circle, ${ink} 2.2px, transparent 2.8px)`
      : pattern === "grid"
        ? `linear-gradient(${line} 2px, transparent 2px), linear-gradient(90deg, ${line} 2px, transparent 2px)`
        : undefined;
  return (
    <AbsoluteFill style={{ backgroundColor: color, backgroundImage, backgroundSize: pattern === "dots" ? "30px 30px" : "60px 60px" }}>
      {pattern === "grid" &&
        // The reference's registration crosses, one near each corner.
        [
          [44, 44],
          [1, 44],
          [44, 1],
          [1, 1],
        ].map(([x, y], i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              [x === 1 ? "right" : "left"]: 44,
              [y === 1 ? "bottom" : "top"]: 44,
              width: 26,
              height: 26,
              backgroundImage: `linear-gradient(${ink}, ${ink}), linear-gradient(${ink}, ${ink})`,
              backgroundSize: "2px 100%, 100% 2px",
              backgroundPosition: "center, center",
              backgroundRepeat: "no-repeat",
            }}
          />
        ))}
    </AbsoluteFill>
  );
}

// ── Placement ─────────────────────────────────────────────────────────────

/** A row on the stage at `top`, centred or ranged left on the margin. */
export function Row({ top, align = "center", x = STAGE.pad, children, style }: { top: number; align?: "center" | "left"; x?: number; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: align === "center" ? 0 : x,
        right: align === "center" ? 0 : undefined,
        display: "flex",
        justifyContent: align === "center" ? "center" : "flex-start",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Type ──────────────────────────────────────────────────────────────────

export function Word({
  text,
  at,
  size,
  maxW = STAGE.w - STAGE.pad * 2,
  color = k.ink,
  outline = false,
  origin = "center",
}: {
  text: string;
  at: number;
  size: number;
  maxW?: number;
  color?: string;
  outline?: boolean;
  origin?: "center" | "left";
}) {
  const { shown, t } = usePop(at);
  if (!shown) return null;
  const s = fitWide(text, maxW, size);
  return (
    <div
      style={{
        ...wide(s),
        color: outline ? "transparent" : color,
        WebkitTextStroke: outline ? `${Math.max(3, s * 0.03)}px ${color}` : undefined,
        transform: `scale(${interpolate(t, [0, 1], [1.4, 1])})`,
        transformOrigin: origin === "center" ? "50% 60%" : "0% 60%",
        opacity: interpolate(t, [0, 0.25], [0, 1], clamp),
      }}
    >
      {text}
    </div>
  );
}

export function Sticker({
  text,
  at,
  size,
  maxW = STAGE.w - STAGE.pad * 2,
  fill = k.white,
  textColor = k.ink,
  rotate = -3,
  shadow = k.ink,
  border = k.ink,
  from = 2.7,
  origin = "center",
}: {
  text: string;
  at: number;
  size: number;
  maxW?: number;
  fill?: string;
  textColor?: string;
  rotate?: number;
  shadow?: string;
  border?: string;
  /** Scale it slams in from. */
  from?: number;
  origin?: "center" | "left";
}) {
  const { shown, t } = useSlam(at);
  if (!shown) return null;
  // Fit the words inside the box's own padding (0.28em a side) and border.
  const s = Math.min(size, maxW / (wideWidth(text, 1) + 0.56 + 0.12));
  const b = Math.max(4, Math.round(s * 0.055));
  const sh = Math.max(6, Math.round(s * 0.09));
  return (
    <div
      style={{
        ...wide(s),
        color: textColor,
        background: fill,
        border: `${b}px solid ${border}`,
        borderRadius: s * 0.16,
        padding: "0.14em 0.28em 0.1em",
        boxShadow: `${sh}px ${sh}px 0 ${shadow}`,
        transform: `rotate(${rotate + (1 - t) * rotate * 2.2}deg) scale(${interpolate(t, [0, 1], [from, 1])})`,
        transformOrigin: origin === "center" ? "50% 50%" : "20% 50%",
      }}
    >
      {text}
    </div>
  );
}

export function Chip({
  text,
  at,
  size = 26,
  fill = k.ink,
  textColor = k.cream,
  rotate = -5,
  border,
  dot,
}: {
  text: string;
  at: number;
  size?: number;
  fill?: string;
  textColor?: string;
  rotate?: number;
  border?: string;
  /** A small status dot before the words, like "● NOW TAKING…". */
  dot?: string;
}) {
  const { shown, t } = usePop(at);
  if (!shown) return null;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.45,
        ...wide(size),
        fontWeight: 800,
        color: textColor,
        background: fill,
        border: border ? `${Math.max(3, size * 0.12)}px solid ${border}` : undefined,
        borderRadius: 999,
        padding: `${size * 0.42}px ${size * 0.8}px`,
        transform: `rotate(${rotate}deg) scale(${interpolate(t, [0, 1], [0.4, 1])})`,
      }}
    >
      {dot && <span style={{ width: size * 0.42, height: size * 0.42, borderRadius: 99, background: dot }} />}
      {text}
    </div>
  );
}

/** A giant tilted word whipping across the whole frame — a scene's opening. */
export function Sweep({ text, at, dur = 9, color, size = 360, top = 0.3, rotate = -8 }: { text: string; at: number; dur?: number; color: string; size?: number; top?: number; rotate?: number }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (frame < at || frame > at + dur) return null;
  const w = wideWidth(text, size);
  const x = interpolate(frame, [at, at + dur], [width * 0.15, -w - width * 0.1]);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: height * top - size / 2,
          left: 0,
          ...wide(size),
          color,
          transform: `translateX(${x}px) rotate(${rotate}deg)`,
          transformOrigin: "0 50%",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

// ── Bands, cards, lists ───────────────────────────────────────────────────

/** A marquee band, tilted, running continuously. Frame coordinates. */
export function Ribbon({
  text,
  at,
  top,
  rotate = -5,
  fill = k.sage,
  textColor = k.ink,
  size = 34,
  speed = 7,
  reverse = false,
}: {
  text: string;
  at: number;
  top: number;
  rotate?: number;
  fill?: string;
  textColor?: string;
  size?: number;
  speed?: number;
  reverse?: boolean;
}) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  if (frame < at) return null;
  const unit = `${text} + `;
  const unitW = wideWidth(unit, size);
  const repeats = Math.ceil((width * 1.8) / unitW) + 2;
  const offset = ((frame - at) * speed) % unitW;
  const enter = interpolate(frame, [at, at + 6], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: -width * 0.3,
        width: width * 1.6,
        overflow: "hidden",
        background: fill,
        borderTop: `4px solid ${k.ink}`,
        borderBottom: `4px solid ${k.ink}`,
        padding: `${size * 0.42}px 0`,
        transform: `rotate(${rotate}deg) scaleY(${enter})`,
      }}
    >
      <div style={{ ...wide(size), fontWeight: 800, color: textColor, transform: `translateX(${reverse ? offset - unitW : -offset}px)` }}>
        {unit.repeat(repeats)}
      </div>
    </div>
  );
}

export function Card({
  at,
  top,
  title,
  sub,
  icon,
  fill = k.white,
  from = "left",
  rotate = -1.5,
  width = STAGE.w - STAGE.pad * 2,
  height = 170,
  left = STAGE.pad,
  shadow = k.ink,
}: {
  at: number;
  top: number;
  title: string;
  sub: string;
  icon: ReactNode;
  fill?: string;
  from?: "left" | "right";
  rotate?: number;
  width?: number;
  height?: number;
  left?: number;
  shadow?: string;
}) {
  const { shown, t } = useSlam(at);
  if (!shown) return null;
  const dir = from === "left" ? -1 : 1;
  const tile = height * 0.62;
  const titleSize = fitWide(title, width - tile - height * 0.55, height * 0.3);
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width,
        height,
        display: "flex",
        alignItems: "center",
        gap: height * 0.2,
        padding: `0 ${height * 0.2}px`,
        background: fill,
        border: `5px solid ${k.ink}`,
        borderRadius: 22,
        boxShadow: `12px 12px 0 ${shadow}`,
        transform: `translateX(${(1 - t) * dir * 1300}px) rotate(${rotate + (1 - t) * dir * 8}deg)`,
      }}
    >
      <div
        style={{
          width: tile,
          height: tile,
          flexShrink: 0,
          borderRadius: 16,
          border: `4px solid ${k.ink}`,
          background: k.cream,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: k.ink,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ ...wide(titleSize), color: k.ink }}>{title}</div>
        <div style={{ marginTop: height * 0.07, fontFamily: font.body, fontWeight: 600, fontSize: height * 0.17, color: "rgba(11,35,32,0.78)" }}>{sub}</div>
      </div>
    </div>
  );
}

export function CheckItem({ at, top, label, fill = k.white, width = 780, height = 104, left = STAGE.pad }: { at: number; top: number; label: string; fill?: string; width?: number; height?: number; left?: number }) {
  const frame = useCurrentFrame();
  const { shown, t } = useSlam(at);
  if (!shown) return null;
  const tick = interpolate(frame, [at + 3, at + 9], [0, 1], clamp);
  const box = height * 0.56;
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width,
        height,
        display: "flex",
        alignItems: "center",
        gap: height * 0.26,
        padding: `0 ${height * 0.24}px`,
        background: fill,
        border: `5px solid ${k.ink}`,
        borderRadius: 16,
        boxShadow: `10px 10px 0 ${k.ink}`,
        transform: `translateX(${(1 - t) * -900}px) rotate(${(1 - t) * -6}deg)`,
      }}
    >
      <svg viewBox="0 0 40 40" width={box} height={box} style={{ flexShrink: 0 }}>
        <rect x="3" y="3" width="34" height="34" rx="7" fill={k.cream} stroke={k.ink} strokeWidth="4" />
        <path d="M11 21 L18 28 L30 13" fill="none" stroke={k.ink} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - tick} />
      </svg>
      <div style={{ ...wide(fitWide(label, width - box - height, height * 0.46)), color: k.ink }}>{label}</div>
    </div>
  );
}

// ── Objects ───────────────────────────────────────────────────────────────

/** The reference's flat phone: thick outline, hard shadow, a notch pill. */
export function PhoneMock({ width = 440, screen = k.dark, shadow = k.ink, children }: { width?: number; screen?: string; shadow?: string; children?: ReactNode }) {
  const height = width * 2.04;
  const bezel = width * 0.035;
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderRadius: width * 0.14,
        background: k.ink,
        border: `${Math.max(5, width * 0.016)}px solid ${k.ink}`,
        boxShadow: `${width * 0.035}px ${width * 0.035}px 0 ${shadow}`,
      }}
    >
      <div style={{ position: "absolute", inset: bezel, borderRadius: width * 0.11, overflow: "hidden", background: screen, isolation: "isolate" }}>
        {children}
        <div
          style={{
            position: "absolute",
            top: width * 0.03,
            left: "50%",
            width: width * 0.3,
            height: width * 0.07,
            marginLeft: -width * 0.15,
            borderRadius: 99,
            background: k.ink,
          }}
        />
      </div>
    </div>
  );
}

/** Dots and squares thrown outward from a point — the logo reveal's burst. */
export function Burst({ at, cx, cy, count = 26, radius = 460, color = k.ink }: { at: number; cx: number; cy: number; count?: number; radius?: number; color?: string }) {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const t = interpolate(frame, [at, at + 22], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  const fade = interpolate(frame, [at + 12, at + 30], [1, 0], clamp);
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + random(`a${i}`) * 0.4;
        const d = 60 + t * radius * (0.45 + random(`d${i}`) * 0.55);
        const size = 8 + random(`s${i}`) * 14;
        const square = random(`q${i}`) > 0.5;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: cx + Math.cos(a) * d - size / 2,
              top: cy + Math.sin(a) * d - size / 2,
              width: size,
              height: size,
              borderRadius: square ? 2 : 99,
              border: `3px solid ${color}`,
              background: random(`f${i}`) > 0.6 ? color : "transparent",
              opacity: fade,
              transform: `rotate(${i * 23}deg)`,
            }}
          />
        );
      })}
    </>
  );
}

/** Concentric rings opening out from a point. */
export function Rings({ at, cx, cy, color = "rgba(11,35,32,0.25)" }: { at: number; cx: number; cy: number; color?: string }) {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <>
      {[0, 5, 10].map((delay, i) => {
        const r = interpolate(frame, [at + delay, at + delay + 30], [80, 620], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 2) });
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: cx - r,
              top: cy - r,
              width: r * 2,
              height: r * 2,
              borderRadius: "50%",
              border: `3px solid ${color}`,
              opacity: interpolate(frame, [at + delay, at + delay + 30], [1, 0.25], clamp),
            }}
          />
        );
      })}
    </>
  );
}

/** A round seal with ring text turning around a centre piece. */
export function Seal({ at, size, text, children }: { at: number; size: number; text: string; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { shown, t } = useSlam(at);
  if (!shown) return null;
  const r = size / 2 - size * 0.13;
  const fs = size * 0.085;
  const c = 2 * Math.PI * r;
  const id = `seal-${size}`;
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        background: k.white,
        border: `5px solid ${k.ink}`,
        boxShadow: `9px 9px 0 ${k.ink}`,
        transform: `scale(${interpolate(t, [0, 1], [0.2, 1])}) rotate(${(1 - t) * -90}deg)`,
      }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", inset: -5, transform: `rotate(${frame * 1.2}deg)` }}>
        <defs>
          <path id={id} d={`M ${size / 2},${size / 2} m -${r},0 a ${r},${r} 0 1,1 ${r * 2},0 a ${r},${r} 0 1,1 -${r * 2},0`} />
        </defs>
        <text style={{ ...wide(fs), fontWeight: 800 }} fill={k.ink} textLength={c - fs} lengthAdjust="spacing">
          <textPath href={`#${id}`}>{text}</textPath>
        </text>
      </svg>
      <div style={{ position: "absolute", inset: size * 0.25, borderRadius: "50%", background: k.forest, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

/** A white flash that clears in a few frames — a hard section change. */
export function Flash({ at, dur = 6, color = k.white }: { at: number; dur?: number; color?: string }) {
  const frame = useCurrentFrame();
  if (frame < at || frame > at + dur) return null;
  return <AbsoluteFill style={{ background: color, opacity: interpolate(frame, [at, at + dur], [1, 0]) }} />;
}

/** A dark wedge driving in from the right, covering the frame by `at + dur`. */
export function Wedge({ at, dur = 8, color = k.dark }: { at: number; dur?: number; color?: string }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  if (frame < at) return null;
  const x = interpolate(frame, [at, at + dur], [width * 1.1, -width * 0.25], { ...clamp, easing: (t) => t * t });
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "-20%", bottom: "-20%", left: x, width: width * 1.6, background: color, transform: "rotate(10deg)" }} />
    </AbsoluteFill>
  );
}

export { mono };
