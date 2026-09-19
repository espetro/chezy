// demo.config.ts + durations.json -> out/chezy-demo.srt. Cues are the same
// word chunks the burned-in Captions component renders, timed across each
// segment's VO frames. Run via `mise run video:srt`.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chunkWords } from "../src/components/Captions";
import { demoConfig, type SegmentId } from "../src/config/demo.config";
import { buildTimeline } from "../src/config/timeline";
import { copy } from "../src/copy/copy.schema";
import durations from "../src/generated/durations.json";

const OUT_DIR = join(import.meta.dirname, "..", "out");
const OUT = join(OUT_DIR, "chezy-demo.srt");
const timeline = buildTimeline(demoConfig, durations);
const { fps } = demoConfig;

const voText = (id: SegmentId): string =>
  id === "intro" ? copy.intro.vo : copy.checkpoints[id].vo;

const stamp = (frames: number) => {
  const totalMs = Math.round((frames / fps) * 1000);
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
};

const cues: string[] = [];
let i = 1;
for (const seg of timeline.segments) {
  const chunks = chunkWords(voText(seg.id));
  chunks.forEach((chunk, idx) => {
    const start = seg.start + Math.floor((idx / chunks.length) * seg.voFrames);
    const end = seg.start + Math.floor(((idx + 1) / chunks.length) * seg.voFrames);
    cues.push(`${i}\n${stamp(start)} --> ${stamp(end)}\n${chunk}\n`);
    i += 1;
  });
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, cues.join("\n"));
console.log(`wrote ${OUT} (${i - 1} cues)`);
