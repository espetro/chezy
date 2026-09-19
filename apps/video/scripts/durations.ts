// ffprobe each VO WAV -> src/generated/durations.json (committed; the render
// reads it for deterministic frame counts). Fails loudly if a WAV is missing.
// Run via `mise run video:durations`.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { demoConfig, type SegmentId } from "../src/config/demo.config";

const ROOT = join(import.meta.dirname, "..");
const VO_DIR = join(ROOT, "public", "audio", "vo");
const OUT_DIR = join(ROOT, "src", "generated");
const OUT_FILE = join(OUT_DIR, "durations.json");

const ids: SegmentId[] = ["intro", ...demoConfig.checkpoints.map((c) => c.id)];
const durations: Record<string, number> = {};
let missing = false;

for (const id of ids) {
  const wav = join(VO_DIR, `${id}.wav`);
  if (!existsSync(wav)) {
    console.error(`missing ${wav} — run mise run video:tts first`);
    missing = true;
    continue;
  }
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav],
    { encoding: "utf8" },
  ).trim();
  const seconds = Number.parseFloat(out);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    console.error(`unparseable duration "${out}" for ${wav}`);
    missing = true;
    continue;
  }
  durations[id] = seconds;
  console.log(`${id}: ${seconds.toFixed(2)}s`);
}

if (missing) {
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_FILE, `${JSON.stringify(durations, undefined, 2)}\n`);
const total = Object.values(durations).reduce((a, b) => a + b, 0);
console.log(`wrote ${OUT_FILE} (vo total ${total.toFixed(1)}s)`);
