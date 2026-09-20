import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { copy } from "../copy/copy.schema";
import { theme } from "../theme";

// Full-bleed title card: kicker, product name, the problem in two lines.
// First 5 s must be visually strong (thumbnail, Q18).
export const IntroCard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titlePop = spring({ frame, fps, config: { damping: 120 } });
  const titleScale = interpolate(titlePop, [0, 1], [0.92, 1]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        background: `radial-gradient(ellipse 90% 70% at 50% 42%, ${theme.surface} 0%, ${theme.canvas} 70%)`,
      }}
    >
      <Img
        src={staticFile("logo/chezy-logo-512.png")}
        style={{
          width: 220,
          height: 220,
          marginBottom: 32,
          opacity: titlePop,
          transform: `scale(${titleScale})`,
        }}
      />
      <div
        style={{
          fontSize: 26,
          fontWeight: 600,
          fontFamily: theme.fontHeading,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: theme.muted,
          opacity: interpolate(frame, [4, 16], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          marginBottom: 36,
        }}
      >
        {copy.intro.kicker}
      </div>
      <div
        style={{
          fontSize: 190,
          fontWeight: 800,
          fontFamily: theme.fontHeading,
          letterSpacing: "-0.045em",
          lineHeight: 1,
          color: theme.text,
          opacity: titlePop,
          transform: `scale(${titleScale})`,
        }}
      >
        {copy.intro.title}
        <span style={{ color: theme.accent }}>.</span>
      </div>
      <div style={{ display: "flex", gap: 48, marginTop: 64 }}>
        {copy.intro.lines.map((line, i) => {
          const at = 18 + i * 10;
          const o = interpolate(frame, [at, at + 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const y = interpolate(frame, [at, at + 12], [18, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={line}
              style={{
                fontSize: 52,
                fontWeight: 600,
                color: i === 0 ? theme.amber : theme.text,
                opacity: o,
                transform: `translateY(${y}px)`,
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
};
