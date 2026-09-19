import type { Checkpoint } from "../../config/demo.config";

export type SceneProps = {
  checkpoint: Checkpoint;
  // Segment length in frames (VO + tail). Scenes pace actions proportionally.
  frames: number;
  showMockTag: boolean;
};
