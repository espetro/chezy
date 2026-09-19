# packages/config

Single source of truth for env reads. Day-0 stub. Direct `process.env` reads
anywhere else in the workspace are banned by `.oxlintrc.json`.

When the first feature ships, define a Valibot schema in `src/env.ts`:

```ts
import * as v from "valibot";

const Schema = v.object({
  DATABASE_URL: v.pipe(v.string(), v.url()),
  AI_GATEWAY_API_KEY: v.optional(v.string()),
});

export const env = v.parse(Schema, process.env);
```

The `apps/web` side then imports via `import { env } from "@chezy/config"`,
not its own `lib/env.ts` (which will re-export this).
