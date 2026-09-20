import { interpolate, useCurrentFrame } from "remotion";
import { Badge } from "../../components/Badge";
import { copy } from "../../copy/copy.schema";
import { theme } from "../../theme";
import type { SceneProps } from "./sceneProps";

// 6. stack — "under the hood" diagram rendered full-zone (the checkpoint sets
// showPhone: false, so this replaces the phone frame rather than sitting
// inside it). Left-to-right agentic pipeline with the sponsor logo on the
// node it powers, a Google Calendar branch off the voice agent, animated
// flow edges (dashes + travelling pulse), a faint return edge closing the
// loop over the top, and a "built with" chip crediting Cognition and
// QualityClouds. Nodes stagger in ~2.5 s apart to track the VO. This scene is
// the shipped visual, not a placeholder for a phone capture — no MockTag.

type DiagramNodeSpec = { label: string; sub?: string | undefined; logo?: string | undefined };

const NODE_W = 150;
const NODE_H = 118;
const ROW_TOP = 470;
// 6 nodes across the ~1190 px left zone (62fr of 1920) with ~39 px gaps.
const NODE_X = (i: number) => 46 + i * 189;
const CAL_W = 180;
const CAL_H = 92;
const CAL_TOP = 792;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const fade = (frame: number, delay: number, dur = 16) =>
  interpolate(frame, [delay, delay + dur], [0, 1], clamp);

const FlowEdge = ({
  frame,
  delay,
  x1,
  y1,
  x2,
  y2,
}: {
  frame: number;
  delay: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) => {
  // Direction unit vector for the arrowhead.
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const px = -uy;
  const py = ux;
  const tipX = x2 - ux * 3;
  const tipY = y2 - uy * 3;
  const arrow = `${tipX},${tipY} ${tipX - ux * 12 + px * 6},${tipY - uy * 12 + py * 6} ${tipX - ux * 12 - px * 6},${tipY - uy * 12 - py * 6}`;
  // A pulse travels the edge on a 40-frame loop once the edge is lit.
  const t = ((frame - delay) % 40) / 40;

  return (
    <g opacity={fade(frame, delay, 14)}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={theme.accent}
        strokeWidth={3}
        strokeDasharray="9 9"
        strokeDashoffset={-frame * 2}
      />
      <polygon points={arrow} fill={theme.accent} />
      {frame > delay && (
        <circle cx={x1 + (x2 - x1) * t} cy={y1 + (y2 - y1) * t} r={5} fill={theme.accent} />
      )}
    </g>
  );
};

const DiagramNode = ({
  node,
  x,
  y,
  w = NODE_W,
  h = NODE_H,
  delay,
  frame,
  accentBorder,
}: {
  node: DiagramNodeSpec;
  x: number;
  y: number;
  w?: number;
  h?: number;
  delay: number;
  frame: number;
  accentBorder?: boolean;
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      opacity: fade(frame, delay),
      transform: `translateY(${interpolate(frame, [delay, delay + 16], [16, 0], clamp)}px)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      padding: "0 10px",
      boxSizing: "border-box",
      textAlign: "center",
      background: theme.surface,
      border: `1px solid ${accentBorder ? theme.green : theme.hairline}`,
      borderRadius: 18,
      boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
    }}
  >
    {node.logo ? <Badge badge={{ label: node.label, logo: node.logo }} height={34} /> : undefined}
    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.01em" }}>{node.label}</div>
    {node.sub ? (
      <div style={{ fontSize: 13, fontFamily: theme.fontMono, color: theme.muted }}>{node.sub}</div>
    ) : undefined}
  </div>
);

export const Stack = ({ frames }: SceneProps) => {
  const frame = useCurrentFrame();
  const s = copy.checkpoints.stack.screen;
  const step = Math.round(frames * 0.085); // ~2.5 s at 30 fps
  const delay = (i: number) => 12 + i * step;
  const cy = ROW_TOP + NODE_H / 2;
  const voiceCX = NODE_X(3) + NODE_W / 2;
  const calDelay = delay(3) + Math.round(step * 0.55);
  const loopDelay = delay(5) + 10;
  const creditDelay = Math.round(frames * 0.62);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {s.nodes.slice(0, -1).map((_, i) => (
          <FlowEdge
            key={s.nodes[i + 1]?.label ?? i}
            frame={frame}
            delay={delay(i + 1) - 6}
            x1={NODE_X(i) + NODE_W}
            y1={cy}
            x2={NODE_X(i + 1)}
            y2={cy}
          />
        ))}
        <FlowEdge
          frame={frame}
          delay={calDelay - 6}
          x1={voiceCX}
          y1={ROW_TOP + NODE_H}
          x2={voiceCX}
          y2={CAL_TOP}
        />
        {/* faint return edge over the top, closing the agentic loop */}
        <path
          d={`M ${NODE_X(5) + NODE_W / 2} ${ROW_TOP} Q ${(NODE_X(0) + NODE_X(5) + NODE_W) / 2} ${ROW_TOP - 200} ${NODE_X(0) + NODE_W / 2} ${ROW_TOP}`}
          fill="none"
          stroke={theme.faint}
          strokeWidth={2.5}
          strokeDasharray="7 9"
          strokeDashoffset={-frame * 1.4}
          opacity={fade(frame, loopDelay, 20) * 0.6}
        />
      </svg>
      {s.nodes.map((n, i) => (
        <DiagramNode
          key={n.label}
          node={n}
          x={NODE_X(i)}
          y={ROW_TOP}
          delay={delay(i)}
          frame={frame}
        />
      ))}
      <DiagramNode
        node={{ label: s.calendar }}
        x={voiceCX - CAL_W / 2}
        y={CAL_TOP}
        w={CAL_W}
        h={CAL_H}
        delay={calDelay}
        frame={frame}
        accentBorder
      />
      {/* "built with" credit chip: Cognition (Devin) + QualityClouds */}
      <div
        style={{
          position: "absolute",
          right: 46,
          top: 118,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 20px",
          borderRadius: 999,
          background: theme.surface,
          border: `1px solid ${theme.hairline}`,
          opacity: fade(frame, creditDelay, 18),
        }}
      >
        <span style={{ fontSize: 15, fontFamily: theme.fontMono, color: theme.muted }}>
          {s.credit}
        </span>
        <Badge badge={{ label: "Cognition", logo: "cognition.png" }} height={30} />
        <Badge badge={{ label: "QualityClouds", logo: "qualityclouds.png" }} height={30} />
      </div>
    </div>
  );
};
