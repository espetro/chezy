import "./fonts";

import { Composition } from "remotion";
import { DemoComposition } from "./DemoComposition";
import { demoConfig } from "./config/demo.config";
import { buildTimeline } from "./config/timeline";
import durations from "./generated/durations.json";

export const RemotionRoot = () => (
  <Composition
    id="ChezyDemo"
    component={DemoComposition}
    fps={demoConfig.fps}
    width={demoConfig.width}
    height={demoConfig.height}
    durationInFrames={buildTimeline(demoConfig, durations).total}
    defaultProps={{ config: demoConfig }}
  />
);
