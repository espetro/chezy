// Generates VO WAVs with pocket-tts, then slows them with ffmpeg atempo
// (demoConfig.voice.tempo; pocket-tts has no speaking-rate control, so
// pacing is a post-process). Cached by sha256(voice + text + tempo) so an
// unchanged segment is skipped. `voice` in demo.config.ts is either a
// built-in pocket-tts voice name (alba, marius, ...) or a path to a
// .safetensors/.wav voice file resolved relative to this package dir; for
// files the cache key hashes the file contents, so re-exporting or swapping
// the voice file regenerates every segment. Raw pre-atempo WAVs go to
// public/audio/vo/raw/ (gitignored with the rest of public/audio/). Also
// emits intro-line samples for the three candidate voices (alba, marius,
// jean) into public/audio/vo/samples/ so the user can pick a narrator.
// Run via `mise run video:tts`.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { copy } from "../src/copy/copy.schema";
import { demoConfig } from "../src/config/demo.config";

const ROOT = join(import.meta.dirname, "..");
const VO_DIR = join(ROOT, "public", "audio", "vo");
const RAW_DIR = join(VO_DIR, "raw");
const SAMPLES_DIR = join(VO_DIR, "samples");
const CACHE_FILE = join(VO_DIR, ".cache.json");
const TEMPO = demoConfig.voice.tempo;

// Voices sampled for the intro line so the user can pick (plan step 2).
const SAMPLE_VOICES = ["alba", "marius", "jean"];

type Cache = Record<string, string>;

// `arg` is what pocket-tts --voice receives; `cacheId` is what the cache
// key hashes (file contents for paths, the name itself for built-ins and
// hf:// URLs).
type VoiceRef = { arg: string; cacheId: string };

const fileDigest = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex").slice(0, 16);

const resolveVoice = (voice: string): VoiceRef => {
  const candidate = isAbsolute(voice) ? voice : join(ROOT, voice);
  if (existsSync(candidate)) {
    return { arg: candidate, cacheId: fileDigest(candidate) };
  }
  return { arg: voice, cacheId: voice };
};

const hash = (voiceId: string, text: string, tempo: number) =>
  createHash("sha256").update(`${voiceId}\n${tempo}\n${text}`).digest("hex").slice(0, 16);

const loadCache = (): Cache => {
  if (!existsSync(CACHE_FILE)) return {};
  return JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Cache;
};

// Single-pass atempo only accepts 0.5 to 2.0; outside that range the
// filter would need chaining, which we do not need for narration.
if (TEMPO < 0.5 || TEMPO > 2) {
  console.error(`voice.tempo ${TEMPO} is outside the atempo range [0.5, 2.0]`);
  process.exit(1);
}

const synth = (voice: VoiceRef, text: string, out: string, key: string, cache: Cache) => {
  const digest = hash(voice.cacheId, text, TEMPO);
  if (cache[key] === digest && existsSync(out)) {
    console.log(`skip  ${key} (unchanged)`);
    return;
  }
  const raw = join(RAW_DIR, basename(out));
  console.log(`synth ${key} -> ${out}`);
  execFileSync(
    "pocket-tts",
    ["generate", "--text", text, "--output-path", raw, "--voice", voice.arg, "-q"],
    { stdio: "inherit" },
  );
  if (TEMPO === 1) {
    renameSync(raw, out);
  } else {
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-af", `atempo=${TEMPO}`, out], {
      stdio: "inherit",
    });
  }
  cache[key] = digest;
};

mkdirSync(RAW_DIR, { recursive: true });
mkdirSync(SAMPLES_DIR, { recursive: true });
const cache = loadCache();
const voice = resolveVoice(demoConfig.voice.voice);
console.log(`voice: ${voice.arg} (tempo ${TEMPO})`);

synth(voice, copy.intro.vo, join(VO_DIR, "intro.wav"), "intro", cache);
for (const cp of demoConfig.checkpoints) {
  const vo = copy.checkpoints[cp.id].vo;
  synth(voice, vo, join(VO_DIR, `${cp.id}.wav`), cp.id, cache);
}

for (const sampleVoice of SAMPLE_VOICES) {
  synth(
    resolveVoice(sampleVoice),
    copy.intro.vo,
    join(SAMPLES_DIR, `intro-${sampleVoice}.wav`),
    `sample:intro:${sampleVoice}`,
    cache,
  );
}

writeFileSync(CACHE_FILE, `${JSON.stringify(cache, undefined, 2)}\n`);
console.log("done");
