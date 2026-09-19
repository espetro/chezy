import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../../theme";

// Calendar confirmation card: day tile + event details + green check.
export const CalendarCard = ({
  day,
  month,
  title,
  time,
  at,
}: {
  day: string;
  month: string;
  title: string;
  time: string;
  at: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < at) return undefined;
  const pop = spring({ frame: frame - at, fps, config: { damping: 160 } });
  const scale = interpolate(pop, [0, 1], [0.9, 1]);

  return (
    <div
      style={{
        alignSelf: "stretch",
        background: theme.surfaceRaised,
        border: `1px solid ${theme.hairline}`,
        borderRadius: 16,
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 12,
        opacity: pop,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          width: 62,
          height: 62,
          borderRadius: 12,
          background: theme.accentSoft,
          border: `1px solid ${theme.accent}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{day}</span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: theme.accent,
          }}
        >
          {month}
        </span>
      </div>
      <div style={{ flex: 1, display: "grid", gap: 3 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{title}</div>
        <div
          style={{
            fontSize: 12.5,
            fontFamily: theme.fontMono,
            color: theme.muted,
          }}
        >
          {time}
        </div>
      </div>
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          background: theme.greenSoft,
          border: `1px solid ${theme.green}`,
          color: theme.green,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        ✓
      </div>
    </div>
  );
};
