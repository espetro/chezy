import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../theme";

// Small centered status chip (e.g. the "Call ended" pill).
export const Chip = ({ text, at }: { text: string; at: number }) => {
  const frame = useCurrentFrame();
  if (frame < at) return undefined;
  const o = interpolate(frame - at, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        alignSelf: "center",
        fontSize: 12,
        fontFamily: theme.fontMono,
        color: theme.muted,
        background: theme.surfaceRaised,
        border: `1px solid ${theme.hairline}`,
        borderRadius: 999,
        padding: "5px 12px",
        opacity: o,
      }}
    >
      {text}
    </div>
  );
};
