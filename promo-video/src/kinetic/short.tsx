// The short cut: sixteen seconds, five scenes, paced to be read.
//
// Instagram rewards Reels that are watched to the end, and at the long cut's
// pace — a new line every 1.2 s — the words went by faster than anyone could
// read them. So this cut keeps five beats and gives each one room:
//
//   0:00  Still picking a kitchen from a brochure?
//   0:03  Let's measure your room. — MADE TO MEASURE
//   0:06  One team, start to finish ✓ Measure ✓ Design ✓ Build ✓ Fit
//   0:09  (logo) Our new website. Launching soon. — the site in a phone
//   0:12  DM us "SURVEY" · enzointeriors.co.uk · send this to…
//
// Every scene is exactly two bars of the soundtrack (3.2 s, 96 frames), its
// words land about one per beat and are all on screen within ~1.5 s, and
// then the scene holds. Sixteen seconds is ten bars — where the track's
// first section ends — so the music stops on a phrase, not in the middle of
// one.
import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { FittedRun } from "../components/FittedRun";
import { DimensionLine, icons, LogoTile } from "./illos";
import { k } from "./palette";
import { Card, CheckItem, Chip, GroundFill, PhoneMock, Ribbon, Row, Stage, Sticker, Sweep, usePop, useSlam, Word } from "./parts";
import { HookBrochure, type KineticCopy } from "./scenes";
import { mono } from "./type";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const BARS_2 = 96;

export const SHORT_SCENES = {
  hook: 0,
  measure: BARS_2,
  team: BARS_2 * 2,
  website: BARS_2 * 3,
  cta: BARS_2 * 4,
  end: BARS_2 * 5,
} as const;

const faint = "rgba(11,35,32,0.2)";

function Rise({ at, children, distance = 1000 }: { at: number; children: ReactNode; distance?: number }) {
  const { shown, t } = useSlam(at);
  if (!shown) return null;
  return <div style={{ transform: `translateY(${(1 - t) * distance}px) rotate(${(1 - t) * 10}deg)` }}>{children}</div>;
}

function Pop({ at, children }: { at: number; children: ReactNode }) {
  const { shown, t } = useSlam(at);
  if (!shown) return null;
  return <div style={{ transform: `scale(${interpolate(t, [0, 1], [0.3, 1])}) rotate(${(1 - t) * -14}deg)` }}>{children}</div>;
}

// ── 1. The hook ───────────────────────────────────────────────────────────

function Hook() {
  return (
    <>
      <GroundFill color={k.sageLight} pattern="dots" />
      <Sweep text="Still" at={0} dur={9} color={faint} />
      <Stage>
        <Row top={70}>
          <Word text="Still picking" at={2} size={96} />
        </Row>
        <Row top={180}>
          <Sticker text="a kitchen" at={9} size={118} rotate={-4} />
        </Row>
        <Row top={372}>
          <Word text="from a" at={21} size={92} />
        </Row>
        <Row top={480}>
          <Word text="brochure?" at={30} size={124} outline />
        </Row>
        <HookBrochure offset={0} />
      </Stage>
    </>
  );
}

// ── 2. The answer ─────────────────────────────────────────────────────────

function Measure() {
  const frame = useCurrentFrame();
  const strike = interpolate(frame, [33, 39], [0, 1], clamp);
  return (
    <>
      <GroundFill color={k.sage} pattern="dots" />
      <Stage>
        <Row top={80}>
          <Word text="Let's measure" at={2} size={100} />
        </Row>
        <Row top={200}>
          <Sticker text="your room." at={9} size={128} rotate={-3} />
        </Row>
        <HookBrochure offset={SHORT_SCENES.measure} />
        <Row top={1036}>
          <div style={{ width: 460, display: "flex" }}>
            <div style={{ width: 460 * strike, height: 13, background: k.sand, border: `4px solid ${k.ink}`, borderRadius: 8, transform: "rotate(-5deg)" }} />
          </div>
        </Row>
        <Row top={905}>
          <DimensionLine at={21} width={600} label="2,900 mm" />
        </Row>
        <Row top={1250}>
          <Sticker text="Made to measure" at={45} size={70} fill={k.sand} rotate={-7} from={3.2} />
        </Row>
      </Stage>
    </>
  );
}

// ── 3. The team ───────────────────────────────────────────────────────────

function Team() {
  return (
    <>
      <GroundFill color={k.white} pattern="grid" />
      <Stage>
        <Row top={70} align="left">
          <Word text="One team" at={2} size={124} origin="left" />
        </Row>
        <Row top={214} align="left">
          <Chip text="Start to finish" at={9} size={32} fill={k.sage} textColor={k.ink} border={k.ink} rotate={-4} />
        </Row>
        {["Measure", "Design", "Build", "Fit"].map((label, i) => (
          <CheckItem key={label} at={20 + i * 9} top={350 + i * 132} label={label} fill={i % 2 ? k.white : k.sageLight} width={720} />
        ))}
        <Ribbon text="0 subcontractors + 5-year guarantee + Made in Leicester" at={58} top={960} rotate={-6} fill={k.sage} speed={5} />
      </Stage>
    </>
  );
}

// ── 4. The launch ─────────────────────────────────────────────────────────

/** The real new site in the phone, a page every beat and a half. */
function SiteScreen({ width }: { width: number }) {
  const frame = useCurrentFrame();
  const pages = [
    { name: "home", from: 0, scroll: [0, 30] },
    { name: "services", from: 36, scroll: [700, 860] },
    { name: "portfolio", from: 56, scroll: [180, 280] },
    { name: "booking", from: 76, scroll: [0, 0] },
  ] as const;
  const i = pages.reduce((at, p, idx) => (frame >= p.from ? idx : at), 0);
  const page = pages[i];
  const end = pages[i + 1]?.from ?? BARS_2;
  const scroll = interpolate(frame, [page.from, end], page.scroll as unknown as [number, number], clamp);
  const innerW = width - 2 * width * 0.035;
  const s = innerW / 390;
  return <Img src={staticFile(`site/${page.name}.jpg`)} style={{ position: "absolute", top: 0, left: 0, width: innerW, transform: `translateY(${-scroll * s}px)` }} />;
}

function Website({ copy }: { copy: KineticCopy }) {
  const features = [
    { title: "Every room we've finished", sub: "Portfolio · 9 rooms", icon: icons.rooms },
    { title: "Every price, up front", sub: "Services · from £1,500", icon: icons.pound },
    { title: "Book a free survey", sub: "4 questions · no obligation", icon: icons.calendar },
  ];
  const phoneW = 380;
  return (
    <>
      <GroundFill color={k.sageLight} pattern="dots" />
      <Stage>
        <Row top={34}>
          <Pop at={2}>
            <LogoTile width={250} />
          </Pop>
        </Row>
        <Row top={232}>
          <Word text="Our new" at={6} size={92} />
        </Row>
        <Row top={330}>
          <Sticker text="website." at={12} size={136} rotate={-3} />
        </Row>
        <Row top={540}>
          <Chip text={copy.launchLine} at={20} size={32} fill={k.forest} textColor={k.cream} rotate={-3} dot={k.sage} />
        </Row>
        <div style={{ position: "absolute", left: (1080 - phoneW) / 2, top: 630 }}>
          <Rise at={14}>
            <PhoneMock width={phoneW} screen={k.dark}>
              <SiteScreen width={phoneW} />
            </PhoneMock>
          </Rise>
        </div>
        {features.map((f, i) => (
          <Card
            key={f.title}
            at={27 + i * 8}
            top={960 + i * 136}
            left={150}
            width={780}
            height={118}
            title={f.title}
            sub={f.sub}
            icon={f.icon(46)}
            fill={k.white}
            from={i % 2 ? "right" : "left"}
            rotate={i % 2 ? 1.5 : -1.5}
          />
        ))}
      </Stage>
    </>
  );
}

// ── 5. The call to action ─────────────────────────────────────────────────

function Cta({ copy }: { copy: KineticCopy }) {
  const frame = useCurrentFrame();
  const url = usePop(30);
  return (
    <>
      <GroundFill color={k.dark} pattern="dots" dark />
      <Stage>
        <Ribbon text={`New website + ${copy.launchLine} + Free home survey`} at={4} top={-10} rotate={-4} fill={k.sage} speed={5} />
        <Row top={200}>
          <Word text="DM us" at={8} size={190} color={k.cream} />
        </Row>
        <Row top={430}>
          <Sticker text={`“${copy.dmKeyword}”`} at={14} size={140} rotate={-4} shadow={k.darkShadow} />
        </Row>
        <Row top={690}>
          <div style={{ ...mono(34), color: k.sand, opacity: interpolate(frame, [22, 26], [0, 1], clamp) }}>For a free home survey</div>
        </Row>
        <Row top={760}>
          {url.shown && (
            <div
              style={{
                ...mono(46, 600),
                textTransform: "none",
                letterSpacing: "0.02em",
                color: k.ink,
                background: k.sageLight,
                border: `5px solid ${k.ink}`,
                borderRadius: 999,
                padding: "16px 40px",
                transform: `scale(${interpolate(url.t, [0, 1], [0.4, 1])})`,
              }}
            >
              {copy.domain}
            </div>
          )}
        </Row>
        <Row top={910}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <Pop at={38}>
              <LogoTile width={210} />
            </Pop>
            <Chip text={`New website · ${copy.launchLine}`} at={41} size={26} fill={k.cream} textColor={k.ink} rotate={0} dot={k.sage} />
          </div>
        </Row>
        <Row top={1120}>
          <Sticker text="Send this to someone planning a kitchen" at={50} size={30} fill={k.sand} rotate={-4} shadow={k.darkShadow} from={2} />
        </Row>
        <Ribbon text="Kitchens + Bedrooms + Media walls + Wardrobes" at={6} top={1400} rotate={-3} fill={k.cream} reverse speed={5} />
      </Stage>
    </>
  );
}

// ── Assembly ──────────────────────────────────────────────────────────────

export function KineticShortScenes({ copy }: { copy: KineticCopy }) {
  const S = SHORT_SCENES;
  const scene = (from: number, to: number, node: ReactNode) => (
    <Sequence from={from} durationInFrames={to - from}>
      {node}
    </Sequence>
  );
  return (
    <AbsoluteFill style={{ background: k.dark }}>
      {scene(S.hook, S.measure, <Hook />)}
      {scene(S.measure, S.team, <Measure />)}
      {scene(S.team, S.website, <Team />)}
      {scene(S.website, S.cta, <Website copy={copy} />)}
      {scene(S.cta, S.end, <Cta copy={copy} />)}
      {/* Enzo's door-panel transition carries the launch into the ask. */}
      <FittedRun closeAt={S.cta - 14} openAt={S.cta + 2} tempo={0.6} />
    </AbsoluteFill>
  );
}
