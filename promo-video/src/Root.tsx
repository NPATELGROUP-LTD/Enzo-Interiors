import { Composition, Folder, Still } from "remotion";
import "./brand/fonts";
import { Launch, LAUNCH } from "./compositions/Launch";
import { FeedPoster, ReelCover } from "./compositions/Stills";
import { STORY, StoryTeaser } from "./compositions/StoryTeaser";
import { FPS } from "./brand/tokens";
import { KINETIC_DURATION, KineticCover, KineticReel } from "./kinetic/KineticReel";
import { defaultKineticProps, defaultLaunchProps, type LaunchProps, launchSchema, kineticSchema } from "./props";

const LaunchReel = (props: LaunchProps) => <Launch format="reel" {...props} />;
const LaunchFeed = (props: LaunchProps) => <Launch format="feed" {...props} />;

// Instagram's own sizes: 1080 wide, 30fps.
export function RemotionRoot() {
  return (
    <>
      {/* The fast cut, in the style of NPATEL Group's reel, with its soundtrack. */}
      <Folder name="Kinetic">
        <Composition
          id="KineticReel"
          component={KineticReel}
          schema={kineticSchema}
          defaultProps={defaultKineticProps}
          durationInFrames={KINETIC_DURATION}
          fps={FPS}
          width={1080}
          height={1920}
        />
        <Composition
          id="KineticFeed"
          component={KineticReel}
          schema={kineticSchema}
          defaultProps={defaultKineticProps}
          durationInFrames={KINETIC_DURATION}
          fps={FPS}
          width={1080}
          height={1350}
        />
        <Still id="KineticCover" component={KineticCover} schema={kineticSchema} defaultProps={defaultKineticProps} width={1080} height={1920} />
      </Folder>
      {/* The first, slower editorial cut. */}
      <Folder name="Video">
        <Composition
          id="LaunchReel"
          component={LaunchReel}
          schema={launchSchema}
          defaultProps={defaultLaunchProps}
          durationInFrames={LAUNCH.durationInFrames}
          fps={FPS}
          width={1080}
          height={1920}
        />
        <Composition
          id="LaunchFeed"
          component={LaunchFeed}
          schema={launchSchema}
          defaultProps={defaultLaunchProps}
          durationInFrames={LAUNCH.durationInFrames}
          fps={FPS}
          width={1080}
          height={1350}
        />
        <Composition
          id="LaunchStory"
          component={StoryTeaser}
          schema={launchSchema}
          defaultProps={defaultLaunchProps}
          durationInFrames={STORY.durationInFrames}
          fps={FPS}
          width={1080}
          height={1920}
        />
      </Folder>
      <Folder name="Stills">
        <Still id="ReelCover" component={ReelCover} schema={launchSchema} defaultProps={defaultLaunchProps} width={1080} height={1920} />
        <Still id="FeedPoster" component={FeedPoster} schema={launchSchema} defaultProps={defaultLaunchProps} width={1080} height={1350} />
      </Folder>
    </>
  );
}
