// Generates VO WAVs with pocket-tts, cached by sha256(voice + text) so an
// unchanged segment is skipped. Also emits intro-line samples for the three
// candidate voices (alba, marius, jean) into public/audio/vo/samples/ so the
// user can pick a narrator. Run via `mise run video:tts`.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { copy } from "../src/copy/copy.schema";
import { demoConfig } from "../src/config/demo.config";

const VO_DIR = join(import.meta.dirname, "..", "public", "audio", "vo");
const SAMPLES_DIR = join(VO_DIR, "samples");
const CACHE_FILE = join(VO_DIR, ".cache.json");

// Voices sampled for the intro line so the user can pick (plan step 2).
const SAMPLE_VOICES = ["alba", "marius", "jean"];

type Cache = Record<string, string>;

const hash = (voice: string, text: string) =>
  createHash("sha256").update(`${voice}\n${text}`).digest("hex").slice(0, 16);

const loadCache = (): Cache => {
  if (!existsSync(CACHE_FILE)) return {};
  return JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Cache;
};

const synth = (voice: string, text: string, out: string, key: string, cache: Cache) => {
  const digest = hash(voice, text);
  if (cache[key] === digest && existsSync(out)) {
    console.log(`skip  ${key} (unchanged)`);
    return;
  }
  console.log(`synth ${key} -> ${out}`);
  execFileSync(
    "pocket-tts",
    ["generate", "--text", text, "--output-path", out, "--voice", voice, "-q"],
    { stdio: "inherit" },
  );
  cache[key] = digest;
};

mkdirSync(SAMPLES_DIR, { recursive: true });
const cache = loadCache();
const voice = demoConfig.voice.voice;

synth(voice, copy.intro.vo, join(VO_DIR, "intro.wav"), "intro", cache);
for (const cp of demoConfig.checkpoints) {
  const vo = copy.checkpoints[cp.id].vo;
  synth(voice, vo, join(VO_DIR, `${cp.id}.wav`), cp.id, cache);
}

for (const sampleVoice of SAMPLE_VOICES) {
  synth(
    sampleVoice,
    copy.intro.vo,
    join(SAMPLES_DIR, `intro-${sampleVoice}.wav`),
    `sample:intro:${sampleVoice}`,
    cache,
  );
}

writeFileSync(CACHE_FILE, `${JSON.stringify(cache, undefined, 2)}\n`);
console.log("done");
