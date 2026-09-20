import { Img, staticFile } from "remotion";
import type { Badge as BadgeSpec } from "../config/demo.config";
import { theme } from "../theme";

// A sponsor/tech badge: the extracted logo at a fixed height when
// `badge.logo` is set (file under public/badges/), otherwise a text chip.
// Several extracted logos are dark-on-transparent, so logo badges sit on a
// light pill to stay readable on the dark theme.
export const Badge = ({ badge, height = 40 }: { badge: BadgeSpec; height?: number }) => {
  if (badge.logo) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height,
          padding: "0 12px",
          borderRadius: Math.round(height * 0.32),
          background: theme.text,
        }}
      >
        <Img
          src={staticFile(`badges/${badge.logo}`)}
          style={{ height: height - 14, width: "auto", objectFit: "contain" }}
        />
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height,
        padding: "0 18px",
        borderRadius: height / 2,
        border: `1px solid ${theme.hairline}`,
        background: theme.surface,
        color: badge.tone === "accent" ? theme.accent : theme.muted,
        fontSize: Math.round(height * 0.48),
        fontWeight: 600,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      {badge.label}
    </span>
  );
};

export const BadgeRow = ({
  badges,
  height = 40,
  gap = 12,
  justify = "flex-start",
}: {
  badges: BadgeSpec[];
  height?: number;
  gap?: number;
  justify?: "flex-start" | "center";
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: justify,
      gap,
      flexWrap: "wrap",
    }}
  >
    {badges.map((b) => (
      <Badge key={b.label} badge={b} height={height} />
    ))}
  </div>
);
