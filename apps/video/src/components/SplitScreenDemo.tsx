import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import type { Checkpoint, DemoConfig } from "../config/demo.config";
import type { Timeline } from "../config/timeline";
import { copy } from "../copy/copy.schema";
import { placeholderFor } from "../scenes/placeholders";
import { Callout } from "./Callout";
import { Captions } from "./Captions";
import { CheckpointSidebar } from "./CheckpointSidebar";
import { PhoneFrame } from "./PhoneFrame";

// Left zone ~62%: phone right of center, callout text to its left, captions
// bottom center. Right zone ~38%: checkpoint sidebar (Q25).
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

  return (
    <AbsoluteFill style={{ display: "grid", gridTemplateColumns: "62fr 38fr" }}>
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 90,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 72,
            top: "50%",
            transform: "translateY(-58%)",
            width: 330,
          }}
        >
          <Callout text={text.callout} />
        </div>
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
        <Captions text={text.vo} voFrames={voFrames} />
      </div>
      <CheckpointSidebar
        checkpoints={config.checkpoints}
        activeIndex={index}
        footer={config.footer}
        sponsors={config.sponsors}
        segmentFrames={frames}
        showFooter={checkpoint.id === "booked"}
        fps={config.fps}
      />
    </AbsoluteFill>
  );
};
