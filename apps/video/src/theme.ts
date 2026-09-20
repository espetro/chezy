// App dark tokens (Q15). Swap this one object when DESIGN.md lands.
export const theme = {
  canvas: "#0a0a0a",
  surface: "#111113",
  surfaceRaised: "#18181b",
  hairline: "#27272a",
  accent: "#2563eb",
  accentSoft: "rgba(37, 99, 235, 0.16)",
  amber: "#fbbf24",
  amberSoft: "rgba(251, 191, 36, 0.12)",
  green: "#4ade80",
  greenSoft: "rgba(74, 222, 128, 0.12)",
  text: "#fafafa",
  muted: "#a1a1aa",
  faint: "#52525b",
  fontSans: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontHeading:
    "Outfit, 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

export type Theme = typeof theme;
