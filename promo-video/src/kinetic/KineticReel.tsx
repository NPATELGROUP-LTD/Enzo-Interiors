// The kinetic launch reel — the reference reel's pace and grammar, Enzo's
// palette, type, facts and footage — plus its cover.
import { AbsoluteFill } from "remotion";
import { Soundtrack } from "../compositions/Soundtrack";
import type { KineticProps } from "../props";
import { k } from "./palette";
import { Chip, GroundFill, Ribbon, Row, Stage, Sticker, Word } from "./parts";
import { LogoTile } from "./illos";
import { KineticScenes, SCENES } from "./scenes";
import { KineticShortScenes, SHORT_SCENES } from "./short";
import { mono } from "./type";

/** The 16-second cut — the one to post. */
export const KINETIC_DURATION = SHORT_SCENES.end;
/** The full 30-second cut, beat for beat with the reference reel. */
export const KINETIC_LONG_DURATION = SCENES.end;

// The music starts on the first frame, so only a click-guard in. The short
// cut ends on a bar line where the track's first section ends; the long one
// ends where the track itself does. Both take a short tail out.

export function KineticReel(props: KineticProps) {
  return (
    <AbsoluteFill>
      <KineticShortScenes copy={props} />
      <Soundtrack src={props.soundtrack} fadeIn={1} fadeOut={6} />
    </AbsoluteFill>
  );
}

export function KineticReelLong(props: KineticProps) {
  return (
    <AbsoluteFill>
      <KineticScenes copy={props} />
      <Soundtrack src={props.soundtrack} fadeIn={1} fadeOut={10} />
    </AbsoluteFill>
  );
}

const SETTLED = -120;

/**
 * The Reel's cover, in the same voice. The profile grid crops Reels to the
 * centre 3:4, so everything sits inside y 240–1680.
 */
export function KineticCover(props: KineticProps) {
  return (
    <AbsoluteFill>
      <GroundFill color={k.dark} pattern="dots" dark />
      <Stage>
        <Ribbon text={`New website + ${props.launchLine}`} at={SETTLED} top={70} rotate={-4} fill={k.sage} />
        <Row top={250}>
          <Word text="Our new" at={SETTLED} size={120} color={k.cream} />
        </Row>
        <Row top={384}>
          <Sticker text="website." at={SETTLED} size={170} rotate={-4} />
        </Row>
        <Row top={630}>
          <Chip text={props.launchLine} at={SETTLED} size={40} fill={k.sage} textColor={k.ink} rotate={-3} dot={k.forest} />
        </Row>
        <Row top={790}>
          <LogoTile width={400} />
        </Row>
        <Row top={1110}>
          <div
            style={{
              ...mono(44, 600),
              textTransform: "none",
              letterSpacing: "0.02em",
              color: k.ink,
              background: k.sageLight,
              border: `5px solid ${k.ink}`,
              borderRadius: 999,
              padding: "16px 40px",
            }}
          >
            {props.domain}
          </div>
        </Row>
        <Ribbon text="Kitchens + Bedrooms + Media walls + Wardrobes" at={SETTLED} top={1290} rotate={-3} fill={k.cream} reverse />
      </Stage>
    </AbsoluteFill>
  );
}
