// A ten-second teaser for Stories, ahead of the Reel.
//
// Opens on a closed run ("Something new"), lifts it on the bedroom building
// itself, then closes and opens once more onto the close. The close leaves a
// clear band (y ≈ 960–1230) for Instagram's countdown or link sticker, so the
// launch date can be set as a reminder people opt into.
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { company } from "../brand/copy";
import { headingStyle } from "../brand/fonts";
import { color } from "../brand/tokens";
import { SiteFrame } from "../components/Brand";
import { FittedRun } from "../components/FittedRun";
import { SwapHeadline } from "../components/Masked";
import { Plate, PlateReveal } from "../components/Plate";
import { RoomBuild } from "../components/RoomBuild";
import { RuleRow } from "../components/RuleRow";
import { LAYOUTS, type Layout } from "../layout";
import type { LaunchProps } from "../props";
import { SiteScene } from "../scenes/SiteScene";
import { Soundtrack } from "./Soundtrack";

export const STORY = {
  open: 18,
  build: 34,
  run: { close: 176, open: 214 },
  end: 218,
  durationInFrames: 340,
} as const;

// The close, re-spaced for Stories: the headline moves up and the button
// down, opening a band between them for a sticker.
const storyLayout: Layout = {
  ...LAYOUTS.reel,
  end: {
    ...LAYOUTS.reel.end,
    logo: { top: 320, width: 560 },
    badge: { top: 296, size: 190 },
    headTop: 690,
    pillTop: 1250,
    followTop: 1396,
    disciplinesTop: 1500,
  },
};

export function StoryTeaser(props: LaunchProps) {
  const frame = useCurrentFrame();
  const L = storyLayout;
  const P = L.process;
  const T = STORY;

  return (
    <AbsoluteFill style={{ background: color.forest }}>
      {frame < T.run.close + 24 ? (
        <AbsoluteFill style={{ background: color.cream }}>
          <RuleRow
            beats={[{ from: T.open, label: "New website", datum: "coming soon" }]}
            drawAt={T.open + 4}
            style={{ position: "absolute", left: L.padX, right: L.padX, top: L.ruleTop }}
          />
          <Plate rect={P.plate}>
            <PlateReveal at={T.open - 4}>
              <RoomBuild room="bedroom" from={T.build} duration={96} focusX={0.4} captionAt={T.build + 82} />
            </PlateReveal>
          </Plate>
          <SwapHeadline
            beats={[{ from: T.open + 10, lines: ["Something new", "is being fitted."] }]}
            lineColors={[color.forest, color.forestLight]}
            style={{ position: "absolute", left: L.padX - 5, top: P.headTop, ...headingStyle(120) }}
          />
        </AbsoluteFill>
      ) : (
        // Straight to the close: the tour is the Reel's job.
        <SiteScene L={L} T={{ end: T.end }} props={props} />
      )}

      {/* Already shut when the story opens. */}
      <FittedRun closeAt={-60} openAt={T.open} plate={{ index: "05", label: "Something new", imprint: company.imprint }} />
      <FittedRun
        closeAt={T.run.close}
        openAt={T.run.open}
        plate={{ index: "06", label: "New website", imprint: company.imprint }}
      />
      <SiteFrame at={T.run.open} thickness={L.frameThickness} />
      <Soundtrack src={props.soundtrack} />
    </AbsoluteFill>
  );
}
