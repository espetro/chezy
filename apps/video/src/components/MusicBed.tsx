import { Audio, interpolate, staticFile } from "remotion";
import type { DemoConfig } from "../config/demo.config";
import type { Timeline } from "../config/timeline";

const RAMP_FRAMES = 15;

// Loopable ambient bed with VO-led ducking (Q3): duckDb (-24) while a VO
// segment plays +0.5 s padding; swellDb (-14) in the first 1.5 s, in gaps and
// over the last 6 s; 15-frame ramps. Mounts only when config.music.file is set
// (music.file: undefined = fallback, no bed).
export const MusicBed = ({ config, timeline }: { config: DemoConfig; timeline: Timeline }) => {
  const file = config.music.file;
  if (file === undefined) return undefined;

  const { fps, total } = timeline;
  const pad = Math.round(0.5 * fps);
  const duck = 10 ** (config.music.duckDb / 20);
  const swell = 10 ** (config.music.swellDb / 20);

  // Ducked windows: VO segment bounds + 0.5 s pad, clipped out of the first
  // 1.5 s and the last 6 s (those stay at swell).
  const leadIn = Math.round(1.5 * fps);
  const tailOut = total - Math.round(6 * fps);
  const windows = timeline.segments
    .map((s) => ({
      a: Math.max(s.start - pad, leadIn),
      b: Math.min(s.start + s.voFrames + pad, tailOut),
    }))
    .filter((w) => w.b > w.a);

  const volume = (f: number): number => {
    // Signed distance to the nearest ducked window (positive = inside).
    let signed = -Infinity;
    for (const w of windows) {
      const d =
        f >= w.a && f <= w.b
          ? Math.min(f - w.a, w.b - f)
          : -Math.min(Math.abs(f - w.a), Math.abs(f - w.b));
      signed = Math.max(signed, d);
    }
    const t = interpolate(signed, [0, RAMP_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return swell + (duck - swell) * t;
  };

  return <Audio src={staticFile(`audio/music/${file}`)} loop volume={volume} />;
};
