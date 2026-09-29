// Flat, outlined illustrations for the kinetic cut, in the reference's
// manner: thick ink outlines, hard shadows, flat fills — drawn in Enzo's
// colours and about Enzo's work.
import type { ReactNode } from "react";
import { Img, interpolate, random, staticFile, useCurrentFrame } from "remotion";
import { font } from "../brand/fonts";
import { k } from "./palette";
import { mono, wide } from "./type";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const LOGO_ASPECT = 2622 / 1327;

// ── Icons (24-unit grid, drawn for this film) ────────────────────────────

function Icon({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export const icons = {
  kitchen: (s: number) => (
    <Icon size={s}>
      <rect x="3" y="9" width="18" height="12" rx="1.5" />
      <path d="M3 13h18M12 13v8M9 17h0M15 17h0" />
      <circle cx="8" cy="5.5" r="1.8" />
      <circle cx="16" cy="5.5" r="1.8" />
    </Icon>
  ),
  bedroom: (s: number) => (
    <Icon size={s}>
      <path d="M3 19V6M3 14h18v5M21 14v-2a3 3 0 0 0-3-3h-7v5" />
      <circle cx="7" cy="10.5" r="1.8" />
    </Icon>
  ),
  mediaWall: (s: number) => (
    <Icon size={s}>
      <rect x="3" y="4" width="18" height="11" rx="1.5" />
      <path d="M8 20h8M12 15v5" />
    </Icon>
  ),
  wardrobe: (s: number) => (
    <Icon size={s}>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M12 3v18M10 10v3M14 10v3" />
    </Icon>
  ),
  rooms: (s: number) => (
    <Icon size={s}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m3 16 5-5 4 4 3-3 6 6" />
      <circle cx="16" cy="8" r="1.6" />
    </Icon>
  ),
  pound: (s: number) => (
    <Icon size={s}>
      <path d="M17 19H7c2-1.5 2.5-3 2.5-5.5V9a3.5 3.5 0 0 1 6.5-1.8M7 13h7" />
    </Icon>
  ),
  calendar: (s: number) => (
    <Icon size={s}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4M8 15l2.5 2.5L16 13" />
    </Icon>
  ),
};

// ── The Enzo logo in a tile, like the reference's logo card ──────────────

export function LogoTile({ width = 380 }: { width?: number }) {
  const logoW = width * 0.78;
  return (
    <div
      style={{
        width,
        padding: `${width * 0.1}px 0`,
        display: "flex",
        justifyContent: "center",
        background: k.white,
        border: `6px solid ${k.ink}`,
        borderRadius: width * 0.08,
        boxShadow: `${width * 0.04}px ${width * 0.04}px 0 ${k.ink}`,
      }}
    >
      <Img src={staticFile("brand/enzo-forest.png")} style={{ width: logoW, height: logoW / LOGO_ASPECT }} />
    </div>
  );
}

// ── Hook: the brochure ────────────────────────────────────────────────────

/**
 * The thing Enzo was started to replace: a kitchen chosen from a brochure,
 * priced before anyone has seen the room. "One size fits all" is printed
 * across it; the next scene measures it.
 */
export function Brochure({ width = 540 }: { width?: number }) {
  const frame = useCurrentFrame();
  const u = width / 540;
  return (
    <div
      style={{
        position: "relative",
        width,
        height: 700 * u,
        background: k.white,
        border: `${7 * u}px solid ${k.ink}`,
        borderRadius: 20 * u,
        boxShadow: `${18 * u}px ${18 * u}px 0 ${k.ink}`,
      }}
    >
      <div style={{ height: 96 * u, background: k.sand, borderBottom: `${6 * u}px solid ${k.ink}`, borderRadius: `${13 * u}px ${13 * u}px 0 0`, display: "flex", alignItems: "center", padding: `0 ${26 * u}px` }}>
        <span style={{ ...wide(38 * u), color: k.ink }}>Kitchens</span>
      </div>
      {/* A catalogue kitchen: the same run of boxes for every room. */}
      <svg viewBox="0 0 520 250" style={{ display: "block", width: "100%", height: 250 * u, background: k.sageLight }}>
        <g stroke={k.ink} strokeWidth="6" fill={k.white} strokeLinejoin="round">
          <rect x="40" y="40" width="440" height="60" rx="6" />
          <line x1="150" y1="40" x2="150" y2="100" />
          <line x1="260" y1="40" x2="260" y2="100" />
          <line x1="370" y1="40" x2="370" y2="100" />
          <rect x="40" y="140" width="440" height="90" rx="6" />
          <line x1="40" y1="162" x2="480" y2="162" />
          <line x1="150" y1="162" x2="150" y2="230" />
          <line x1="260" y1="162" x2="260" y2="230" />
          <line x1="370" y1="162" x2="370" y2="230" />
          <rect x="285" y="148" width="60" height="8" rx="4" fill={k.ink} />
        </g>
      </svg>
      <div style={{ background: k.forest, borderTop: `${6 * u}px solid ${k.ink}`, borderBottom: `${6 * u}px solid ${k.ink}`, padding: `${16 * u}px 0`, textAlign: "center", ...wide(34 * u), color: k.cream }}>
        One size fits all
      </div>
      <div style={{ padding: `${26 * u}px ${30 * u}px 0` }}>
        {[0.92, 0.78, 0.86].map((w, i) => (
          <div key={i} style={{ height: 14 * u, width: `${w * 100}%`, borderRadius: 8, background: "rgba(11,35,32,0.14)", marginBottom: 14 * u }} />
        ))}
        <div style={{ marginTop: 18 * u, ...wide(44 * u), color: k.ink }}>From £?,???</div>
      </div>
      {/* The "SALE!" starburst, turning slowly. */}
      <div style={{ position: "absolute", top: -54 * u, right: -54 * u, width: 150 * u, height: 150 * u, transform: `rotate(${frame * 1.5}deg)` }}>
        <svg viewBox="-50 -50 100 100" width="100%" height="100%">
          <polygon
            points={Array.from({ length: 24 }, (_, i) => {
              const r = i % 2 ? 36 : 48;
              const a = (i / 24) * Math.PI * 2;
              return `${Math.cos(a) * r},${Math.sin(a) * r}`;
            }).join(" ")}
            fill={k.sage}
            stroke={k.ink}
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", ...wide(28 * u), color: k.ink, transform: `rotate(${-frame * 1.5 - 12}deg)` }}>
          Sale!
        </div>
      </div>
    </div>
  );
}

/** A dimension line drawing itself across whatever it sits over. */
export function DimensionLine({ at, width, label }: { at: number; width: number; label: string }) {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const p = interpolate(frame, [at, at + 8], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) });
  const labelIn = interpolate(frame, [at + 6, at + 10], [0, 1], clamp);
  return (
    <div style={{ position: "relative", width, height: 70 }}>
      <div style={{ position: "absolute", left: 0, top: 33, height: 6, width: width * p, background: k.ink }} />
      <div style={{ position: "absolute", left: 0, top: 12, width: 6, height: 48, background: k.ink }} />
      {p >= 1 && <div style={{ position: "absolute", right: 0, top: 12, width: 6, height: 48, background: k.ink }} />}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          transform: `translateX(-50%) scale(${labelIn})`,
          padding: "10px 22px",
          background: k.sand,
          border: `5px solid ${k.ink}`,
          borderRadius: 12,
          ...mono(34),
          color: k.ink,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// ── Signs ────────────────────────────────────────────────────────────────

/** A price that will not sit still: a quote guessed over the phone. */
export function GuessedQuote({ width = 820 }: { width?: number }) {
  const frame = useCurrentFrame();
  const digits = Array.from({ length: 4 }, (_, i) => Math.floor(random(`g${i}-${Math.floor(frame / 2)}`) * 10));
  const accuracy = interpolate(frame, [4, 20], [0, 3], clamp);
  return (
    <div style={{ width, padding: 40, background: k.white, border: `6px solid ${k.ink}`, borderRadius: 26, boxShadow: `16px 16px 0 ${k.ink}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ ...wide(44), color: k.ink }}>Quote</span>
        <span style={{ ...mono(22), color: "rgba(11,35,32,0.7)" }}>Over the phone</span>
      </div>
      <div style={{ marginTop: 20, ...wide(140), color: k.ink, fontVariantNumeric: "tabular-nums" }}>
        £{digits[0]},{digits[1]}
        {digits[2]}
        {digits[3]}
      </div>
      <div style={{ marginTop: 26, display: "flex", justifyContent: "space-between", ...mono(24), color: k.ink }}>
        <span>Accuracy</span>
        <span>{Math.round(accuracy)}%</span>
      </div>
      <div style={{ marginTop: 12, height: 34, border: `5px solid ${k.ink}`, borderRadius: 10, background: k.cream, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${accuracy}%`, background: k.forest }} />
      </div>
    </div>
  );
}

/** A room nobody measured: the dimensions are question marks. */
export function Unmeasured({ width = 820 }: { width?: number }) {
  const frame = useCurrentFrame();
  const q = (at: number) => interpolate(frame, [at, at + 4], [0, 1], clamp);
  return (
    <div style={{ position: "relative", width, height: 560 }}>
      <svg viewBox="0 0 820 560" width={width} height={560}>
        <g stroke={k.ink} strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <rect x="120" y="60" width="600" height="400" rx="6" fill={k.white} />
          <line x1="120" y1="420" x2="720" y2="420" strokeWidth="4" opacity="0.4" />
          <rect x="520" y="140" width="130" height="190" rx="4" fill={k.sageLight} />
          <line x1="585" y1="140" x2="585" y2="330" strokeWidth="4" />
          <line x1="120" y1="515" x2="720" y2="515" strokeWidth="5" />
          <line x1="120" y1="498" x2="120" y2="532" strokeWidth="5" />
          <line x1="720" y1="498" x2="720" y2="532" strokeWidth="5" />
          <line x1="60" y1="60" x2="60" y2="460" strokeWidth="5" />
          <line x1="43" y1="60" x2="77" y2="60" strokeWidth="5" />
          <line x1="43" y1="460" x2="77" y2="460" strokeWidth="5" />
        </g>
      </svg>
      {[
        { x: 420, y: 515, at: 8, text: "??? MM" },
        { x: 60, y: 260, at: 12, text: "???", rot: -90 },
        { x: 300, y: 230, at: 16, text: "?", big: true },
      ].map((m, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: m.x,
            top: m.y,
            transform: `translate(-50%, -50%) rotate(${m.rot ?? -6}deg) scale(${q(m.at)})`,
            padding: m.big ? "6px 30px" : "8px 18px",
            background: m.big ? k.sage : k.sand,
            border: `5px solid ${k.ink}`,
            borderRadius: 12,
            ...(m.big ? wide(110) : mono(30)),
            color: k.ink,
          }}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}

/** A straight carcass against a wall that is not, with the gap called out. */
export function CrookedWall({ width = 820 }: { width?: number }) {
  const frame = useCurrentFrame();
  const call = interpolate(frame, [10, 15], [0, 1], clamp);
  return (
    <div style={{ position: "relative", width, height: 600 }}>
      <svg viewBox="0 0 820 600" width={width} height={600}>
        <defs>
          <pattern id="gap-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="14" height="14" fill={k.sand} />
            <line x1="0" y1="0" x2="0" y2="14" stroke={k.ink} strokeWidth="5" />
          </pattern>
        </defs>
        <g stroke={k.ink} strokeWidth="7" strokeLinejoin="round" strokeLinecap="round">
          {/* The wall, leaning out as it rises. */}
          <polygon points="600,560 660,560 700,40 640,40" fill={k.sageLight} />
          {/* The gap between a square carcass and that wall. */}
          <polygon points="560,120 640,40 600,560 560,560" fill="url(#gap-hatch)" strokeWidth="0" />
          <rect x="140" y="120" width="420" height="440" rx="6" fill={k.white} />
          <line x1="350" y1="120" x2="350" y2="560" />
          <line x1="320" y1="300" x2="320" y2="380" strokeWidth="10" />
          <line x1="380" y1="300" x2="380" y2="380" strokeWidth="10" />
          <line x1="80" y1="560" x2="760" y2="560" strokeWidth="8" />
        </g>
      </svg>
      <div
        style={{
          position: "absolute",
          left: 520,
          top: 30,
          transform: `rotate(-6deg) scale(${call})`,
          transformOrigin: "20% 100%",
          padding: "12px 22px",
          background: k.white,
          border: `5px solid ${k.ink}`,
          borderRadius: 14,
          boxShadow: `8px 8px 0 ${k.ink}`,
          ...wide(40),
          color: k.ink,
        }}
      >
        14 mm gap
      </div>
    </div>
  );
}

/** A call screen, for the phone: who is calling and the two buttons. */
export function CallScreen({ label, name, avatar, answered = false }: { label: string; name: string; avatar: ReactNode; answered?: boolean }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "22%" }}>
      <div style={{ ...mono(20, 500), color: "rgba(242,240,235,0.7)" }}>{label}</div>
      <div style={{ marginTop: 16, ...wide(46), color: k.cream }}>{name}</div>
      <div style={{ marginTop: 44, width: 150, height: 150, borderRadius: 99, background: answered ? k.forest : "#27352f", border: `5px solid ${k.cream}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {avatar}
      </div>
      <div style={{ position: "absolute", bottom: "12%", left: 0, right: 0, display: "flex", justifyContent: "space-evenly" }}>
        {[k.sand, k.sage].map((c, i) => (
          <div key={i} style={{ width: 84, height: 84, borderRadius: 99, background: c, border: `5px solid ${k.cream}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke={k.ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: i === 0 ? "rotate(135deg)" : undefined }}>
              <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The written quote: every line ticked, the total fixed. */
export function WrittenQuote({ at, width = 860 }: { at: number; width?: number }) {
  const frame = useCurrentFrame();
  const rows = [
    ["Home survey", "Free"],
    ["3D design", "Included"],
    ["Made in Leicester", "Included"],
    ["Fitted by our team", "Included"],
    ["Workmanship guarantee", "5 years"],
  ];
  return (
    <div style={{ width, padding: "38px 44px", background: k.white, border: `6px solid ${k.ink}`, borderRadius: 26, boxShadow: `16px 16px 0 ${k.ink}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `5px solid ${k.ink}`, paddingBottom: 18 }}>
        <span style={{ ...wide(48), color: k.ink }}>Quote</span>
        <span style={{ ...mono(22), color: "rgba(11,35,32,0.7)" }}>After the survey</span>
      </div>
      {rows.map(([label, value], i) => {
        const tick = interpolate(frame, [at + i * 3, at + i * 3 + 4], [0, 1], clamp);
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "3px solid rgba(11,35,32,0.12)", opacity: interpolate(tick, [0, 0.3], [0.25, 1], clamp) }}>
            <span style={{ fontFamily: font.body, fontWeight: 600, fontSize: 32, color: k.ink }}>{label}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ ...mono(22), color: "rgba(11,35,32,0.7)" }}>{value}</span>
              <svg viewBox="0 0 24 24" width="34" height="34" style={{ transform: `scale(${tick})` }}>
                <circle cx="12" cy="12" r="11" fill={k.sage} stroke={k.ink} strokeWidth="2.2" />
                <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke={k.ink} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        );
      })}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 22,
          opacity: interpolate(frame, [at + 17, at + 20], [0, 1], clamp),
          transform: `scale(${interpolate(frame, [at + 17, at + 21], [1.25, 1], clamp)})`,
          transformOrigin: "0 50%",
        }}
      >
        <span style={{ ...wide(40), color: k.ink }}>Total</span>
        <span style={{ ...wide(40), color: k.forest }}>Fixed, in writing</span>
      </div>
    </div>
  );
}
