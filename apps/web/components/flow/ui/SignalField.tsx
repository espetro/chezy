import type { CSSProperties } from "react";
import { cn } from "~/lib/utils";

// Ambient background for the landing and auth surfaces: a masked dot grid, one soft
// ember glow, and a handful of slowly drifting dots.
//
// The particle table is hardcoded on purpose. This renders on the server, so anything
// random here would hydrate to a different DOM (the FlowReveal mismatch in #39 is the
// cautionary tale). Only transform and opacity animate, which keeps the whole field on
// the compositor — it costs nothing on a phone. `animate-signal-drift` is disabled by
// the prefers-reduced-motion block in globals.css, leaving the dots static at the
// opacity set inline below.
interface Particle {
  id: string;
  left: number;
  top: number;
  size: number;
  /** Seconds. Long and mutually prime-ish so the field never visibly loops. */
  duration: number;
  /** Negative offset, so every dot starts mid-flight instead of in lockstep. */
  delay: number;
  opacity: number;
  ember?: boolean;
}

const particles: Particle[] = [
  { id: "a", left: 7, top: 18, size: 3, duration: 19, delay: 0, opacity: 0.35 },
  { id: "b", left: 21, top: 61, size: 2, duration: 26, delay: 4, opacity: 0.3 },
  { id: "c", left: 34, top: 9, size: 2, duration: 23, delay: 9, opacity: 0.25 },
  { id: "d", left: 48, top: 44, size: 4, duration: 31, delay: 2, opacity: 0.28 },
  { id: "e", left: 63, top: 15, size: 3, duration: 21, delay: 11, opacity: 0.32 },
  { id: "f", left: 74, top: 70, size: 2, duration: 28, delay: 6, opacity: 0.3 },
  { id: "g", left: 88, top: 33, size: 3, duration: 24, delay: 14, opacity: 0.26 },
  { id: "h", left: 57, top: 78, size: 4, duration: 33, delay: 17, opacity: 0.45, ember: true },
];

const gridStyle: CSSProperties = {
  backgroundImage: "radial-gradient(circle, var(--color-mist) 1px, transparent 1px)",
  backgroundSize: "28px 28px",
  maskImage: "radial-gradient(ellipse 75% 55% at 50% 0%, #000 10%, transparent 75%)",
  WebkitMaskImage: "radial-gradient(ellipse 75% 55% at 50% 0%, #000 10%, transparent 75%)",
};

export const SignalField = ({ className }: { className?: string }) => (
  <div
    aria-hidden
    className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
  >
    <div className="absolute inset-0" style={gridStyle} />
    <div className="absolute -top-44 left-1/2 size-[22rem] -translate-x-1/2 rounded-full bg-ember/5 blur-3xl" />
    {particles.map(({ id, left, top, size, duration, delay, opacity, ember }) => (
      <span
        key={id}
        className={cn("absolute animate-signal-drift rounded-full", ember ? "bg-ember" : "bg-ash")}
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: size,
          height: size,
          opacity,
          animationDuration: `${duration}s`,
          animationDelay: `-${delay}s`,
        }}
      />
    ))}
  </div>
);
