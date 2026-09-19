import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../theme";

// Forensic insight card. variant "amber" = warning with bullets,
// "green" = pass line.
export const InsightCard = ({
  variant,
  title,
  summary,
  bullets,
  at,
}: {
  variant: "amber" | "green";
  title: string;
  summary?: string;
  bullets?: string[];
  at: number;
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return undefined;
  const local = frame - at;
  const o = interpolate(local, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const color = variant === "amber" ? theme.amber : theme.green;
  const soft = variant === "amber" ? theme.amberSoft : theme.greenSoft;

  return (
    <div
      style={{
        alignSelf: "stretch",
        background: soft,
        border: `1px solid ${color}`,
        borderRadius: 14,
        padding: "10px 12px",
        opacity: o,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color,
          marginBottom: 5,
        }}
      >
        {variant === "amber" ? "▲ " : "✓ "}
        {title}
      </div>
      {summary && (
        <div style={{ fontSize: 13.5, lineHeight: 1.4, color: theme.text }}>{summary}</div>
      )}
      {bullets && (
        <ul
          style={{
            margin: "7px 0 0",
            padding: 0,
            listStyle: "none",
            display: "grid",
            gap: 3,
          }}
        >
          {bullets.map((b, i) => (
            <li
              key={b}
              style={{
                fontSize: 12.5,
                fontStyle: "italic",
                color: theme.muted,
                opacity: interpolate(local, [10 + i * 6, 16 + i * 6], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              · {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
