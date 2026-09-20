import { cn } from "~/lib/utils";

// The brand mark for the landing and auth surfaces: a stroke-only façade with a live
// ember node in the corner — housing plus agent, without an illustration. Stays inside
// the design system's "99% achromatic, ember is a status accent only" rule.
// The node's pulse is disabled under prefers-reduced-motion (globals.css).
export const HomeSignalMark = ({ className }: { className?: string }) => (
  <span
    className={cn(
      "relative inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-obsidian text-snow",
      className,
    )}
  >
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3.8 10.6 12 4.2l8.2 6.4V19a1.2 1.2 0 0 1-1.2 1.2H5a1.2 1.2 0 0 1-1.2-1.2v-8.4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9.4 20.2v-4.6h5.2v4.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
    <span className="absolute top-2 right-2 size-1.5 animate-signal-pulse rounded-full bg-ember" />
  </span>
);
