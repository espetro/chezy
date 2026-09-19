# `@chezy/config` — agent instructions

Scope: the Valibot env parser. The single sanctioned `process.env` seam
in the whole TS monorepo. Inherits root [`AGENTS.md`](../../AGENTS.md)
rules; this file adds the config-specific invariants.

## What's in this package

- `src/index.ts` — the Valibot env schema, the parsed `env` object, and
  re-exports. The **only** file in `packages/*` and `scripts/` that
  reads `process.env` directly (root AGENTS.md, enforced by oxlint
  `no-restricted-properties`). The verbatim `apps/web` template is
  oxlint-ignored and keeps its own seam (`lib/env.ts`).
- `*.config-bound.ts` files (where explicitly allowed by oxlint) — read
  `process.env` for build-time configuration. Add new entries by
  extending the allowed-files list in `.oxlintrc.json`.

## Contract

```ts
import * as v from "valibot";
import { env } from "@chezy/config";

const schema = v.object({
  OPENAI_COMPATIBLE_BASE_URL: v.pipe(v.string(), v.url()),
  OPENAI_COMPATIBLE_API_KEY: v.string(),
  POSTGRES_URL: v.optional(v.pipe(v.string(), v.url())),
});

export const env = v.parse(schema, process.env);
```

Properties enforced:

- **Type safety**: every field is `string | undefined` (no `null` —
  `unicorn/no-null`).
- **Validation at boot**: invalid env values throw at process start,
  not at first use. The throw message names the missing key + path.
- **Single import path**: consumers import via `import { env } from
  "@chezy/config"` — never via `process.env` directly (oxlint enforces).

## Adding a new env var

1. Edit the Valibot schema in `src/index.ts`. Required fields use
   `v.string()`; optional fields use `v.optional(v.string())`. URL
   fields add `v.pipe(v.string(), v.url())`. Enum fields use
   `v.picklist(["a", "b", "c"])`.
2. Add the key to `apps/web/.env.example` (template only — never commit
   real values).
3. Update the docstring at the top of `src/index.ts` with a one-line
   description per key (what governs the value, where it's read).
4. If the new var is **secret-shaped** (API key, token, password), also
   add it to the audit log in `packages/observability` so a leak shows
   up in the JSONL audit (no raw value, just "key rotated" / "key
   missing").

Naming:

- **Public provider**: `OPENAI_COMPATIBLE_*`, `AI_GATEWAY_*` (no
  vendor lock-in at the env layer).
- **DB**: `POSTGRES_URL` (matches drizzle config) — `DATABASE_URL` is
  also accepted as a fallback for projects that already use it.
- **App-specific**: prefix with the app name (`WEB_*`, `SCRAPER_*`)
  only when the var is consumed by exactly one app.

## Reading config from server code

The web app keeps its own `apps/web/lib/env.ts` — a self-contained
Valibot schema that reads `process.env` directly (`apps/web/**` is
oxlint-ignored as a verbatim template). Consumers there import via
`import { env } from "@/lib/env"` (the template's `@/*` alias).

If you need to add a var that's web-only (e.g. a feature flag), add it
to `apps/web/lib/env.ts`, not to `@chezy/config`. The split is
deliberate: `@chezy/config` is the seam for chezy-owned code
(`packages/*`, `scripts/`); `apps/web/lib/env` is app glue.

## Audit

`packages/config` is wired so the **boot audit** records every env
key the schema validates, with presence (`set`/`missing`) but never the
value. This is the leak-detection fallback for the no-co-author rule's
opposite: if a secret ever lands in `.env.local` and gets committed,
the audit row tells you which key to rotate without logging the
plaintext.