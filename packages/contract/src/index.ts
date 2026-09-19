// Public surface of @chezy/contract. Day-0 stub.
// Future: Valibot schemas shared between apps/web (chat wire types),
// packages/db (Drizzle column types), and apps/scraper (Python Pydantic).
//
// When the first cross-package shape lands:
//   import * as v from "valibot";
//   export const ChatMessageSchema = v.object({ ... });
//   export type ChatMessage = v.InferOutput<typeof ChatMessageSchema>;
export const PLACEHOLDER = "shared valibot schemas land in the first feature ticket";
