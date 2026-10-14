// Two still images: the Reel's cover and a static feed post.
//
// Everything is placed at its finished state (every animation is given a
// start well before frame 0).
import { AbsoluteFill, Img, staticFile } from "remotion";
import { company, reveal } from "../brand/copy";
import { font, headingStyle } from "../brand/fonts";
import { color, ground } from "../brand/tokens";
import { Logo, SiteFrame } from "../components/Brand";
import { Headline } from "../components/Masked";
import { Plate } from "../components/Plate";
import { RoomBuild } from "../components/RoomBuild";
import { RuleRow } from "../components/RuleRow";
import type { LaunchProps } from "../props";
import { withStop } from "../props";

const DONE = -300;

function Signoff({ tone, props }: { tone: "light" | "dark"; props: LaunchProps }) {
  const dark = tone === "dark";
  return (
    <div style={{ textAlign: "right" }}>
      <div
        style={{
          fontFamily: font.display,
          fontWeight: 600,
          fontSize: 22,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: dark ? color.sand : color.forestLight,
        }}
      >
        {withStop(props.launchLine).replace(/\.$/, "")}
      </div>
      <div
        style={{
          marginTop: 12,
          fontFamily: font.body,
          fontWeight: 600,
          fontSize: 34,
          letterSpacing: "0.01em",
          color: dark ? color.cream : color.forest,
        }}
      >
        {props.domain}
      </div>
    </div>
  );
}

/**
 * The Reel's cover. The profile grid shows a Reel cropped to its centre 3:4
 * (y 240–1680), so everything here sits inside that band.
 */
export function ReelCover(props: LaunchProps) {
  return (
    <AbsoluteFill style={{ background: ground.forest }}>
      <RuleRow
        beats={[{ from: DONE, index: reveal.index, label: "New website", datum: "coming soon" }]}
        drawAt={DONE}
        tone="dark"
        style={{ position: "absolute", left: 72, right: 72, top: 300 }}
      />
      <Plate rect={{ x: 72, y: 364, w: 936, h: 720 }}>
        <RoomBuild room="kitchen" from={DONE} duration={1} focusX={0.6} zoom={[1.04, 1.04]} />
      </Plate>
      <Headline
        lines={reveal.lines}
        enterAt={DONE}
        lineColors={[color.cream, color.sage]}
        style={{ position: "absolute", left: 68, top: 1128, ...headingStyle(112) }}
      />
      <div style={{ position: "absolute", left: 72, right: 72, top: 1440, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Logo tone="white" width={330} writeAt={DONE} />
        <Signoff tone="dark" props={props} />
      </div>
      <SiteFrame at={DONE} thickness={18} />
    </AbsoluteFill>
  );
}

/** A static 4:5 post, on the cream sheet with Enzo's own media-wall photograph. */
export function FeedPoster(props: LaunchProps) {
  return (
    <AbsoluteFill style={{ background: color.cream }}>
      <RuleRow
        beats={[{ from: DONE, index: reveal.index, label: "New website", datum: company.city }]}
        drawAt={DONE}
        style={{ position: "absolute", left: 72, right: 72, top: 60 }}
      />
      <Plate rect={{ x: 72, y: 116, w: 936, h: 760 }}>
        <Img
          src={staticFile("photos/media-wall.jpeg")}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "45% 50%" }}
        />
      </Plate>
      <Headline
        lines={reveal.lines}
        enterAt={DONE}
        style={{ position: "absolute", left: 68, top: 914, color: color.forest, ...headingStyle(104) }}
      />
      <div style={{ position: "absolute", left: 72, right: 72, bottom: 64, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <Logo tone="forest" width={250} writeAt={DONE} />
        <Signoff tone="light" props={props} />
      </div>
    </AbsoluteFill>
  );
}
