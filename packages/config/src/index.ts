/**
 * Valibot env parser — the single sanctioned `process.env` seam for
 * chezy-owned code (`packages/*`, `scripts/`). Consumers import
 * `import { env } from "@chezy/config"` (or a relative path from
 * `scripts/`, which is outside the pnpm workspace graph).
 *
 * Keys:
 * - `DEVIN_PAT` — Devin v3 API personal access token (`cog_…`), read by
 *   `scripts/devin-forge`. Secret; lives in root `.env` only.
 * - `DEVIN_ORG_ID` — Devin organization id (`org-…`), read by
 *   `scripts/devin-forge` for the v3 base URL.
 * - `FORGE_HOLDOUT_DIR` — override for the hold-out fixture directory
 *   used by the forge verifier; defaults to `/tmp/chezy-forge/holdout`.
 * - `FORGE_REPO` — override for the GitHub repo slug the forge targets;
 *   defaults to `espetro/chezy`.
 */
import * as v from "valibot";

const schema = v.object({
  DEVIN_PAT: v.optional(v.string()),
  // v1 personal key (apk_user_...); the forge falls back to it when no PAT is set.
  DEVIN_API_KEY: v.optional(v.string()),
  DEVIN_ORG_ID: v.optional(v.string()),
  FORGE_HOLDOUT_DIR: v.optional(v.string()),
  FORGE_REPO: v.optional(v.string()),
});

export const env = v.parse(schema, process.env);
