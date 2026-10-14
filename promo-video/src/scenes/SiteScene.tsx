// Act two, on forest: the reveal, the site itself, and the close.
//
// The run opens onto "A new website, made to measure." — the site's own hero
// line with the word changed — then a phone rises carrying the real site and
// walks through it page by page, and finally steps aside for the end card.
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { company, endCard, reveal, siteTour, type SiteScreen } from "../brand/copy";
import { font, headingStyle } from "../brand/fonts";
import { color, DUR, EASE, ground, sec } from "../brand/tokens";
import { CtaPill, Logo, RotatingBadge } from "../components/Brand";
import { Headline, SwapHeadline } from "../components/Masked";
import { PhoneTour, type TourStop } from "../components/Phone";
import { type RuleBeat, RuleRow } from "../components/RuleRow";
import type { RunPlate } from "../components/FittedRun";
import { type Layout, wrapWords } from "../layout";
import { type LaunchProps, withStop } from "../props";

export interface SiteTimeline {
  /**
   * The reveal and the phone tour. Left out, the scene is just the close —
   * which is how the Story teaser uses it.
   */
  tour?: {
    /** The run has opened on this scene; the reveal headline lands. */
    reveal: number;
    /** The phone rises, on the homepage. */
    phoneIn: number;
    /** Frame each page of the tour is revealed (the first is phoneIn). */
    stops: readonly [number, number, number, number];
    /** Phone and headline leave. */
    siteEnd: number;
  };
  /** The end card starts. */
  end: number;
}

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Each page's run plate: its position in the site's navigation and its name,
// as PageTransition letters it. /booking sits outside the navigation, so
// the site numbers it one past the end and labels it with the firm's name.
const PLATES: Record<SiteScreen, RunPlate | undefined> = {
  home: undefined,
  services: { index: "02", label: "Services", imprint: company.imprint },
  portfolio: { index: "03", label: "Portfolio", imprint: company.imprint },
  booking: { index: "06", label: "Enzo Interiors", imprint: company.imprint },
};

/** Rule captions for the tour — each a true fact about the page on screen. */
const RULE: Record<SiteScreen, { index: string; label: string; datum: (p: LaunchProps) => string }> = {
  home: { index: "01", label: "Home", datum: (p) => p.domain },
  services: { index: "02", label: "Services", datum: () => "from £1,500" },
  portfolio: { index: "03", label: "Portfolio", datum: () => "9 rooms" },
  booking: { index: "06", label: "Booking", datum: () => "free, no obligation" },
};

/** Wraps each headline line for narrow columns while keeping its colour. */
function wrapHeadline(lines: readonly string[], colors: readonly string[], maxChars: number) {
  const out: string[] = [];
  const outColors: string[] = [];
  lines.forEach((line, i) => {
    for (const part of wrapWords(line, maxChars)) {
      out.push(part);
      outColors.push(colors[i] ?? colors[colors.length - 1]);
    }
  });
  return { lines: out, colors: outColors };
}

function FadeUp({ at, children, style }: { at: number; children: ReactNode; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + DUR.enter], [0, 1], { ...clamp, easing: EASE.enter });
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 16}px)`, ...style }}>{children}</div>;
}

export function SiteScene({ L, T, props }: { L: Layout; T: SiteTimeline; props: LaunchProps }) {
  const frame = useCurrentFrame();
  const E = L.end;
  const tourT = T.tour;

  // The closing headline is sized to fit whatever launch line is set.
  const endLines = [endCard.lead, withStop(props.launchLine)];
  const longest = Math.max(...endLines.map((l) => l.length));
  const endSize = Math.min(E.headSize, (L.width - L.padX * 2) / (longest * 0.53));

  const ruleBeats: RuleBeat[] = [
    ...(tourT
      ? [
          { from: tourT.reveal, index: reveal.index, label: reveal.label, datum: reveal.datum },
          ...siteTour.map((stop, i) => ({ from: tourT.stops[i], ...RULE[stop.screen], datum: RULE[stop.screen].datum(props) })),
        ]
      : []),
    // Numbered on from the tour; on its own (the Story) the close has no sequence to continue.
    { from: T.end, index: tourT ? endCard.index : undefined, label: endCard.label, datum: company.city },
  ];

  return (
    <AbsoluteFill style={{ background: ground.forest }}>
      <RuleRow
        beats={ruleBeats}
        drawAt={(tourT ? tourT.reveal : T.end) - 2}
        tone="dark"
        style={{ position: "absolute", left: L.padX, right: L.padX, top: L.ruleTop }}
      />

      {tourT && frame < tourT.siteEnd + sec(0.8) && <Tour L={L} T={tourT} />}

      {frame >= T.end - 2 && (
        <>
          <div style={{ position: "absolute", left: L.padX, top: E.logo.top }}>
            <Logo tone="white" width={E.logo.width} writeAt={T.end + 4} />
          </div>
          <div style={{ position: "absolute", right: L.padX, top: E.badge.top }}>
            <RotatingBadge size={E.badge.size} label={`New website  •  ${props.launchLine}`} enterAt={T.end + 18} />
          </div>
          <Headline
            lines={endLines}
            enterAt={T.end + 22}
            lineColors={[color.cream, color.sage]}
            style={{ position: "absolute", left: L.padX - endSize * 0.04, top: E.headTop, ...headingStyle(endSize) }}
          />
          <div style={{ position: "absolute", left: L.padX, top: E.pillTop }}>
            <CtaPill label={props.domain} height={E.pillHeight} enterAt={T.end + 40} />
          </div>
          <FadeUp
            at={T.end + 50}
            style={{
              position: "absolute",
              left: L.padX,
              top: E.followTop,
              fontFamily: font.body,
              fontSize: E.textSize,
              lineHeight: 1.4,
              color: "rgba(242,240,235,0.72)",
            }}
          >
            {endCard.follow.split("{handle}")[0]}
            <span style={{ color: color.cream, fontWeight: 600 }}>{props.handle}</span>
            {endCard.follow.split("{handle}")[1]}
          </FadeUp>
          <FadeUp
            at={T.end + 58}
            style={{
              position: "absolute",
              left: L.padX,
              right: L.padX,
              top: E.disciplinesTop,
              fontFamily: font.display,
              fontWeight: 600,
              fontSize: E.textSize * 0.62,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "rgba(212,201,181,0.85)",
            }}
          >
            {company.disciplines.join("  ·  ")}
          </FadeUp>
        </>
      )}
    </AbsoluteFill>
  );
}

/** The reveal headline, then the phone walking through the site. */
function Tour({ L, T }: { L: Layout; T: NonNullable<SiteTimeline["tour"]> }) {
  const frame = useCurrentFrame();
  const S = L.site;

  // Headlines: the reveal holds over the homepage, then one per page.
  // Archivo 600 tracked -0.045em sets at roughly 0.46em a character.
  const maxChars = Math.floor((L.width - L.padX * 2) / (S.head.size * 0.46));
  const tints = [color.cream, color.sage];
  const headlineBeats = [
    { from: T.reveal, lines: reveal.lines },
    ...siteTour.slice(1).map((stop, i) => ({ from: T.stops[i + 1], lines: stop.lines })),
  ].map((beat) => ({ from: beat.from, ...wrapHeadline(beat.lines, tints, maxChars) }));

  const tour: TourStop[] = siteTour.map((stop, i) => ({
    screen: stop.screen,
    from: T.stops[i],
    scroll: stop.scroll,
    plate: PLATES[stop.screen],
  }));

  // The phone rises from below the frame, and drops back out for the close.
  const phone = S.phone;
  const travel = L.height - phone.top + 80;
  const rise = interpolate(frame, [T.phoneIn - 4, T.phoneIn + sec(1.3)], [1, 0], { ...clamp, easing: EASE.editorial });
  const drop = interpolate(frame, [T.siteEnd - 4, T.siteEnd + sec(0.5)], [0, 1], { ...clamp, easing: EASE.exit });
  const phoneY = (rise + drop) * travel;

  return (
    <>
      {headlineBeats.map((beat, i) => (
        <SwapHeadline
          key={i}
          beats={[{ from: beat.from, lines: beat.lines }]}
          lineColors={beat.colors}
          exitAt={Math.min(headlineBeats[i + 1] ? headlineBeats[i + 1].from - 4 : Infinity, T.siteEnd - 6)}
          style={{ position: "absolute", left: S.head.left - S.head.size * 0.04, top: S.head.top, ...headingStyle(S.head.size) }}
        />
      ))}
      {frame >= T.phoneIn - 6 && (
        <div style={{ position: "absolute", left: phone.left, top: phone.top, transform: `translateY(${phoneY}px)` }}>
          <PhoneTour width={phone.width} stops={tour} until={T.siteEnd} />
        </div>
      )}
      {S.pageIndex && <PageIndex spec={S.pageIndex} T={T} />}
    </>
  );
}

/**
 * The pages of the tour listed the way the site's mobile menu lists them —
 * index and name on a hairline — with the page on screen picked out.
 */
function PageIndex({ spec, T }: { spec: NonNullable<Layout["site"]["pageIndex"]>; T: NonNullable<SiteTimeline["tour"]> }) {
  const frame = useCurrentFrame();
  const rows = siteTour.map((stop, i) => ({ ...RULE[stop.screen], from: T.stops[i] }));
  const current = rows.reduce((at, row, i) => (frame >= row.from - 8 ? i : at), 0);
  const leave = interpolate(frame, [T.siteEnd - 6, T.siteEnd + 6], [1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: spec.left, bottom: spec.bottom, width: spec.width, opacity: leave }}>
      {rows.map((row, i) => {
        const appear = interpolate(frame, [T.phoneIn + 6 + i * 3, T.phoneIn + 6 + i * 3 + DUR.enter], [0, 1], { ...clamp, easing: EASE.enter });
        const active = i === current;
        return (
          <div
            key={row.index}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: spec.size * 0.7,
              padding: `${spec.size * 0.5}px 0`,
              borderTop: `2px solid rgba(212,201,181,${active ? 0.55 : 0.18})`,
              opacity: appear,
              transform: `translateY(${(1 - appear) * 14}px)`,
            }}
          >
            <span
              style={{
                fontFamily: font.display,
                fontWeight: 600,
                fontSize: spec.size * 0.62,
                letterSpacing: "0.18em",
                color: active ? color.sand : "rgba(212,201,181,0.45)",
              }}
            >
              {row.index}
            </span>
            <span style={{ fontFamily: font.body, fontWeight: 500, fontSize: spec.size, color: active ? color.cream : "rgba(242,240,235,0.38)" }}>
              {row.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
