# 2026-09-19: onboarding happy path (PR #18)

Surprises worth keeping:

- Rent prices in `chezy-mock-data` skew high: median 3,250 EUR, only ~27 rentals at or
  under 2,500 EUR with 2+ rooms, and 50 of 150 rent rows have no district. Any UI that
  filters strictly on a realistic budget shows an empty feed; `lib/feed.ts` relaxes
  minM2, barrios, price, rooms in that order and says so in Spanish.
- `cacheComponents: true` in `next.config` makes any page that awaits `auth()` or the DB
  at top level throw in dev unless the async part sits inside `<Suspense>`. All
  `app/(agent)` pages use a sync wrapper + `<Suspense>` for that reason.
- `import.meta.dirname` is `undefined` under Turbopack. `lib/insights.ts` and
  `lib/vision/extract.ts` resolve the repo root from it, which 500'd `/api/viewing`; both
  now fall back to `process.cwd()`.
- Drizzle applies migrations by journal timestamp. A locally generated migration with a
  newer timestamp than a migration merged later from main gets skipped silently. When two
  branches both add a migration, regenerate yours after rebasing so the journal order
  matches the file order.
- The dataset has zero agency phone numbers. `/api/viewing` falls back to
  `DEMO_AGENCY_PHONE` from `.env.local`; `VIEWING_MODE=slng` dials it for real.
- The chat now lives at `/chat`; `/` is the landing. "New chat" navigations in
  `components/chat/*` target `/chat`.
