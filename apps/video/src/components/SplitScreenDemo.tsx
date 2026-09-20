import {
  AbsoluteFill,
  Easing,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from "remotion";
import type { Checkpoint, DemoConfig } from "../config/demo.config";
import type { Timeline } from "../config/timeline";
import { copy } from "../copy/copy.schema";
import { placeholderFor } from "../scenes/placeholders";
import { Callout } from "./Callout";
import { Captions } from "./Captions";
import { CheckpointSidebar } from "./CheckpointSidebar";
import { PhoneFrame } from "./PhoneFrame";

// Emphasis push-in: the phone eases from 1.0 to 1.05 across the middle of the
// narration and settles back before the segment ends, so the transition into
// the next beat starts from a neutral scale.
const PUSH_IN_SCALE = 1.05;

const usePushIn = (voFrames: number, frames: number) => {
  const frame = useCurrentFrame();
  return interpolate(
    frame,
    [voFrames * 0.18, voFrames * 0.55, voFrames * 0.88, frames],
    [1, PUSH_IN_SCALE, PUSH_IN_SCALE, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.ease),
    },
  );
};

// Left zone ~62%: phone right of center, callout text to its left, captions
// bottom center. Right zone ~38%: checkpoint sidebar (Q25). A checkpoint with
// showPhone === false drops the phone frame and renders its scene across the
// full left zone, with the callout moved to the top-left (stack diagram).
export const SplitScreenDemo = ({
  config,
  checkpoint,
  index,
  timeline,
}: {
  config: DemoConfig;
  checkpoint: Checkpoint;
  index: number;
  timeline: Timeline;
}) => {
  const Placeholder = placeholderFor(checkpoint.id);
  const segment = timeline.segments.find((s) => s.id === checkpoint.id);
  const frames = segment?.frames ?? 0;
  const voFrames = segment?.voFrames ?? frames;
  const text = copy.checkpoints[checkpoint.id];
  const fullZone = checkpoint.showPhone === false;
  const pushIn = usePushIn(voFrames, frames);

  return (
    <AbsoluteFill style={{ display: "grid", gridTemplateColumns: "62fr 38fr" }}>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: fullZone ? 0 : 90,
        }}
      >
        <div
          style={
            fullZone
              ? { position: "absolute", left: 72, top: 104, width: 640 }
              : {
                  position: "absolute",
                  left: 72,
                  top: "50%",
                  transform: "translateY(-58%)",
                  width: 330,
                }
          }
        >
          <Callout text={text.callout} />
        </div>
        {fullZone ? (
          <Placeholder checkpoint={checkpoint} frames={frames} showMockTag={config.showMockTags} />
        ) : (
          <div style={{ transform: `scale(${pushIn})`, transformOrigin: "center center" }}>
            <PhoneFrame>
              {checkpoint.source.kind === "clip" ? (
                <OffthreadVideo
                  src={staticFile(`clips/${checkpoint.source.file}`)}
                  startFrom={Math.round((checkpoint.source.trimStartSec ?? 0) * config.fps)}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <Placeholder
                  checkpoint={checkpoint}
                  frames={frames}
                  showMockTag={config.showMockTags}
                />
              )}
            </PhoneFrame>
          </div>
        )}
        <Captions text={text.vo} voFrames={voFrames} />
      </div>
      <CheckpointSidebar
        checkpoints={config.checkpoints}
        activeIndex={index}
        footer={config.footer}
        sponsors={config.sponsors}
        segmentFrames={frames}
        showFooter={index === config.checkpoints.length - 1}
        fps={config.fps}
      />
    </AbsoluteFill>
  );
};
