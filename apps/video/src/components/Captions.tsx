import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";

// Split VO text into caption chunks of ~5 words. Shared with scripts/srt.ts so
// burned-in captions and the sidecar SRT show identical cues.
export const chunkWords = (text: string, wordsPerChunk = 5): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
  }
  return chunks;
};

// Word-chunked captions timed across the VO frames of the segment, rendered at
// the bottom of the left zone (Q10/Q25). Sized for a phone-sized YouTube
// player (>= 40px).
export const Captions = ({
  text,
  voFrames,
}: {
  text: string;
  voFrames: number;
}) => {
  const frame = useCurrentFrame();
  const chunks = chunkWords(text);
  const index = Math.min(
    chunks.length - 1,
    Math.floor((frame / Math.max(1, voFrames)) * chunks.length),
  );
  const cueStart = (index / chunks.length) * voFrames;
  const fade = interpolate(frame, [cueStart, cueStart + 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        bottom: 44,
        transform: "translateX(-50%)",
        maxWidth: "86%",
        textAlign: "center",
        fontSize: 40,
        fontWeight: 600,
        lineHeight: 1.3,
        color: theme.text,
        background: "rgba(0,0,0,0.55)",
        padding: "10px 22px",
        borderRadius: 16,
        opacity: fade,
      }}
    >
      {chunks[index]}
    </div>
  );
};
