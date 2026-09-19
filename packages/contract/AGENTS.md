# `@chezy/contract` — agent instructions

Scope: Valibot schemas shared between `apps/web`, `apps/scraper`, and
sibling packages. The single source of truth for request/response
shapes that cross a module or process boundary. Inherits root
[`AGENTS.md`](../../AGENTS.md) rules; this file adds contract-specific
invariants.

## What's in this package

- `src/<domain>.ts` — Valibot schemas grouped by domain (`chat`,
  `scraper`, `user`, …). Each file exports both the schema and its
  inferred TS type.

```ts
// src/chat.ts
import * as v from "valibot";

export const chatTurnInput = v.object({
  sessionId: v.pipe(v.string(), v.uuid()),
  message: v.pipe(v.string(), v.minLength(1), v.maxLength(8000)),
});

export type ChatTurnInput = v.InferOutput<typeof chatTurnInput>;
```

## Why Valibot, not Zod

The root AGENTS.md and `.oxlintrc.json` ban `zod` in `packages/*` and
`scripts/` (`no-restricted-imports`); the verbatim `apps/web` template
still ships Zod schemas and is oxlint-ignored. Any Zod import
introduced to this package is a `mise run validate:quick` failure.
Use `valibot` (`valibot` package)
and re-export both the schema (`chatTurnInput`) and the inferred TS
type (`type ChatTurnInput`). When binding to forms, reach for
Formisch (the recommended companion for Valibot in chezy).

## Sharing pattern

```ts
// consumer side
import { chatTurnInput, type ChatTurnInput } from "@chezy/contract/chat";

// validate at the boundary
const parsed = v.parse(chatTurnInput, body);

// use the type downstream
function send(input: ChatTurnInput) { /* ... */ }
```

Consumers **must import the schema** and run `v.parse` (or `v.safeParse`
when handling user input) at every trust boundary — never rely on the
TS type alone for runtime validation. The TS type disappears at
runtime; the schema is what protects against malformed JSON, form
spoofing, and scraper payloads.

## Adding a new contract

1. Create `src/<domain>.ts` (snake_case filename matching the domain
   name — one file per domain, not per endpoint).
2. Export a `<thing>Input` and `<thing>Output` schema (and inferred
   types) per endpoint / RPC. Suffix is the trust direction (`Input`
   = request body, `Output` = response body).
3. If the field appears in a DB row, prefer reusing the column type
   from `@chezy/db` rather than redeclaring — Drizzle's
   `InferInsertModel` / `InferSelectModel` are the SQL truth; the
   Valibot schema is the wire-shape truth, and they may legitimately
   differ (e.g. a DB `timestamp` becomes a Valibot
   `v.pipe(v.string(), v.isoTimestamp())`).
4. Re-export from `src/index.ts` so consumers can
   `import { fooInput } from "@chezy/contract"`.

## Out of scope

- **No HTTP / transport layer**. This package is pure schemas +
   inferred types. The HTTP boundary (`apps/web/app/api/*`,
   `apps/scraper` CLI inputs) reads the schema; transport is its
   concern, not ours.
- **No DB queries**. Schemas describe wire shapes, not table rows. For
   row shapes, use `@chezy/db` (`InferSelectModel`, `InferInsertModel`).
- **No business logic**. Schemas validate structure; business rules
   live in the domain code that consumes the parsed value.