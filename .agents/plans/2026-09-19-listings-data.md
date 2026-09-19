# Listings data: chezy-small dataset -> Postgres -> chat/search/viewing

Goal: give the assistant real Barcelona listings to search, and give the SLNG
agent enough context to call an agency about a specific flat.

## Dataset facts

`chezy-mock-data/` (committed, except photos): 300 listings — fotocasa /
habitaclia / milanuncios x rent/sale, 50 each. Nested JSONL at
`data/listings.jsonl`; join key `(platform, platform_id)`. `media[].url` is a
source CDN URL that serves with no referer — we hotlink it; `media/` (6,530
webp, 437 MB) is gitignored. Known caveats: heavy fotocasa/habitaclia overlap,
104 rows have `title: null` (we fall back to the first description line),
placeholder `built_m2 = 1` on some milanuncios ads.

## Decisions

- **Tables in git, photos hotlinked** from the source CDN; `media/` gitignored.
  Git LFS / R2 upload (paths are already object keys) is the fallback if
  hotlinking breaks.
- **Schema lives in `apps/web/lib/db/schema.ts`** because the template owns
  Drizzle migrations there (`lib/db/migrations`, `drizzle.config.ts`,
  `db:migrate`). Deviation from AGENTS.md's "Drizzle lives in packages/db"
  rule — revisit when packages/db is real (it's a stub today).
- **One `Listing` table**, id = `platform:platform_id`, `media`/`amenities` as
  jsonb, nullable columns mirror dataset nullability.
- The SLNG agent prompt needs `{{property_title}}`, `{{property_price}}`,
  `{{property_location}}`, `{{property_rooms}}` template variables — lead
  patches the agent; `/api/viewing` sends them via
  `listingToCallVariables()`.

## Commits

1. `chore(data): commit the chezy-small listings tables` — dataset minus
   `media/`.
2. `feat(db): add the Listing table and seed it from the dataset` — schema +
   migration, `lib/db/client.ts` (shared postgres-js client),
   `lib/listings.ts` (record schema, row mapping, search, summary, call
   variables), `scripts/seed-listings.ts`, `mise run db:seed`, pure tests.
3. `feat(chat): let the assistant search Barcelona listings` — `searchListings`
   + `getListing` tools, chat route registration, Chezy persona prompt.
4. `feat(viewing): pass listing details to the SLNG agent` — `/api/viewing`
   looks up the listing and sends the rich variables.

## How to run

```bash
mise run db:start        # pg0 on :5432
pnpm --filter @chezy/web db:migrate
mise run db:seed         # -> seeded 300 listings (0 skipped)
```
