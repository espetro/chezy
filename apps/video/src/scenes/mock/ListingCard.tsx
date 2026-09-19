import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../theme";

export type ListingCardData = {
  price: string;
  specs: string;
  zone: string;
  perM2: string;
};

const PHOTO_TINTS = ["#1e3a5f", "#3a2b4f", "#2b4f3a"];

// Listing card: photo block, price, specs, zone, price/m² vs barrio average.
export const ListingCard = ({
  card,
  at,
  index = 0,
  compact = false,
}: {
  card: ListingCardData;
  at: number;
  index?: number;
  compact?: boolean;
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return undefined;
  const local = frame - at;
  const o = interpolate(local, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(local, [0, 10], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        alignSelf: "stretch",
        background: theme.surfaceRaised,
        border: `1px solid ${theme.hairline}`,
        borderRadius: 16,
        overflow: "hidden",
        opacity: o,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          height: compact ? 42 : 74,
          background: `linear-gradient(135deg, ${PHOTO_TINTS[index % PHOTO_TINTS.length]}, ${theme.surface})`,
        }}
      />
      <div
        style={{
          padding: compact ? "7px 12px" : "10px 12px",
          display: "grid",
          gap: 3,
        }}
      >
        <div style={{ fontSize: compact ? 15 : 17, fontWeight: 700 }}>{card.price}</div>
        {!compact && <div style={{ fontSize: 13, color: theme.muted }}>{card.specs}</div>}
        <div style={{ fontSize: 13, color: theme.muted }}>{card.zone}</div>
        <div
          style={{
            fontSize: 12.5,
            fontFamily: theme.fontMono,
            color: theme.accent,
            marginTop: 3,
          }}
        >
          {card.perM2}
        </div>
      </div>
    </div>
  );
};
