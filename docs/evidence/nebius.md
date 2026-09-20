# Evidence: Nebius challenge

Challenge (from [`docs/hackbarna.md`](../hackbarna.md)): use **Nebius AI Studio / Token
Factory** at the core of the project and show a measurable improvement (quality,
grounding, evals, speed, cost, or reliability).

## Where Nebius sits in the stack

Nebius AI Studio is the default OpenAI-compatible provider for every model call in the
product, not a sidecar:

| Surface | Code | Model |
| --- | --- | --- |
| Chat (the concierge) | [`apps/web/lib/ai/providers.ts`](../../apps/web/lib/ai/providers.ts), [`models.ts`](../../apps/web/lib/ai/models.ts) | `deepseek-ai/DeepSeek-V4.1-Flash` (default, `CHEZY_MODEL_ID`) |
| Chat titles | same provider | `Qwen/Qwen3-30B-A3B-Instruct-2507` (`CHEZY_TITLE_MODEL_ID`) |
| Vision (listing photo forensics) | [`apps/web/lib/vision/extract.ts`](../../apps/web/lib/vision/extract.ts) | `moonshotai/Kimi-K3` (`VISION_MODEL_ID`) |
| Embeddings | [`apps/web/lib/ai/embeddings.ts`](../../apps/web/lib/ai/embeddings.ts) | `Qwen/Qwen3-Embedding-8B` (`CHEZY_EMBEDDING_MODEL_ID`) |
| Bot (Telegram client) | `apps/bot` Mastra model router | same `OPENAI_COMPATIBLE_*` env |

Configured endpoint: `OPENAI_COMPATIBLE_BASE_URL=https://api.studio.nebius.com/v1`
([`.env.example`](../../apps/web/.env.example)). `lib/ai/explain.ts` also detects
`api.tokenfactory.nebius.com`, so the same wiring runs on Token Factory deployments.

## Measurable improvement

Every Galtea scored run exercises the live Nebius-backed chat endpoint
(`apps/web/scripts/galtea/run.ts` hard-requires the Nebius base URL + key), so the
find/fix/prove deltas in [galtea.md](galtea.md) double as Nebius quality evidence:

- S4 inability / impersonation leak: 0/6 pass → 6/6 after the fix.
- S3 misuse / out-of-scope task execution: 3/6 pass → 6/6 after removing the leaked
  artifact tools.

Model swappability for comparison runs: `CHEZY_MODEL_ID`/`CHEZY_TITLE_MODEL_ID` are env
vars, so the same eval suite (`mise run eval:trace`, `mise run eval:galtea:run`) can be
re-run against any other Nebius-hosted model for a cost/quality table.

## Gap

No committed model-comparison table yet; the defensible claim today is "the product runs
on Nebius end to end and our scored evals measure its behaviour".
