import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

// Large callout text to the left of the phone (Q25). It animates in a beat
// after the segment starts — while the incoming transition is still running —
// drifting up and in from the left rather than hard-cutting.
const DELAY_FRAMES = 8;

export const Callout = ({ text }: { text: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, delay: DELAY_FRAMES, config: { damping: 200, mass: 0.7 } });
  const y = interpolate(pop, [0, 1], [28, 0]);
  const x = interpolate(pop, [0, 1], [-36, 0]);

  return (
    <div
      style={{
        fontSize: 46,
        fontWeight: 700,
        fontFamily: theme.fontHeading,
        lineHeight: 1.18,
        letterSpacing: "-0.02em",
        color: theme.text,
        opacity: pop,
        transform: `translate(${x}px, ${y}px)`,
      }}
    >
      {text}
    </div>
  );
};
