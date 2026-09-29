// A phone showing the real new site — captures from scripts/capture-site.mjs,
// scrolled, with the site's own Fitted Run playing between pages exactly as it
// does when you tap through the navigation.
import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { siteCaptureHeight, type SiteScreen } from "../brand/copy";
import { font } from "../brand/fonts";
import { color, EASE } from "../brand/tokens";
import { FittedRun, type RunPlate } from "./FittedRun";

/** The capture viewport, in CSS px (an iPhone 14/15-class screen). */
const CSS_W = 390;
const CSS_H = 844;
const STATUS_H = 47;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * How each page's top looks — sampled from the captures, so the status bar
 * carries the page's own colour the way Safari tints it.
 */
const SCREEN_CHROME: Record<SiteScreen, { top: string; ink: "light" | "dark"; navbar: boolean }> = {
  home: { top: "linear-gradient(90deg, #2a2c27, #1e1e1c)", ink: "light", navbar: true },
  services: { top: "#1e1e1c", ink: "light", navbar: true },
  portfolio: { top: "#1a2322", ink: "light", navbar: true },
  booking: { top: "#f1f0eb", ink: "dark", navbar: false },
};

// The navbar's two floating chips (logo, menu), in CSS px. They are fixed on
// the real site, so they stay put while the page scrolls under them.
const NAV_CHIPS = [
  { x: 16, y: 16, w: 88, h: 48 },
  { x: 325, y: 16, w: 49, h: 48 },
] as const;

export function phoneSize(width: number) {
  const bezel = width * 0.034;
  const screenW = width - bezel * 2;
  const s = screenW / CSS_W;
  const screenH = CSS_H * s;
  return { width, height: screenH + bezel * 2, bezel, screenW, screenH, s };
}

export function PhoneFrame({ width, children }: { width: number; children: ReactNode }) {
  const { height, bezel, screenW, screenH, s } = phoneSize(width);
  const outerR = width * 0.155;
  return (
    <div style={{ position: "relative", width, height }}>
      {/* Side buttons */}
      {[
        { side: "left", top: 0.2, h: 0.045 },
        { side: "left", top: 0.28, h: 0.07 },
        { side: "left", top: 0.37, h: 0.07 },
        { side: "right", top: 0.3, h: 0.1 },
      ].map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            [b.side]: -width * 0.008,
            top: height * b.top,
            width: width * 0.012,
            height: height * b.h,
            borderRadius: width * 0.01,
            background: "#26262a",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: outerR,
          background: "linear-gradient(145deg, #34343a 0%, #16161a 45%, #0f0f11 100%)",
          boxShadow:
            "inset 0 0 0 2px rgba(255,255,255,0.09), 0 50px 90px -20px rgba(0,0,0,0.55), 0 20px 40px -10px rgba(0,0,0,0.35)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: bezel,
          top: bezel,
          width: screenW,
          height: screenH,
          borderRadius: outerR - bezel,
          overflow: "hidden",
          background: color.dark,
          isolation: "isolate",
        }}
      >
        {children}
        {/* Dynamic Island */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 11 * s,
            width: 124 * s,
            height: 36 * s,
            marginLeft: -62 * s,
            borderRadius: 18 * s,
            background: "#050506",
          }}
        />
      </div>
    </div>
  );
}

function StatusBar({ s, ink }: { s: number; ink: "light" | "dark" }) {
  const fg = ink === "light" ? "#ffffff" : "#111111";
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: STATUS_H * s, color: fg }}>
      <span
        style={{
          position: "absolute",
          left: 44 * s,
          top: 15 * s,
          fontFamily: font.body,
          fontWeight: 600,
          fontSize: 16 * s,
          letterSpacing: "-0.01em",
        }}
      >
        9:41
      </span>
      <svg
        viewBox="0 0 78 14"
        style={{ position: "absolute", right: 28 * s, top: 18 * s, width: 70 * s, height: 12.5 * s }}
        fill="currentColor"
      >
        {/* Signal */}
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={i * 5} y={10 - i * 3} width={3.4} height={4 + i * 3} rx={1} />
        ))}
        {/* Wi-Fi */}
        <path d="M31 4.2a10 10 0 0 1 14 0l-1.5 1.5a7.9 7.9 0 0 0-11 0z" />
        <path d="M33.6 6.9a6.3 6.3 0 0 1 8.8 0l-1.5 1.5a4.2 4.2 0 0 0-5.8 0z" />
        <path d="M36.3 9.6a2.4 2.4 0 0 1 3.4 0L38 11.3z" />
        {/* Battery */}
        <rect x={52} y={1.5} width={22} height={11} rx={3} fill="none" stroke="currentColor" strokeOpacity={0.45} strokeWidth={1.2} />
        <rect x={54} y={3.5} width={16} height={7} rx={1.6} />
        <rect x={75.2} y={5.2} width={1.6} height={3.8} rx={0.8} opacity={0.45} />
      </svg>
    </div>
  );
}

/** One page of the site in the phone, scrolling between two points. */
function SitePage({
  screen,
  s,
  scroll,
}: {
  screen: SiteScreen;
  s: number;
  /** Current scroll position in CSS px. */
  scroll: number;
}) {
  const chrome = SCREEN_CHROME[screen];
  const src = staticFile(`site/${screen}.jpg`);
  const pageW = CSS_W * s;
  const pageH = siteCaptureHeight[screen] * s;
  return (
    <AbsoluteFill style={{ background: chrome.top }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: STATUS_H * s,
          width: pageW,
          bottom: 0,
          overflow: "hidden",
        }}
      >
        <Img src={src} style={{ display: "block", width: pageW, height: pageH, transform: `translateY(${-scroll * s}px)` }} />
        {chrome.navbar &&
          NAV_CHIPS.map((chip, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: chip.x * s,
                top: chip.y * s,
                width: chip.w * s,
                height: chip.h * s,
                borderRadius: 14 * s,
                backgroundImage: `url(${src})`,
                backgroundSize: `${pageW}px ${pageH}px`,
                backgroundPosition: `${-chip.x * s}px ${-chip.y * s}px`,
                boxShadow: scroll > 4 ? "0 6px 18px rgba(0,0,0,0.18)" : undefined,
              }}
            />
          ))}
      </div>
      <StatusBar s={s} ink={chrome.ink} />
    </AbsoluteFill>
  );
}

export interface TourStop {
  screen: SiteScreen;
  /** Frame this page is revealed (the run opens on it). */
  from: number;
  scroll: readonly [number, number];
  /** The run's plate on the way in — the page's place in the site's navigation. */
  plate?: RunPlate;
}

/**
 * Pages of the site, one after another. Between stops the site's Fitted Run
 * closes over the screen, the page swaps behind it, and it opens again.
 */
export function PhoneTour({ width, stops, until }: { width: number; stops: readonly TourStop[]; until: number }) {
  const frame = useCurrentFrame();
  const { s } = phoneSize(width);
  const RUN_TEMPO = 0.85;
  const closeLead = 24; // frames from the run starting to close to it opening

  // The page on screen changes only once the run has fully closed over it.
  let current = 0;
  stops.forEach((stop, i) => {
    if (i > 0 && frame >= stop.from - 8) current = i;
  });
  const stop = stops[current];
  const next = stops[current + 1];
  const scrollEnd = next ? next.from - closeLead : until;
  const scroll = interpolate(frame, [stop.from + 4, scrollEnd], stop.scroll as [number, number], { ...clamp, easing: EASE.drift });

  return (
    <PhoneFrame width={width}>
      <SitePage screen={stop.screen} s={s} scroll={scroll} />
      {stops.slice(1).map((st, i) => (
        <FittedRun
          key={i}
          closeAt={st.from - closeLead}
          openAt={st.from}
          plate={st.plate}
          tempo={RUN_TEMPO}
          scale={s * 0.42}
          padX={20 * s}
        />
      ))}
    </PhoneFrame>
  );
}
