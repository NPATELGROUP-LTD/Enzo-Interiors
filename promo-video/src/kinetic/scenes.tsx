// The kinetic launch reel, scene by scene.
//
// The story follows the reference reel's shape — the problem in four signs,
// the fix, what you get, the proof, the call to action — told about Enzo:
//
//   Hook     "Still picking a kitchen from a brochure?" — the thing the About
//            page says Enzo was started to replace. "Let's measure your room."
//   Signs    priced over the phone · nobody measured · the wall wasn't
//            straight · three trades, nobody answers
//   Fix      "So we do it all ourselves." → the logo → before / after
//   Proof    one team, start to finish · every room priced up front ·
//            the new website · a written quote · one team to call
//   CTA      "Ready for a room that fits? DM us 'SURVEY'" + the new site
//
// Every scene starts on the soundtrack's beat grid (see SCENES below), and
// every fact is the site's own (apps/web/src/data).
import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import { roomFrameSrc, ROOM_FRAMES } from "../components/RoomBuild";
import { FittedRun } from "../components/FittedRun";
import { k } from "./palette";
import { Brochure, CallScreen, CrookedWall, DimensionLine, GuessedQuote, icons, LogoTile, Unmeasured, WrittenQuote } from "./illos";
import {
  Burst,
  Card,
  CheckItem,
  Chip,
  Flash,
  GroundFill,
  PhoneMock,
  Ribbon,
  Rings,
  Row,
  Seal,
  Stage,
  Sticker,
  Sweep,
  usePop,
  useSlam,
  Wedge,
  Word,
} from "./parts";
import { mono, wide } from "./type";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Scene starts, in frames at 30 fps. The soundtrack runs at 150 BPM — a beat
 * every 0.4 s, which is exactly 12 frames — and these are the frames the
 * reference reel changes scene on, so the music's hits land on the cuts.
 */
export const SCENES = {
  hook: 0,
  measure: 48,
  sign1: 96,
  sign2: 132,
  sign3: 168,
  sign4: 204,
  fix: 240,
  logo: 288,
  beforeAfter: 320,
  oneTeam: 384,
  rooms: 480,
  website: 576,
  quote: 672,
  call: 720,
  cta: 768,
  end: 912,
} as const;

export interface KineticCopy {
  launchLine: string;
  domain: string;
  dmKeyword: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Rises an object in from below the stage on a spring. */
function Rise({ at, children, rotate = 0, distance = 1100 }: { at: number; children: ReactNode; rotate?: number; distance?: number }) {
  const { shown, t } = useSlam(at);
  if (!shown) return null;
  return <div style={{ transform: `translateY(${(1 - t) * distance}px) rotate(${rotate + (1 - t) * 10}deg)` }}>{children}</div>;
}

/** Scales an object in from small, with a twist. */
function Pop({ at, children, rotate = 0 }: { at: number; children: ReactNode; rotate?: number }) {
  const { shown, t } = useSlam(at);
  if (!shown) return null;
  return <div style={{ transform: `scale(${interpolate(t, [0, 1], [0.3, 1])}) rotate(${rotate + (1 - t) * -14}deg)` }}>{children}</div>;
}

function Abs({ left, top, children }: { left: number; top: number; children: ReactNode }) {
  return <div style={{ position: "absolute", left, top }}>{children}</div>;
}

const faint = "rgba(11,35,32,0.2)";
const faintLight = "rgba(242,240,235,0.14)";

// ── Hook ──────────────────────────────────────────────────────────────────

/** The brochure holds its place across the two hook scenes. */
function HookBrochure({ offset }: { offset: number }) {
  const frame = useCurrentFrame() + offset;
  const bob = { y: Math.sin(frame / 14) * 7, r: Math.sin(frame / 21) * 0.9 };
  const rise = offset === 0 ? interpolate(frame, [0, 10], [900, 0], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 3) }) : 0;
  return (
    <Row top={700}>
      <div style={{ transform: `translateY(${rise + bob.y}px) rotate(${-5 + bob.r}deg)` }}>
        <Brochure width={470} />
      </div>
    </Row>
  );
}

function Hook() {
  return (
    <>
      <GroundFill color={k.sageLight} pattern="dots" />
      <Sweep text="Still" at={0} dur={7} color={faint} />
      <Stage>
        <Row top={70}>
          <Word text="Still picking" at={2} size={96} />
        </Row>
        <Row top={180}>
          <Sticker text="a kitchen" at={9} size={118} rotate={-4} />
        </Row>
        <Row top={372}>
          <Word text="from a" at={18} size={92} />
        </Row>
        <Row top={480}>
          <Word text="brochure?" at={24} size={124} outline />
        </Row>
        <HookBrochure offset={0} />
      </Stage>
    </>
  );
}

function Measure() {
  const frame = useCurrentFrame();
  const strike = interpolate(frame, [18, 24], [0, 1], clamp);
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
        <HookBrochure offset={SCENES.measure} />
        {/* "One size fits all", struck out. */}
        <Row top={1036}>
          <div style={{ width: 460, display: "flex" }}>
            <div style={{ width: 460 * strike, height: 13, background: k.sand, border: `4px solid ${k.ink}`, borderRadius: 8, transform: "rotate(-5deg)" }} />
          </div>
        </Row>
        <Row top={905}>
          <DimensionLine at={12} width={600} label="2,900 mm" />
        </Row>
        <Row top={1250}>
          <Sticker text="Made to measure" at={26} size={70} fill={k.sand} rotate={-7} from={3.2} />
        </Row>
      </Stage>
    </>
  );
}

// ── The four signs ────────────────────────────────────────────────────────

function Sign({
  n,
  ground,
  pattern,
  dark = false,
  lines,
  children,
}: {
  n: number;
  ground: string;
  pattern: "dots" | "grid" | "none";
  dark?: boolean;
  lines: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <GroundFill color={ground} pattern={pattern} dark={dark} />
      <Stage>
        <Row top={70} align="left">
          <Chip text={`Sign ${n}/4`} at={0} fill={dark ? k.sage : k.ink} textColor={dark ? k.ink : k.cream} />
        </Row>
        {lines}
        {children}
      </Stage>
    </>
  );
}

function Sign1() {
  return (
    <Sign
      n={1}
      ground={k.cream}
      pattern="grid"
      lines={
        <>
          <Row top={160} align="left">
            <Word text="Priced over" at={2} size={104} origin="left" />
          </Row>
          <Row top={285} align="left">
            <Sticker text="the phone." at={9} size={118} fill={k.forest} textColor={k.cream} rotate={-2} origin="left" />
          </Row>
        </>
      }
    >
      <Row top={580}>
        <Pop at={9} rotate={2}>
          <GuessedQuote width={820} />
        </Pop>
      </Row>
    </Sign>
  );
}

function Sign2() {
  return (
    <Sign
      n={2}
      ground={k.white}
      pattern="none"
      lines={
        <>
          <Row top={160} align="left">
            <Word text="Nobody" at={2} size={124} origin="left" />
          </Row>
          <Row top={300} align="left">
            <Sticker text="measured." at={9} size={124} fill={k.sage} rotate={-3} origin="left" />
          </Row>
        </>
      }
    >
      <Row top={620}>
        <Rise at={4}>
          <Unmeasured width={820} />
        </Rise>
      </Row>
    </Sign>
  );
}

function Sign3() {
  return (
    <Sign
      n={3}
      ground={k.sageLight}
      pattern="dots"
      lines={
        <>
          <Row top={160} align="left">
            <Word text="The wall" at={2} size={112} origin="left" />
          </Row>
          <Row top={288} align="left">
            <Sticker text="wasn't" at={9} size={112} rotate={-3} origin="left" />
          </Row>
          <Row top={452} align="left">
            <Word text="straight." at={13} size={118} outline origin="left" />
          </Row>
        </>
      }
    >
      <Row top={660}>
        <Rise at={3}>
          <CrookedWall width={820} />
        </Rise>
      </Row>
    </Sign>
  );
}

function Sign4() {
  return (
    <Sign
      n={4}
      ground={k.dark}
      pattern="dots"
      dark
      lines={
        <>
          <Row top={160} align="left">
            <Word text="Three trades." at={2} size={104} color={k.cream} origin="left" />
          </Row>
          <Row top={288} align="left">
            <Sticker text="Who do you call?" at={9} size={84} rotate={-2} shadow={k.darkShadow} origin="left" />
          </Row>
        </>
      }
    >
      <Row top={500}>
        <Rise at={3} rotate={4}>
          <PhoneMock width={400} screen="#13221e" shadow={k.darkShadow}>
            <CallScreen label="Calling…" name="Fitter" avatar={<span style={{ ...wide(80), color: k.cream }}>?</span>} />
          </PhoneMock>
        </Rise>
      </Row>
      <Row top={1010}>
        <Sticker text="No answer" at={21} size={112} fill={k.sand} rotate={-10} from={3.4} shadow={k.darkShadow} />
      </Row>
    </Sign>
  );
}

// ── The fix ───────────────────────────────────────────────────────────────

function Fix() {
  const frame = useCurrentFrame();
  return (
    <>
      <GroundFill color={k.sage} pattern="dots" />
      <Sweep text="So we" at={0} dur={8} color={faint} />
      <Stage>
        <Row top={380}>
          <Word text="So we" at={4} size={124} />
        </Row>
        <Row top={530}>
          <Sticker text="do it all" at={9} size={170} rotate={-4} />
        </Row>
        <Row top={820}>
          <Word text="ourselves." at={24} size={132} outline />
        </Row>
      </Stage>
      {/* Drop to dark, and come up on the logo. */}
      <AbsoluteFill style={{ background: k.dark, opacity: interpolate(frame, [42, 47], [0, 1], clamp) }} />
    </>
  );
}

function Logo() {
  return (
    <>
      <GroundFill color={k.sageLight} pattern="none" />
      <Stage>
        <Rings at={1} cx={540} cy={640} />
        <Burst at={2} cx={540} cy={640} />
        <Row top={500}>
          <Pop at={1}>
            <LogoTile width={440} />
          </Pop>
        </Row>
        <Row top={850}>
          <Word text="Enzo Interiors" at={8} size={80} />
        </Row>
        <Row top={975}>
          <Chip text="Made in Leicester" at={13} size={30} rotate={-3} />
        </Row>
      </Stage>
      <Flash at={0} dur={5} color={k.dark} />
    </>
  );
}

function BeforeAfter() {
  const frame = useCurrentFrame();
  // Before stays empty; then a divider sweeps across and the finished room
  // is behind it — the homepage hero's kitchen, built.
  const split = interpolate(frame, [24, 42], [0, 100], { ...clamp, easing: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2) });
  const building = Math.round(interpolate(frame, [18, 44], [1, ROOM_FRAMES], clamp));
  const img = (n: number) => (
    <Img src={roomFrameSrc("kitchen", n)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "64% 50%" }} />
  );
  return (
    <>
      <GroundFill color={k.sageLight} pattern="dots" />
      <Stage>
        <Row top={40}>
          <Pop at={0}>
            <LogoTile width={250} />
          </Pop>
        </Row>
        <Abs left={310} top={250}>
          <Rise at={0} distance={900}>
            <PhoneMock width={460}>
              {img(1)}
              <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - split}% 0 0)` }}>{img(building)}</div>
              {split > 0 && split < 100 && (
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${split}%`, width: 8, marginLeft: -4, background: k.white }}>
                  <div style={{ position: "absolute", top: "50%", left: "50%", width: 64, height: 64, margin: -32, borderRadius: 99, background: k.white, border: `5px solid ${k.ink}` }} />
                </div>
              )}
            </PhoneMock>
          </Rise>
        </Abs>
        <Abs left={96} top={360}>
          <Sticker text="Before" at={5} size={62} rotate={-14} />
        </Abs>
        <Abs left={610} top={1060}>
          <Sticker text="After" at={45} size={70} fill={k.sage} rotate={8} />
        </Abs>
      </Stage>
    </>
  );
}

// ── What you get ─────────────────────────────────────────────────────────

function OneTeam() {
  return (
    <>
      <GroundFill color={k.white} pattern="grid" />
      <Stage>
        <Row top={70} align="left">
          <Word text="One team" at={2} size={124} origin="left" />
        </Row>
        <Row top={214} align="left">
          <Chip text="Start to finish" at={8} size={32} fill={k.sage} textColor={k.ink} border={k.ink} rotate={-4} />
        </Row>
        {["Measure", "Design", "Build", "Fit"].map((label, i) => (
          <CheckItem key={label} at={15 + i * 6} top={350 + i * 132} label={label} fill={i % 2 ? k.white : k.sageLight} width={720} />
        ))}
        <Ribbon text="Measure + Design + Build + Fit + 0 subcontractors" at={52} top={960} rotate={-6} fill={k.sage} />
      </Stage>
      <Wedge at={88} dur={8} />
    </>
  );
}

function Rooms() {
  const cards = [
    { title: "Kitchens", sub: "From £4,500 · 4–6 weeks", icon: icons.kitchen, fill: k.sageLight },
    { title: "Bedrooms", sub: "From £2,500 · 3–5 weeks", icon: icons.bedroom, fill: k.white },
    { title: "Media walls", sub: "From £1,800 · 2–4 weeks", icon: icons.mediaWall, fill: k.sand },
    { title: "Wardrobes", sub: "From £1,500 · 2–4 weeks", icon: icons.wardrobe, fill: k.sage },
  ];
  return (
    <>
      <GroundFill color={k.dark} pattern="dots" dark />
      <Sweep text="Whatever" at={0} dur={9} color={faintLight} />
      <Stage>
        <Row top={70} align="left">
          <Word text="Whatever" at={4} size={120} color={k.cream} origin="left" />
        </Row>
        <Row top={200} align="left">
          <Word text="the room:" at={9} size={120} color={k.sage} origin="left" />
        </Row>
        {cards.map((c, i) => (
          <Card
            key={c.title}
            at={15 + i * 6}
            top={370 + i * 200}
            title={c.title}
            sub={c.sub}
            icon={c.icon(62)}
            fill={c.fill}
            from={i % 2 ? "right" : "left"}
            rotate={i % 2 ? 1.2 : -1.4}
            shadow={k.darkShadow}
          />
        ))}
      </Stage>
    </>
  );
}

/** Pages of the real new site in the phone, one per beat. */
function SiteScreen() {
  const frame = useCurrentFrame();
  const pages = [
    { name: "home", from: 0, scroll: [0, 30] },
    { name: "services", from: 30, scroll: [700, 900] },
    { name: "portfolio", from: 54, scroll: [180, 300] },
    { name: "booking", from: 78, scroll: [0, 0] },
  ] as const;
  const i = pages.reduce((at, p, idx) => (frame >= p.from ? idx : at), 0);
  const page = pages[i];
  const end = pages[i + 1]?.from ?? 96;
  const scroll = interpolate(frame, [page.from, end], page.scroll as unknown as [number, number], clamp);
  const innerW = 440 - 2 * 440 * 0.035;
  const s = innerW / 390;
  return <Img src={staticFile(`site/${page.name}.jpg`)} style={{ position: "absolute", top: 0, left: 0, width: innerW, transform: `translateY(${-scroll * s}px)` }} />;
}

function Website({ copy }: { copy: KineticCopy }) {
  const features = [
    { title: "Every room we've finished", sub: "Portfolio · 9 rooms", icon: icons.rooms },
    { title: "Every price, up front", sub: "Services · from £1,500", icon: icons.pound },
    { title: "Book a free survey", sub: "4 questions · no obligation", icon: icons.calendar },
  ];
  return (
    <>
      <GroundFill color={k.sageLight} pattern="dots" />
      <Stage>
        <Row top={50}>
          <Word text="Our new" at={2} size={104} />
        </Row>
        <Row top={166}>
          <Sticker text="website." at={9} size={148} rotate={-3} />
        </Row>
        <Row top={372}>
          <Chip text={copy.launchLine} at={14} size={34} fill={k.forest} textColor={k.cream} rotate={-3} dot={k.sage} />
        </Row>
        <Abs left={320} top={480}>
          <Rise at={4} distance={1000}>
            <PhoneMock width={440} screen={k.dark}>
              <SiteScreen />
            </PhoneMock>
          </Rise>
        </Abs>
        {features.map((f, i) => (
          <Card
            key={f.title}
            at={33 + i * 12}
            top={900 + i * 142}
            left={150}
            width={780}
            height={124}
            title={f.title}
            sub={f.sub}
            icon={f.icon(48)}
            fill={k.white}
            from={i % 2 ? "right" : "left"}
            rotate={i % 2 ? 1.5 : -1.5}
          />
        ))}
      </Stage>
    </>
  );
}

function Quote() {
  return (
    <>
      <GroundFill color={k.cream} pattern="grid" />
      <Stage>
        <Row top={60} align="left">
          <Word text="Price in writing" at={1} size={104} origin="left" />
        </Row>
        <Row top={174} align="left">
          <Sticker text="before we cut." at={5} size={104} fill={k.sage} rotate={-2} origin="left" />
        </Row>
        <Row top={420}>
          <Pop at={8} rotate={2}>
            <WrittenQuote at={12} width={860} />
          </Pop>
        </Row>
      </Stage>
    </>
  );
}

function Call() {
  const frame = useCurrentFrame();
  const seconds = Math.max(0, Math.floor((frame - 6) / 30));
  return (
    <>
      <GroundFill color={k.sage} pattern="dots" />
      <Stage>
        <Row top={70} align="left">
          <Word text="One team" at={4} size={116} origin="left" />
        </Row>
        <Row top={200} align="left">
          <Word text="to call." at={8} size={116} outline origin="left" />
        </Row>
        <Row top={344} align="left">
          <Chip text="Even after handover" at={12} size={30} fill={k.white} textColor={k.ink} border={k.ink} rotate={-3} />
        </Row>
        <Abs left={560} top={480}>
          <Rise at={4} rotate={5} distance={1000}>
            <PhoneMock width={390} screen="#13221e">
              <CallScreen
                label={`Connected · 00:0${seconds}`}
                name="Enzo"
                answered
                avatar={<Img src={staticFile("brand/enzo-white.png")} style={{ width: 118 }} />}
              />
            </PhoneMock>
          </Rise>
        </Abs>
        <Abs left={96} top={820}>
          <Seal at={16} size={330} text="5-year guarantee + Made in Leicester + ">
            <Img src={staticFile("brand/enzo-white.png")} style={{ width: 128 }} />
          </Seal>
        </Abs>
      </Stage>
    </>
  );
}

// ── The call to action ────────────────────────────────────────────────────

function Cta({ copy }: { copy: KineticCopy }) {
  const frame = useCurrentFrame();
  const url = usePop(45);
  return (
    <>
      <GroundFill color={k.dark} pattern="dots" dark />
      <Sweep text="Ready" at={3} dur={10} color={faintLight} />
      <Stage>
        <Ribbon text={`New website + ${copy.launchLine} + Free home survey`} at={6} top={-10} rotate={-4} fill={k.sage} />
        <Row top={130}>
          <Word text="Ready for a room" at={10} size={98} color={k.cream} />
        </Row>
        <Row top={246}>
          <Sticker text="that fits?" at={21} size={120} fill={k.sage} rotate={-3} shadow={k.darkShadow} />
        </Row>
        <Row top={470}>
          <Word text="DM us" at={30} size={176} color={k.cream} />
        </Row>
        <Row top={670}>
          <Sticker text={`“${copy.dmKeyword}”`} at={33} size={132} rotate={-4} shadow={k.darkShadow} />
        </Row>
        <Row top={912}>
          <div style={{ ...mono(30), color: k.sand, opacity: interpolate(frame, [42, 45], [0, 1], clamp) }}>Or see it all at</div>
        </Row>
        <Row top={966}>
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
        <Row top={1104}>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <Pop at={54}>
              <LogoTile width={210} />
            </Pop>
            <Chip text={`New website · ${copy.launchLine}`} at={57} size={26} fill={k.cream} textColor={k.ink} rotate={0} dot={k.sage} />
          </div>
        </Row>
        <Row top={1268}>
          <Sticker text="Send this to someone planning a kitchen" at={66} size={30} fill={k.sand} rotate={-4} shadow={k.darkShadow} from={2} />
        </Row>
        <Ribbon text="Kitchens + Bedrooms + Media walls + Wardrobes" at={8} top={1400} rotate={-3} fill={k.cream} reverse />
      </Stage>
      <Flash at={0} dur={5} />
    </>
  );
}

// ── Assembly ──────────────────────────────────────────────────────────────

export function KineticScenes({ copy }: { copy: KineticCopy }) {
  const S = SCENES;
  const scene = (from: number, to: number, node: ReactNode) => (
    <Sequence from={from} durationInFrames={to - from}>
      {node}
    </Sequence>
  );
  return (
    <AbsoluteFill style={{ background: k.dark }}>
      {scene(S.hook, S.measure, <Hook />)}
      {scene(S.measure, S.sign1, <Measure />)}
      {scene(S.sign1, S.sign2, <Sign1 />)}
      {scene(S.sign2, S.sign3, <Sign2 />)}
      {scene(S.sign3, S.sign4, <Sign3 />)}
      {scene(S.sign4, S.fix, <Sign4 />)}
      {scene(S.fix, S.logo, <Fix />)}
      {scene(S.logo, S.beforeAfter, <Logo />)}
      {scene(S.beforeAfter, S.oneTeam, <BeforeAfter />)}
      {scene(S.oneTeam, S.rooms, <OneTeam />)}
      {scene(S.rooms, S.website, <Rooms />)}
      {scene(S.website, S.quote, <Website copy={copy} />)}
      {scene(S.quote, S.call, <Quote />)}
      {scene(S.call, S.cta, <Call />)}
      {scene(S.cta, S.end, <Cta copy={copy} />)}
      {/* Enzo's own transition, between the quote and the call — the doors
          close on one beat and open on the next. */}
      <FittedRun closeAt={S.call - 14} openAt={S.call + 2} tempo={0.6} />
    </AbsoluteFill>
  );
}
