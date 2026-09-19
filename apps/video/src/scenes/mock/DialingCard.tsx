import { interpolate, useCurrentFrame } from "remotion";
import type { Badge as BadgeSpec } from "../../config/demo.config";
import { theme } from "../../theme";
import { BadgeRow } from "../../components/Badge";

const PhoneGlyph = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path
      d="M6.6 3h2.6l1.4 4-1.9 1.6a13.4 13.4 0 0 0 6.7 6.7l1.6-1.9 4 1.4v2.6c0 1.1-.9 2-2 2A17.6 17.6 0 0 1 4.6 5c0-1.1.9-2 2-2Z"
      fill={theme.text}
    />
  </svg>
);

// Dialing state: phone icon, masked +34 number, pulsing dot, config badges.
export const DialingCard = ({
  number,
  sub,
  badges,
  at,
}: {
  number: string;
  sub: string;
  badges: BadgeSpec[];
  at: number;
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return undefined;
  const local = frame - at;
  const o = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(frame * 0.35));

  return (
    <div
      style={{
        alignSelf: "stretch",
        background: theme.surfaceRaised,
        border: `1px solid ${theme.hairline}`,
        borderRadius: 16,
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        opacity: o,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            background: theme.accentSoft,
            border: `1px solid ${theme.accent}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PhoneGlyph />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600, fontFamily: theme.fontMono }}>
            {number}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12,
              color: theme.muted,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: theme.green,
                opacity: pulse,
              }}
            />
            {sub}
          </span>
        </div>
      </div>
      {badges.length > 0 && <BadgeRow badges={badges} height={26} gap={8} />}
    </div>
  );
};
