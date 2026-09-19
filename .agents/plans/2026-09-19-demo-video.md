# Plan: 3-minute demo video with Remotion (2026-09-19)

> Status: grilled with the user (4 rounds), approved for implementation. Written Sat
> 2026-09-19 ~23:00 CEST. The video is uploaded to YouTube and *is* the demo (no live
> demo by the rules). Demo slot: Sun 2026-09-20 11:00 CEST.

## Decisions locked

| # | Topic | Decision |
| --- | --- | --- |
| Q1 | Purpose | The video is the demo, uploaded to YouTube. Hard cap 3:00, target about 2:40 to 2:50. |
| Q2 | Ship bar | v0 = intro, 5 checkpoints, VO, captions, no music, end to end render first. Then music. Cut order if behind: music, browser/phone chrome polish, sidebar animation, sponsor badges. |
| Q3 | Audio model | VO-led. Music bed ducked to about -24 dB under narration, -14 dB where nobody speaks. |
| Q4 | Narrator | v0 local `pocket-tts` (installed, English voices). v1 swap to SLNG TTS (`POST https://api.slng.ai/v1/tts/slng/deepgram/aura:2-en`, needs `SLNG_API_KEY`, absent on this machine today). |
| Q5/Q19/Q26 | App footage | **None in this cut.** Every checkpoint is a Remotion-native mid-fi placeholder scene inside a phone frame: real copy, real structure, app tokens, `mock` tag toggled by one prop. Teammates replace placeholders with real phone captures later via config. |
| Q6/Q13 | Capture, fixture routes | Dropped from the critical path. No `apps/web` changes for the video. |
| Q7 | Tracks | Parked; user will specify. Config has `badges` per checkpoint, empty until then. |
| Q8 | Copy | I draft, user edits `demo.config.ts`. TTS, captions and sequence durations all read the same text. English narration. |
| Q9 | Location | `apps/video`, pnpm workspace member, chezy lint rules apply. Renders and WAVs gitignored. |
| Q10 | Captions | Burned in from config, sized for a phone-sized YouTube player, plus sidecar SRT. |
| Q11/Q28 | Time budget | Intro 12s, then Brief, Shortlist, Forensic, Call (Approval folded in), Booked. No outro card; the last ~8s of Booked fade tagline + repo URL into the sidebar footer. |
| Q12 | Story facts | Trap flat in Gràcia (lightwell), gem in Eixample (south facing). Query: "bright 2-bed in Gràcia under 1,800". |
| Q14/Q22/Q27 | Call audio | No Spanish audio. Transcript shows Spanish lines with English translation beneath; VO narrates; waveform from a synthetic signal. |
| Q15 | Visual | App dark tokens (`#0a0a0a`, `#111113`, `#27272a`, `#2563eb`, amber `#fbbf24`, green `#4ade80`, Inter + JetBrains Mono) in one `theme.ts`, easy to swap when DESIGN.md lands. |
| Q16 | Music | One ~40s loopable clip from `audiocpp` Stable-Audio-3-Small (Metal), looped with crossfades. Prompt: "minimal ambient electronic, warm soft pads, slow pulse, no drums, no melody hook, 80 bpm". CC0 track fallback. Generated only after v0 renders. |
| Q17 | Render | M1 for iteration (concurrency 2, nothing else running), remote box for the final if available. |
| Q18 | Deliverable | 1920x1080 30fps H.264 + AAC 48 kHz MP4 for YouTube. First 5s visually strong (thumbnail). Sidecar `.srt`. |
| Q20 | Framing | Phone frame, no browser chrome. |
| Q24 | Phone | iPhone 15 class, 393x852 CSS px portrait, drawn at 1.1x (432x937) with a dark bezel and a small island cutout. Capture target for teammates: 393x852 at deviceScaleFactor 3 = 1179x2556. |
| Q25 | Layout | Left zone ~62%: phone right of center, large callout text to its left. Right zone ~38%: checkpoint sidebar. Captions bottom center of the left zone. |
| Q29 | Handoff | Per checkpoint: `source: placeholder | clip`, `mustShow[]`, and `CAPTURE.md` with start state, actions, end state, target seconds, pixel target. Short clip holds last frame; long clip trims to VO. |
| Q23 | Backlog / license | No backlog item for the hackathon. Remotion free license (team of up to 3, no company). |

## Music vs voiceover (assessment requested)

Voiceover carries the video; music is a bed. Reasons: the script is claims-heavy
(market stats, EU AI Act disclosure, price vs barrio), judges watch on YouTube with sound
on but attention low, and the call beat has no visual of its own so a voice must carry it.
Music-only would push every claim into on-screen text and lose the call. VO-only is the
fallback if music eats time. Ducking rule: -24 dB while a VO segment plays (with 0.5s
padding), -14 dB in the first 1.5s, in gaps between segments, and over the last 6s;
15-frame ramps.

## Timeline (audio-first)

Durations below are targets for the script; the real frame counts come from the WAV
lengths (`Math.ceil(seconds * 30)` plus a 15-frame tail per segment). Speaking rate
target 140 wpm.

| Segment | Target s | Words | Screen |
| --- | --- | --- | --- |
| intro | 12 | ~28 | Full-bleed title card, problem in two lines |
| brief | 22 | ~50 | Phone: onboarding chat |
| shortlist | 20 | ~45 | Phone: query + 3 listing cards |
| forensic | 36 | ~80 | Phone: amber card + green card, push-in |
| call | 44 | ~100 | Phone: approval message, dialing card, then call transcript |
| booked | 24 | ~50 | Phone: confirmation + calendar card; footer tagline for last 8s |
| total | ~158 | ~350 | slack to 170 absorbed by TTS pacing |

## VO script (draft, edit in `demo.config.ts`)

**intro.** Renting in Barcelona has two problems. Listings lie, and speed decides.
Thirty-six percent of flats are gone within a day. Chezy is the agent on the renter's
side.

**brief.** Jessie is moving to Barcelona. She opens Chezy and says who she is. Instead
of a form, the assistant asks the three things it needs: neighbourhoods, budget, bedrooms.
Her answers become a profile that follows her into every future chat, so she never
repeats herself.

**shortlist.** She asks for a bright two bedroom in Gràcia under eighteen hundred euros.
Chezy searches real Barcelona listings and returns a shortlist as cards, with the price
per square metre next to the barrio average. It's a starting point, not a verdict.

**forensic.** Now the part listings don't want you to see. Chezy reads the photos and
the data behind each card. The first flat says "luminoso". Its windows face an interior
lightwell, one and a half metres wide. Zero percent direct sunlight, and thirteen percent
over the barrio average. It gets an amber flag. The second flat faces south and sits
seventeen percent under the average. It passes. The trap is visible before Jessie wastes
an afternoon on it.

**call.** Jessie likes the second one and asks Chezy to book a viewing. This is where
every renter loses time: agencies don't answer email, and the call happens in Spanish,
during office hours. Chezy picks up the phone. A voice agent built with unmute and
deployed on SLNG dials the agency through Vonage telephony. It opens by disclosing it is
an AI assistant, as the EU AI Act requires. It names the flat, asks what's available, and
agrees a slot. Tuesday at half past six. Jessie never had to speak Spanish, or be awake
for it.

**booked.** The confirmed slot comes back to the chat, and the viewing lands on
Jessie's calendar. Brief, shortlist, forensic check, call, booked. One conversation, and
the renter gets an agent of her own. Chezy. Finding a flat, made easy.

## Checkpoints: placeholder contract (also rendered into `CAPTURE.md`)

Each checkpoint has a start state, scripted actions, an end state, a transition into the
next, and a `mustShow` list. Placeholder scenes animate exactly this; a real capture must
show the same.

### 1. brief (sidebar: "Brief", sub "Jessie says who she is; Chezy fills the profile")
- start: empty chat, greeting "What flat are you looking for?", composer focused.
- actions: user bubble "Hi, I'm Jessie" types in (40 ms/char). Assistant: "Welcome,
  Jessie. Three quick things: which neighbourhoods, your monthly budget, and how many
  bedrooms?" User: "Gràcia or Eixample, 1,800 a month, 2 bedrooms." Assistant: "Saved.
  Gràcia or Eixample, up to €1,800, 2 bedrooms. Anything else that matters, like commute
  or a gym nearby?"
- end: four bubbles visible, profile confirmation last.
- callout: "No form. A profile that follows her."
- mustShow: identity line, three profile fields, confirmation.
- transition: chat scrolls up 300 ms ease-out, next user bubble appears.

### 2. shortlist ("Shortlist", "Real Barcelona listings, as cards")
- start: previous chat scrolled so the last confirmation is at the top.
- actions: user "Find me a bright 2-bed in Gràcia under €1,800." Assistant "Three
  candidates." Three `ListingCard`-shaped cards stagger in (80 ms apart): photo block,
  price "1.750 €/mes", "2 hab · 68 m² · 1 baño", "Vila de Gràcia, Gràcia", price/m² line
  with barrio average.
- end: three cards visible, card 1 top.
- callout: "Price per m² next to the barrio average."
- mustShow: query bubble, 3 cards, price/m² vs average on each.
- transition: cards 1 and 2 stay, card 3 fades; insight cards attach beneath 1 and 2.

### 3. forensic ("Forensic check", "Sunlight and price vs barrio, from the data")
- start: cards 1 and 2 visible.
- actions: assistant "I checked both." Amber insight card under card 1: "Forensic
  warning: 0% direct sunlight, windows onto a 1.5 m interior lightwell. 13% over the
  Gràcia average." Bullets in Spanish italic: "Ventanas a patio interior de 1.5 m", "0%
  luz solar directa", "13% sobre media del barrio". Green line under card 2: "Forensic
  check passed: south facing, 17% under the Eixample average." Stage push-in on the
  phone from scale 1.0 to 1.12 over 6s while the amber card is read, then back.
- end: amber card and green line visible.
- callout: "0% direct sunlight. 13% over the barrio average."
- mustShow: amber warning with the three facts, green pass, both cards.
- transition: push-out, user bubble appears.

### 4. call ("The call", "Spanish, with the AI disclosure, on the renter's behalf")
- start: forensic end state.
- actions (0 to 10s): user "Book a viewing for the Eixample one." Assistant "Calling
  the agency now, in Spanish. I'll say I'm an AI assistant." Dialing card: phone icon,
  "Dialing +34 6·· ··· ···", pulsing dot, badges from config.
- actions (10 to 44s): the dialing card expands to a call sheet: waveform (synthetic,
  amplitude keyed to transcript lines), transcript lines appear in sync with VO:
  1. Agent: "Hola, soy el asistente de inteligencia artificial de Jessie. Llamo por el
     piso de dos habitaciones en Eixample." / "Hi, I'm Jessie's AI assistant. I'm calling
     about the two-bedroom in Eixample." (tag: AI disclosure)
  2. Agency: "Sí, sigue disponible. ¿Cuándo querría verlo?" / "Yes, still available.
     When would she like to see it?"
  3. Agent: "¿El martes a las seis y media?" / "Tuesday at half past six?"
  4. Agency: "Perfecto, apuntado." / "Perfect, noted."
  Footer line: "Viewing agreed: Tue 22 Sep, 18:30".
- end: call sheet with four lines and the agreed slot.
- callout: "She never had to speak Spanish."
- mustShow: approval bubble, dialing state, AI disclosure line, agreed slot.
- transition: call sheet collapses into a "Call ended · 1:12" chip, chat continues.

### 5. booked ("Booked", "Confirmed slot on her calendar")
- start: chat with the call-ended chip.
- actions: assistant "Viewing booked: Tuesday 22 September, 18:30. Added to your
  calendar." Calendar card: month/day tile "22 SEP", "Viewing · Eixample 2-bed", "18:30
  to 19:00", green check. Last 8s: sidebar footer fades in "Finding a flat, made easy."
  and the repo URL (empty until provided, then the render prints it).
- end: calendar card + footer.
- callout: "One conversation. Brief to booked."
- mustShow: booked message with the slot, calendar card, all five sidebar items checked.

## Directory layout

```
apps/video/
  AGENTS.md                 package rules (Remotion, no useEffect, theme in theme.ts)
  CAPTURE.md                generated handoff doc (video:capture-doc)
  package.json              @chezy/video: remotion, @remotion/cli, react, react-dom
  remotion.config.ts        codec h264, concurrency 2, output apps/video/out/
  tsconfig.json             extends ../../tsconfig.base.json, ~/* alias
  public/
    audio/vo/*.wav          generated (gitignored)
    audio/music/bed.wav     generated or CC0 (gitignored)
    clips/                  teammate phone captures (gitignored)
  scripts/
    tts.ts                  pocket-tts per segment, sha256 cache -> public/audio/vo
    durations.ts            ffprobe each WAV -> src/generated/durations.json
    music.sh                audiocpp one-shot generation
    capture-doc.ts          demo.config.ts -> CAPTURE.md
    srt.ts                  demo.config.ts + durations -> out/chezy-demo.srt
  src/
    Root.tsx
    DemoComposition.tsx     Series of segments driven by config + durations
    copy/en.json            ALL viewer-facing strings (vo, labels, callouts, screens)
    copy/copy.schema.ts     Valibot schema, parsed at load; exports typed `copy`
    config/demo.config.ts   structure + timing: ids, sources, badges, handoff prose
    config/timeline.ts      buildTimeline(config, durations) -> frames per segment
    theme.ts                tokens, one object
    generated/durations.json
    components/
      PhoneFrame.tsx        393x852 at 1.1x, bezel, island, children clipped
      SplitScreenDemo.tsx   phone zone + callout + sidebar + captions for one checkpoint
      CheckpointSidebar.tsx
      Callout.tsx
      Captions.tsx          word-chunked from segment text, timed by segment length
      MusicBed.tsx          <Audio> loop + ducking volume function
    scenes/
      IntroCard.tsx
      placeholders/         Brief.tsx Shortlist.tsx Forensic.tsx Call.tsx Booked.tsx
      mock/                 ChatBubble, ListingCard, InsightCard, DialingCard,
                            CallSheet, CalendarCard, MockTag
```

Workspace: add `apps/video` to `pnpm-workspace.yaml`; `mise.toml` tasks `video:tts`,
`video:durations`, `video:preview`, `video:render`, `video:music`, `video:capture-doc`,
`video:srt`, and `video:all` (tts -> durations -> capture-doc -> srt -> render).

## Copy lives apart: `src/copy/en.json` (i18n-style, one look)

Every string a viewer reads or hears lives in `apps/video/src/copy/en.json`: VO lines,
sidebar labels and subtext, callouts, intro title and lines, footer tagline, and all
placeholder-screen strings (chat bubbles, card text, insight bullets, call transcript
with `es`/`en` pairs, calendar card). Components and config contain no literal copy.

```json
{
  "intro": { "vo": "...", "title": "chezy", "lines": ["Listings lie.", "Speed decides."] },
  "footer": { "tagline": "Finding a flat, made easy." },
  "checkpoints": {
    "brief": {
      "label": "Brief", "subtext": "...", "callout": "...", "vo": "...",
      "screen": { "greeting": "...", "user1": "Hi, I'm Jessie", "assistant1": "...",
                  "user2": "...", "assistant2": "..." }
    },
    "call": {
      "label": "The call", "subtext": "...", "callout": "...", "vo": "...",
      "screen": { "approval": "...", "dialing": "Dialing +34 6·· ··· ···",
                  "transcript": [{ "who": "agent", "es": "...", "en": "...", "tag": "AI disclosure" }],
                  "agreed": "Viewing agreed: Tue 22 Sep, 18:30" }
    }
  }
}
```

Guards:

- `copy.schema.ts` is a Valibot schema keyed by the same `CheckpointId` union the config
  uses; `en.json` is parsed at module load, so a missing or empty key fails Studio and
  the render (no blank caption ships). Adding a checkpoint without copy is a type error.
- `resolveJsonModule` is already on in `tsconfig.base.json`; the import is typed.
- `.gitattributes` gets `apps/video/src/copy/*.json -linguist-generated` so copy diffs
  render expanded in PRs (repo default collapses `*.json`).
- Copy hints (what is on screen while a line plays) stay in the config's `actions` and
  `transition` fields, since JSON cannot hold comments.
- `en.json` is the only locale for now; the file name leaves room for `es.json`.

## `demo.config.ts` (structure and timing, no copy)

```ts
export type CheckpointId = "brief" | "shortlist" | "forensic" | "call" | "booked";
export type SegmentId = "intro" | CheckpointId;
export type Badge = { label: string; tone?: "neutral" | "accent" };
export type ClipSource =
  | { kind: "placeholder" }
  | { kind: "clip"; file: string; trimStartSec?: number };

export type Checkpoint = {
  id: CheckpointId;
  tailFrames?: number;        // breathing room after the VO ends, default 15
  badges: Badge[];            // sponsor/tech fired in this step (Q7, empty for now)
  mustShow: string[];         // handoff checklist for the real capture
  startState: string;         // handoff prose, not on screen
  actions: string[];
  endState: string;
  transition: string;
  source: ClipSource;
};

export type DemoConfig = {
  fps: 30; width: 1920; height: 1080;
  voice: { engine: "pocket-tts" | "slng"; voice: string };
  music: { file: string | undefined; duckDb: number; swellDb: number };
  footer: { repoUrl: string | undefined; showFromSecBeforeEnd: number };
  showMockTags: boolean;
  intro: { tailFrames?: number };
  checkpoints: Checkpoint[];
};
```

Copy is read as `copy.checkpoints[cp.id]` (label, subtext, callout, vo, screen) and
`copy.intro`, `copy.footer`. TTS hashes `vo` per segment; captions, SRT and `CAPTURE.md`
read the same keys.

Frame math (`timeline.ts`): `frames(seg) = Math.ceil(durations[seg.id] * fps) + tail`.
The composition's `calculateMetadata` returns `durationInFrames = sum(frames)`, so a
changed line only needs `video:tts && video:durations`, never a hand edit.

## Boilerplate (skeleton)

```tsx
// Root.tsx
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
```

```tsx
// DemoComposition.tsx
import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { buildTimeline } from "./config/timeline";
import { IntroCard } from "./scenes/IntroCard";
import { SplitScreenDemo } from "./components/SplitScreenDemo";
import { MusicBed } from "./components/MusicBed";
import { theme } from "./theme";
import durations from "./generated/durations.json";

export const DemoComposition = ({ config }) => {
  const t = buildTimeline(config, durations);
  return (
    <AbsoluteFill style={{ background: theme.canvas, fontFamily: theme.fontSans }}>
      <Series>
        <Series.Sequence durationInFrames={t.frames.intro}>
          <IntroCard {...config.intro} />
          <Audio src={staticFile("audio/vo/intro.wav")} />
        </Series.Sequence>
        {config.checkpoints.map((cp, i) => (
          <Series.Sequence key={cp.id} durationInFrames={t.frames[cp.id]}>
            <SplitScreenDemo config={config} checkpoint={cp} index={i} />
            <Audio src={staticFile(`audio/vo/${cp.id}.wav`)} />
          </Series.Sequence>
        ))}
      </Series>
      <MusicBed config={config} timeline={t} />
    </AbsoluteFill>
  );
};
```

```tsx
// SplitScreenDemo.tsx
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { PhoneFrame } from "./PhoneFrame";
import { CheckpointSidebar } from "./CheckpointSidebar";
import { Callout } from "./Callout";
import { Captions } from "./Captions";
import { placeholderFor } from "../scenes/placeholders";

export const SplitScreenDemo = ({ config, checkpoint, index }) => {
  const Placeholder = placeholderFor(checkpoint.id);
  return (
    <AbsoluteFill style={{ display: "grid", gridTemplateColumns: "62fr 38fr" }}>
      <div style={{ position: "relative" }}>
        <Callout text={checkpoint.callout} />
        <PhoneFrame>
          {checkpoint.source.kind === "clip" ? (
            <OffthreadVideo src={staticFile(`clips/${checkpoint.source.file}`)}
              startFrom={Math.round((checkpoint.source.trimStartSec ?? 0) * config.fps)} />
          ) : (
            <Placeholder checkpoint={checkpoint} showMockTag={config.showMockTags} />
          )}
        </PhoneFrame>
        <Captions text={checkpoint.vo} />
      </div>
      <CheckpointSidebar checkpoints={config.checkpoints} activeIndex={index}
        footer={config.footer} />
    </AbsoluteFill>
  );
};
```

```tsx
// CheckpointSidebar.tsx
import { useCurrentFrame, interpolate } from "remotion";
import { copy } from "../copy/copy.schema";
import { theme } from "../theme";

export const CheckpointSidebar = ({ checkpoints, activeIndex, footer }) => {
  const frame = useCurrentFrame();
  const slide = interpolate(frame, [0, 12], [8, 0], { extrapolateRight: "clamp" });
  return (
    <aside style={{ borderLeft: `1px solid ${theme.hairline}`, padding: 64 }}>
      <div style={{ fontWeight: 600, fontSize: 28, marginBottom: 48 }}>{copy.intro.title}</div>
      <ol style={{ display: "grid", gap: 28, listStyle: "none", padding: 0 }}>
        {checkpoints.map((cp, i) => {
          const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
          const text = copy.checkpoints[cp.id];
          return (
            <li key={cp.id} style={{ display: "grid", gridTemplateColumns: "28px 1fr",
              gap: 16, opacity: state === "todo" ? 0.4 : 1,
              transform: state === "active" ? `translateX(${slide}px)` : undefined }}>
              <span style={{ color: state === "todo" ? theme.muted : theme.accent }}>
                {state === "done" ? "✓" : String(i + 1)}
              </span>
              <div>
                <div style={{ fontSize: 26, fontWeight: 600 }}>{text.label}</div>
                <div style={{ fontSize: 20, color: theme.muted }}>{text.subtext}</div>
                {state === "active" && cp.badges.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {cp.badges.map((b) => <Badge key={b.label} {...b} />)}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {/* footer: tagline + repoUrl, opacity driven by frames-before-end (Booked only) */}
    </aside>
  );
};
```

## Production checklist

1. Scaffold `apps/video` (`pnpm create video --blank`, move into workspace, chezy
   tsconfig/lint), commit `chore(video): scaffold remotion package`.
2. `theme.ts`, `demo.config.ts` with the script above, `timeline.ts`,
   `scripts/tts.ts` + `durations.ts`, mise tasks. Run `video:tts` with three voice samples
   (`alba`, `marius`, `jean`) for the intro line; user picks one. Commit
   `feat(video): config, tts and duration locking`.
3. `PhoneFrame`, `CheckpointSidebar`, `Callout`, `Captions`, `IntroCard`, blank
   placeholders. First full render (v0 skeleton) to prove timing and the YouTube encode.
   Commit `feat(video): composition skeleton`.
4. Placeholder scenes 1 to 5 with the mock components and the transitions above. One
   commit per scene.
5. `scripts/capture-doc.ts` -> `CAPTURE.md`, `scripts/srt.ts`. Commit
   `feat(video): handoff doc and captions sidecar`.
6. Music: `video:music` (audiocpp, 40s, Metal, 8 steps), `MusicBed` with ducking.
   Commit `feat(video): music bed with ducking`.
7. Polish pass: push-in on forensic, sidebar slide, waveform, thumbnail-worthy intro.
8. Final: `video:all` on the M1 (or remote), watch it once end to end at 1x, upload,
   verify YouTube CC from the SRT.

## Quality control and fallback

- A script line changes at 09:00: edit `vo` in `demo.config.ts`, run `mise run video:all`.
  TTS regenerates only the changed segment (sha256 of text + voice), durations and
  captions follow, render is about 10 to 15 min on the M1 at concurrency 2. Budget 25 min
  end to end; no manual timing edits exist anywhere.
- `video:check` (part of `video:all`) fails the render if: total > 175s, any VO WAV is
  missing, `footer.repoUrl` is undefined while `showMockTags` is false, or a `clip` source
  file is missing.
- TTS fallback chain: pocket-tts -> `say -v Samantha` (same script, same pipeline).
- Music fallback: no bed (`music.file: undefined` mutes `MusicBed`).
- Memory: never run `remotion render` with Studio or the Next dev server open; 8 GB.
- Preview loop: `mise run video:preview` (Remotion Studio) for scene work; render a
  single segment with `--frames` when checking timing.
- Teammate swap: drop `clips/<id>.webm|mp4` (1179x2556 or any 393:852 aspect), set
  `source: { kind: "clip", file }`, re-render. `CAPTURE.md` holds the per-checkpoint
  contract; short clips hold the last frame, long clips are trimmed.

## Open inputs (not blocking v0)

- Q7: which tracks/badges to show per checkpoint, and any sponsor phrasing rules.
- Repo URL for the footer (renders blank until set; `video:check` blocks the final).
- Teammates' capture tool (Chrome device mode vs Playwright vs real phone). `CAPTURE.md`
  documents the pixel target for all three.
- `SLNG_API_KEY` on this machine, for the v1 narrator swap.
