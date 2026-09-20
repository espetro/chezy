// Type-only stand-ins for the apps/web React components that db/queries.ts and
// lib/types.ts `import type` — the bot never renders, so the real components
// (and their React graph) are kept out of this program.
export type ArtifactKind = "text" | "code" | "image" | "sheet";
export type VisibilityType = "private" | "public";
