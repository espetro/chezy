import { interpolate, useCurrentFrame } from "remotion";
import type { Checkpoint, DemoConfig } from "../config/demo.config";
import { copy } from "../copy/copy.schema";
import { theme } from "../theme";
import { BadgeRow } from "./Badge";

export const CheckpointSidebar = ({
  checkpoints,
  activeIndex,
  footer,
  sponsors,
  segmentFrames,
  showFooter,
  fps,
}: {
  checkpoints: Checkpoint[];
  activeIndex: number;
  footer: DemoConfig["footer"];
  sponsors: DemoConfig["sponsors"];
  segmentFrames: number;
  showFooter: boolean;
  fps: number;
}) => {
  const frame = useCurrentFrame();
  const slide = interpolate(frame, [0, 12], [8, 0], {
    extrapolateRight: "clamp",
  });
  const inOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Footer (tagline + sponsor strip + repo URL) fades in during the last
  // `showFromSecBeforeEnd` seconds of the booked segment.
  const footerFrom = segmentFrames - footer.showFromSecBeforeEnd * fps;
  const footerOpacity =
    showFooter && footer.repoUrl !== undefined
      ? interpolate(frame, [footerFrom, footerFrom + 24], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  return (
    <aside
      style={{
        borderLeft: `1px solid ${theme.hairline}`,
        padding: "64px 56px",
        display: "flex",
        flexDirection: "column",
        opacity: inOpacity,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          fontSize: 30,
          letterSpacing: "-0.02em",
          marginBottom: 56,
        }}
      >
        {copy.intro.title}
      </div>
      <ol
        style={{
          display: "grid",
          gap: 30,
          listStyle: "none",
          padding: 0,
          margin: 0,
        }}
      >
        {checkpoints.map((cp, i) => {
          const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
          const text = copy.checkpoints[cp.id];
          return (
            <li
              key={cp.id}
              style={{
                display: "grid",
                gridTemplateColumns: "30px 1fr",
                gap: 16,
                opacity: state === "todo" ? 0.4 : 1,
                transform: state === "active" ? `translateX(${slide}px)` : undefined,
              }}
            >
              <span
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color:
                    state === "done" ? theme.green : state === "todo" ? theme.faint : theme.accent,
                }}
              >
                {state === "done" ? "✓" : String(i + 1)}
              </span>
              <div>
                <div style={{ fontSize: 26, fontWeight: 600 }}>{text.label}</div>
                <div style={{ fontSize: 19, color: theme.muted, marginTop: 4 }}>{text.subtext}</div>
                {state === "active" && cp.badges.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <BadgeRow badges={cp.badges} height={30} gap={8} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div
        style={{
          marginTop: "auto",
          opacity: footerOpacity,
          display: footerOpacity > 0 ? "flex" : "none",
          flexDirection: "column",
          gap: 18,
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 600 }}>{copy.footer.tagline}</div>
        <BadgeRow badges={sponsors} height={40} gap={14} justify="center" />
        <div
          style={{
            fontFamily: theme.fontMono,
            fontSize: 18,
            color: theme.muted,
          }}
        >
          {footer.repoUrl}
        </div>
      </div>
    </aside>
  );
};
