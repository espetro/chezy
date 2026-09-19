// Day-0 placeholder for the valibot env parser. Replaces the upstream
// vercel/chatbot lib/env.ts (which uses zod). Banned: any direct process.env
// read in apps/web. All env access goes through @chezy/config.
//
// When the first feature ships:
//   import * as v from "valibot";
//   export const env = v.parse(
//     v.object({ DATABASE_URL: v.pipe(v.string(), v.url()) }),
//     process.env,
//   );

export const PLACEHOLDER = "env parser lands in the config ticket";
