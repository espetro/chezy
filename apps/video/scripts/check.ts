// Pre-render gate (`mise run video:check`, part of video:all). Fails if:
// total > 175 s, any VO WAV is missing, a clip source file is missing, or
// footer.repoUrl is undefined while showMockTags is false.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { demoConfig } from "../src/config/demo.config";
import { buildTimeline } from "../src/config/timeline";
import durations from "../src/generated/durations.json";

const ROOT = join(import.meta.dirname, "..");
const MAX_SECONDS = 175;

const failures: string[] = [];
const timeline = buildTimeline(demoConfig, durations);
const totalSec = timeline.total / demoConfig.fps;

console.log(`total: ${totalSec.toFixed(1)}s (${timeline.total} frames)`);
if (totalSec > MAX_SECONDS) {
  failures.push(`total ${totalSec.toFixed(1)}s exceeds ${MAX_SECONDS}s cap`);
}

for (const seg of timeline.segments) {
  const wav = join(ROOT, "public", "audio", "vo", `${seg.id}.wav`);
  if (!existsSync(wav)) {
    failures.push(`missing VO WAV public/audio/vo/${seg.id}.wav`);
  }
}

for (const cp of demoConfig.checkpoints) {
  if (cp.source.kind === "clip") {
    const clip = join(ROOT, "public", "clips", cp.source.file);
    if (!existsSync(clip)) {
      failures.push(`missing clip source public/clips/${cp.source.file}`);
    }
  }
}

if (demoConfig.footer.repoUrl === undefined && !demoConfig.showMockTags) {
  failures.push("footer.repoUrl is undefined while showMockTags is false");
}

if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL ${f}`);
  process.exit(1);
}
console.log("check passed");
