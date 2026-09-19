import { interpolate, useCurrentFrame } from "remotion";
import { theme } from "../../theme";

// Chat bubble. `at` = first frame the bubble exists; `typeIn` reveals text
// progressively (~40 ms/char at 30 fps) for user bubbles.
export const ChatBubble = ({
  who,
  text,
  at,
  typeIn = false,
}: {
  who: "user" | "assistant";
  text: string;
  at: number;
  typeIn?: boolean;
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return undefined;
  const local = frame - at;
  const o = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(local, [0, 8], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const shown = typeIn ? text.slice(0, Math.floor(local / 1.2)) : text;
  const isUser = who === "user";

  return (
    <div
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "82%",
        background: isUser ? theme.accent : theme.surfaceRaised,
        color: theme.text,
        borderRadius: 18,
        borderBottomRightRadius: isUser ? 6 : 18,
        borderBottomLeftRadius: isUser ? 18 : 6,
        padding: "10px 14px",
        fontSize: 15.5,
        lineHeight: 1.35,
        opacity: o,
        transform: `translateY(${y}px)`,
      }}
    >
      {shown}
      {typeIn && shown.length < text.length && <span style={{ opacity: 0.6 }}>▍</span>}
    </div>
  );
};

// Bottom-anchored chat column; new bubbles push older ones up and off the
// clipped top, which reads as a scroll.
export const ChatColumn = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-end",
      gap: 10,
      padding: "56px 14px 18px",
    }}
  >
    {children}
  </div>
);
