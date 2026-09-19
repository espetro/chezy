# 2026-09-19 — template-verbatim-import merged (PR #2)

- `pnpm build` failed on `LanguageModelV4` type mismatch: two `@ai-sdk/provider`
  copies (4.0.2 from pinned `ai@7.0.15`/`@ai-sdk/react@4.0.16` vs 4.0.17 from
  `@ai-sdk/openai-compatible`/`@ai-sdk/otel`). Fixed by aligning on the
  consistent published set: ai@7.0.107 + react@4.0.110 + otel@1.0.107 +
  provider ^4.0.17. pnpm auto-adds `minimumReleaseAgeExclude` for fresh pins.
- `streamdown@2.6` narrowed its props (`dir` literal union, `() => void`
  handlers): don't spread `HTMLAttributes` into `<Streamdown>`.
- `apps/web/vendor/` must stay in the tsconfig `exclude` list — it's the
  verbatim reference copy and fails typecheck by design.
- `no-restricted-syntax` is NOT implemented in oxlint 1.77 — any override
  referencing it kills the whole config at load. Main's env.ts exemption
  block uses it; dropped on the template branch (apps/web is ignored anyway).
- origin/main does not `pnpm install` cleanly: `catalogs` sits in root
  package.json (pnpm only reads pnpm-workspace.yaml), `react-cosmos-plugin-next`
  404s, `@logtape/config@^1.0.0` was never published. Our branch's catalog
  move to pnpm-workspace.yaml fixed this going forward.
- Demo UI (PR #3) landed at `/radar` on the template branch — `app/page.tsx`
  can't coexist with `(chat)/page.tsx`. Revisit placement if it should own `/`.
