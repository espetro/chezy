import type { ComponentType } from "react";
import type { CheckpointId } from "../../config/demo.config";
import { Booked } from "./Booked";
import { Brief } from "./Brief";
import { Call } from "./Call";
import { Forensic } from "./Forensic";
import type { SceneProps } from "./sceneProps";
import { Shortlist } from "./Shortlist";
import { Stack } from "./Stack";

const placeholders: Record<CheckpointId, ComponentType<SceneProps>> = {
  brief: Brief,
  shortlist: Shortlist,
  forensic: Forensic,
  call: Call,
  booked: Booked,
  stack: Stack,
};

export const placeholderFor = (id: CheckpointId): ComponentType<SceneProps> => placeholders[id];
