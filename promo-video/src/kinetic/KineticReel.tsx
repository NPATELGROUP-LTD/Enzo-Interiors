// The kinetic launch reel — the reference reel's pace and grammar, Enzo's
// palette, type, facts and footage — plus its cover.
import { AbsoluteFill } from "remotion";
import { Soundtrack } from "../compositions/Soundtrack";
import type { KineticProps } from "../props";
import { k } from "./palette";
import { Chip, GroundFill, Ribbon, Row, Stage, Sticker, Word } from "./parts";
import { LogoTile } from "./illos";
import { KineticScenes, SCENES } from "./scenes";
import { mono } from "./type";

export const KINETIC_DURATION = SCENES.end;

export function KineticReel(props: KineticProps) {
  return (
    <AbsoluteFill>
      <KineticScenes copy={props} />
      {/* The music starts on the first frame and is cut, not faded, at the
          end of the track — so only a click-guard in, and a short tail out. */}
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
