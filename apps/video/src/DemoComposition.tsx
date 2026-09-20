import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { MusicBed } from "./components/MusicBed";
import { SplitScreenDemo } from "./components/SplitScreenDemo";
import type { DemoConfig } from "./config/demo.config";
import { buildTimeline, TRANSITION_FRAMES } from "./config/timeline";
import durations from "./generated/durations.json";
import { IntroCard } from "./scenes/IntroCard";
import { theme } from "./theme";

// Visuals overlap by TRANSITION_FRAMES, narration does not: every sequence but
// the last is padded by the transition length so segment i still starts at
// timeline.segments[i].start and the total equals timeline.total. The VO stays
// on its own absolutely positioned layer, keyed off the same starts, so a
// transition can never drift the audio away from durations.json.
// Cross-dissolve in and out of the two title-like beats (intro card, stack
// diagram); slide between the product beats, which are all phone captures.
const presentationFor = (checkpointIndex: number) =>
  checkpointIndex === 0 || checkpointIndex === 5
    ? fade()
    : slide({ direction: "from-right" });

const timing = linearTiming({ durationInFrames: TRANSITION_FRAMES });

export const DemoComposition = ({ config }: { config: DemoConfig }) => {
  const t = buildTimeline(config, durations);
  const last = config.checkpoints.length;

  return (
    <AbsoluteFill
      style={{ background: theme.canvas, fontFamily: theme.fontSans, color: theme.text }}
    >
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={t.frames.intro + TRANSITION_FRAMES}>
          <IntroCard />
        </TransitionSeries.Sequence>
        {config.checkpoints.flatMap((cp, i) => [
          <TransitionSeries.Transition
            key={`${cp.id}-transition`}
            presentation={presentationFor(i)}
            timing={timing}
          />,
          <TransitionSeries.Sequence
            key={cp.id}
            durationInFrames={t.frames[cp.id] + (i === last - 1 ? 0 : TRANSITION_FRAMES)}
          >
            <SplitScreenDemo config={config} checkpoint={cp} index={i} timeline={t} />
          </TransitionSeries.Sequence>,
        ])}
      </TransitionSeries>
      {t.segments.map((segment) => (
        <Sequence key={segment.id} from={segment.start} durationInFrames={segment.frames}>
          <Audio src={staticFile(`audio/vo/${segment.id}.wav`)} />
        </Sequence>
      ))}
      <MusicBed config={config} timeline={t} />
    </AbsoluteFill>
  );
};
