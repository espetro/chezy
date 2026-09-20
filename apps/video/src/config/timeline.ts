import type { DemoConfig, SegmentId } from "./demo.config";

export const DEFAULT_TAIL_FRAMES = 24;

// Overlap between two segments in DemoComposition's TransitionSeries. It eats
// into the outgoing segment's tail, so it must stay well under
// DEFAULT_TAIL_FRAMES and never reaches the narration.
export const TRANSITION_FRAMES = 13;

export type SegmentTiming = {
  id: SegmentId;
  // Absolute frame where the segment (and its VO) starts.
  start: number;
  // Segment length: ceil(seconds * fps) + tail.
  frames: number;
  // Frames of actual VO audio (without the tail).
  voFrames: number;
};

export type Timeline = {
  fps: number;
  total: number;
  frames: Record<SegmentId, number>;
  segments: SegmentTiming[];
};

export const buildTimeline = (config: DemoConfig, durations: Record<string, number>): Timeline => {
  const { fps } = config;
  const frames = {} as Record<SegmentId, number>;
  const segments: SegmentTiming[] = [];
  let cursor = 0;

  const push = (id: SegmentId, tail: number) => {
    const voFrames = Math.ceil((durations[id] ?? 0) * fps);
    const segmentFrames = voFrames + tail;
    frames[id] = segmentFrames;
    segments.push({ id, start: cursor, frames: segmentFrames, voFrames });
    cursor += segmentFrames;
  };

  push("intro", config.intro.tailFrames ?? DEFAULT_TAIL_FRAMES);
  for (const cp of config.checkpoints) {
    push(cp.id, cp.tailFrames ?? DEFAULT_TAIL_FRAMES);
  }

  return { fps, total: cursor, frames, segments };
};
