import { interpolate, useCurrentFrame } from "remotion";
import type { Copy } from "../../copy/copy.schema";
import { theme } from "../../theme";

const BARS = 26;

// Expanded call sheet: synthetic waveform (amplitude keyed to whichever
// transcript line is currently speaking), es/en transcript lines appearing in
// sync, and the agreed-slot footer.
export const CallSheet = ({
  transcript,
  speakers,
  agreed,
  at,
  span,
}: {
  transcript: Copy["checkpoints"]["call"]["screen"]["transcript"];
  speakers: Copy["checkpoints"]["call"]["screen"]["speakers"];
  agreed: string;
  at: number;
  // Frames over which the four transcript lines stagger in.
  span: number;
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return undefined;
  const local = frame - at;
  const o = interpolate(local, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const grow = interpolate(local, [0, 14], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Line i speaks during its slot of the span (last 12% reserved for the
  // agreed footer).
  const lineSpan = Math.max(1, Math.floor((span * 0.88) / transcript.length));
  const activeLine = Math.min(
    transcript.length - 1,
    Math.floor(local / lineSpan),
  );
  const speaking = local < lineSpan * transcript.length;

  return (
    <div
      style={{
        alignSelf: "stretch",
        background: theme.surfaceRaised,
        border: `1px solid ${theme.hairline}`,
        borderRadius: 16,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: o,
        transform: `scaleY(${grow})`,
        transformOrigin: "top center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 3,
          height: 34,
        }}
      >
        {Array.from({ length: BARS }, (_, i) => {
          const wave = speaking
            ? 0.35 +
              0.65 *
                Math.abs(
                  Math.sin(frame * 0.32 + i * 0.9) *
                    Math.sin(frame * 0.11 + i * 0.5),
                )
            : 0.12;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: Math.max(3, wave * 34),
                borderRadius: 2,
                background:
                  speaking && i % 4 === 0 ? theme.accent : theme.faint,
              }}
            />
          );
        })}
      </div>
      {transcript.map((line, i) => {
        const lineAt = i * lineSpan;
        if (local < lineAt) return undefined;
        const lo = interpolate(local, [lineAt, lineAt + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const isActive = i === activeLine && speaking;
        return (
          <div
            key={line.es}
            style={{
              opacity: lo,
              borderLeft: `2px solid ${isActive ? theme.accent : theme.hairline}`,
              paddingLeft: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 2,
              }}
            >
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: line.who === "agent" ? theme.accent : theme.amber,
                }}
              >
                {speakers[line.who]}
              </span>
              {line.tag && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: theme.canvas,
                    background: theme.amber,
                    borderRadius: 4,
                    padding: "1px 6px",
                  }}
                >
                  {line.tag}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.3 }}>{line.es}</div>
            <div
              style={{
                fontSize: 11.5,
                fontStyle: "italic",
                color: theme.muted,
                lineHeight: 1.3,
              }}
            >
              {line.en}
            </div>
          </div>
        );
      })}
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: theme.green,
          opacity: interpolate(
            local,
            [transcript.length * lineSpan, transcript.length * lineSpan + 10],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          ),
        }}
      >
        {agreed}
      </div>
    </div>
  );
};
