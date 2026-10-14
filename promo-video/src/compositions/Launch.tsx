// The launch film — one story, cut for the 9:16 Reel and the 4:5 feed post.
//
//   0:00  Measured.   the survey inks onto a drawing sheet
//   0:02  Drawn.      the wardrobe draws itself, then takes its finish
//   0:05  Built.      the kitchen builds itself in the plate
//   0:08  Fitted.     then the media wall
//   0:10  the Fitted Run closes: "05 Something new"
//   0:12  A new website, made to measure.   (the frame arrives)
//   0:14  the phone rises with the real site: home → services → portfolio → booking
//   0:22  New website, launching soon. / enzointeriors.co.uk / @enzo.interiors
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { company } from "../brand/copy";
import { color } from "../brand/tokens";
import { SiteFrame } from "../components/Brand";
import { FittedRun } from "../components/FittedRun";
import { type Format, LAYOUTS } from "../layout";
import type { LaunchProps } from "../props";
import { ProcessScene } from "../scenes/ProcessScene";
import { SiteScene } from "../scenes/SiteScene";
import { Soundtrack } from "./Soundtrack";

export const LAUNCH = {
  beats: [0, 72, 144, 234],
  run: { close: 318, open: 360 },
  reveal: 364,
  phoneIn: 420,
  stops: [420, 486, 546, 606],
  siteEnd: 668,
  end: 674,
  durationInFrames: 810,
} as const;

export function Launch({ format, ...props }: LaunchProps & { format: Format }) {
  const frame = useCurrentFrame();
  const L = LAYOUTS[format];
  const T = LAUNCH;
  // The run is solid from about 20 frames after it starts closing; the
  // scenes swap underneath it then.
  const swapAt = T.run.close + 24;

  return (
    <AbsoluteFill style={{ background: color.forest }}>
      {frame < swapAt ? <ProcessScene L={L} T={T} /> : <SiteScene L={L} T={{ tour: T, end: T.end }} props={props} />}
      <FittedRun
        closeAt={T.run.close}
        openAt={T.run.open}
        plate={{ index: "05", label: "Something new", imprint: company.imprint }}
        padX={L.padX}
      />
      <SiteFrame at={T.run.open} thickness={L.frameThickness} />
      <Soundtrack src={props.soundtrack} />
    </AbsoluteFill>
  );
}
