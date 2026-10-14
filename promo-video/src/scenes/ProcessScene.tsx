// Act one, on the cream sheet: how a room gets made, in four beats.
//
//   Measured.  the drawing's survey stage — room, dimensions, figure
//   Drawn.     carcass, internals, doors, then the finish
//   Built.     the kitchen building itself (the homepage hero footage)
//   Fitted.    the media wall doing the same
//
// One plate, one rule and one headline position throughout; only what is in
// them changes — the same discipline as the site's SectionIntro.
import { AbsoluteFill } from "remotion";
import { processBeats } from "../brand/copy";
import { headingStyle, font } from "../brand/fonts";
import { color } from "../brand/tokens";
import { ElevationSheet } from "../components/ElevationSheet";
import { SwapHeadline } from "../components/Masked";
import { Plate, PlateReveal, SheetGrid } from "../components/Plate";
import { RoomBuild } from "../components/RoomBuild";
import { RuleRow } from "../components/RuleRow";
import { type Layout, wrapWords } from "../layout";

export interface ProcessTimeline {
  /** Frame each of the four beats begins. */
  beats: readonly [number, number, number, number];
}

export function ProcessScene({ L, T }: { L: Layout; T: ProcessTimeline }) {
  const P = L.process;
  const [measured, drawn, built, fitted] = T.beats;
  const beats = processBeats.map((b, i) => ({ ...b, from: T.beats[i] }));
  const ledeRight = P.lede.align === "right";

  return (
    <AbsoluteFill style={{ background: color.cream }}>
      <RuleRow beats={beats} drawAt={measured + 4} style={{ position: "absolute", left: L.padX, right: L.padX, top: L.ruleTop }} />

      <Plate rect={P.plate}>
        <SheetGrid />
        <ElevationSheet stages={[measured + 8, drawn + 2, drawn + 14, drawn + 32, drawn + 52]} />
        <PlateReveal at={built}>
          <RoomBuild room="kitchen" from={built + 8} duration={78} focusX={P.focus.kitchen} captionAt={built + 58} captionScale={P.captionScale} />
        </PlateReveal>
        <PlateReveal at={fitted}>
          <RoomBuild room="mediawall" from={fitted + 8} duration={70} focusX={P.focus.mediawall} captionAt={fitted + 52} captionScale={P.captionScale} />
        </PlateReveal>
      </Plate>

      <SwapHeadline
        beats={beats.map((b) => ({ from: b.from + 6, lines: [b.verb] }))}
        style={{ position: "absolute", left: L.padX - P.headSize * 0.04, top: P.headTop, color: color.forest, ...headingStyle(P.headSize) }}
      />

      <SwapHeadline
        beats={beats.map((b) => ({ from: b.from + 14, lines: wrapWords(b.lede, P.lede.maxChars) }))}
        style={{
          position: "absolute",
          width: P.lede.width,
          ...(ledeRight
            ? // Split layout: the lede ranges right and sits on the headline's baseline.
              { right: L.padX, bottom: L.height - (P.headTop + P.headSize * 0.98), textAlign: "right", alignItems: "end" }
            : { left: L.padX, top: P.lede.top }),
          fontFamily: font.body,
          fontSize: P.lede.size,
          lineHeight: 1.4,
          color: "rgba(44,44,44,0.8)",
        }}
      />
    </AbsoluteFill>
  );
}
