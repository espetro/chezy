import { AbsoluteFill, Audio, Series, staticFile } from "remotion";
import { MusicBed } from "./components/MusicBed";
import { SplitScreenDemo } from "./components/SplitScreenDemo";
import type { DemoConfig } from "./config/demo.config";
import { buildTimeline } from "./config/timeline";
import durations from "./generated/durations.json";
import { IntroCard } from "./scenes/IntroCard";
import { theme } from "./theme";

export const DemoComposition = ({ config }: { config: DemoConfig }) => {
  const t = buildTimeline(config, durations);
  return (
    <AbsoluteFill
      style={{ background: theme.canvas, fontFamily: theme.fontSans, color: theme.text }}
    >
      <Series>
        <Series.Sequence durationInFrames={t.frames.intro}>
          <IntroCard />
          <Audio src={staticFile("audio/vo/intro.wav")} />
        </Series.Sequence>
        {config.checkpoints.map((cp, i) => (
          <Series.Sequence key={cp.id} durationInFrames={t.frames[cp.id]}>
            <SplitScreenDemo config={config} checkpoint={cp} index={i} timeline={t} />
            <Audio src={staticFile(`audio/vo/${cp.id}.wav`)} />
          </Series.Sequence>
        ))}
      </Series>
      <MusicBed config={config} timeline={t} />
    </AbsoluteFill>
  );
};
