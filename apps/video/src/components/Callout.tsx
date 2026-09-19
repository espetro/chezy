import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

// Large callout text to the left of the phone (Q25).
export const Callout = ({ text }: { text: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 200 } });
  const y = interpolate(pop, [0, 1], [24, 0]);

  return (
    <div
      style={{
        fontSize: 46,
        fontWeight: 700,
        lineHeight: 1.18,
        letterSpacing: "-0.02em",
        color: theme.text,
        opacity: pop,
        transform: `translateY(${y}px)`,
      }}
    >
      {text}
    </div>
  );
};
