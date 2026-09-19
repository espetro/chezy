# Barcelona rental/sale listing scraper — `apps/scraper`

## Context

Chezy is building a real-estate agent that speeds up finding a property to rent or buy in
Barcelona (B2C + B2B). It needs a demo/exploration dataset rich enough that an LLM can answer
natural-language queries over it — so per-item text, structured attributes, geo, and media all
matter.

`apps/scraper` today is a day-0 stub: `pyproject.toml` declares `httpx + parsel + pydantic`,
and `src/chezy_scraper/` contains only `__main__.py` (a hello-world) and `observability.py`
(structlog + JSONL audit channel). There are no adapters, no models, no sinks, no data
directory. `packages/db` and `packages/contract` are both `PLACEHOLDER` strings — no schema
exists yet.

This plan builds the scraping pipeline and produces three dataset tiers (small / medium /
large) so features can be iterated against a cheap set and validated against the full set.

## Scout findings (measured 2026-09-19, not assumed)

I probed every candidate platform directly. Results:

| Platform | Plain HTTP | Payload | BCN rent count | Verdict |
|---|---|---|---|---|
| **fotocasa.es** | 200 | `<script id="__initial_props__">` JSON | 3306 | **Tier 1** |
| **habitaclia.com** | 200 | `window.__INITIAL_PROPS__ = JSON.parse("…")` | 3270 | **Tier 1** |
| **milanuncios.com** | 200 | `window.__INITIAL_PROPS__` (41/page, `nextToken`) | 2270 | Tier 2 |
| **idealista.com** | **403 DataDome** | `window.adMultimediasInfo` + DOM | 1617 (shape URL) | **Tier 1, browser-only** |
| spotahome.com | 200 | thin JSON-LD | — | Tier 3 (mid-term only) |
| badi.com | 200 | no JSON, HTML only | — | Tier 3 (rooms only) |
| pisos.com | 200 | JSON-LD, thin (no price/rooms) | — | Tier 3 |

Decisions locked with the user: **fotocasa + habitaclia first, idealista second**; **rent + buy**;
**JSONL + pg0 loader**; **images to `/Volumes/KeVagiBe`**.

### What each Tier-1 source actually yields

**fotocasa** — `initialSearch.result.realEstates[]`, 31 per page:
`id`, `rawPrice` + `price`, `description` (full, not truncated), `coordinates{latitude,longitude}`,
`address{street-less: district, neighborhood, zipCode, municipality, county}`,
`multimedia[]` — **38 entries with `roomType` labels** (`"living room"`, `"kitchen"`),
`features[{key,value}]` (`air_conditioner`, `parking`, `terrace`, `elevator`, `porter_service`),
`dynamicFeatures` (`IS_EXTERIOR`, `IS_MODERN`, `IS_TEMPORARY`), `clientAlias`/`clientType`/`clientUrl`,
`phone`, `date.timestamp`, `buildingType`/`buildingSubtype`, `isTemporaryRental`, `hasFloorPlans`,
`hasVideo`, `isVirtualTour`.

**habitaclia** — `initialSearchContext.results.items[]`, 30 per page, `totalCount: 3270`:
`property{propertyType, propertySubtype, status, rooms, bathrooms, builtSurface, landArea, floor,
features{has[],hasNot[]}, energyEfficiencyCertificate{consumption,emissions}}`,
`transaction{type, price{amount, priceDrop{reductionAmount}, priceRaise}}`,
`summary{title, description (full), location{coordinates, address{streetName,streetNumber},
district, layers[neighbourhood…]}, multimedia, publisher, updatedAt}`,
`contact{email, phone}`. Note: habitaclia gives **street name + number** and a **price-drop delta**
that fotocasa does not.

**idealista** — list page `article.item[data-element-id]` + `window.utag_data`
(`list_totalResult: 1617`, `list_totalPageNumber: 54`, `list_ads_adId` CSV of all 30 ids on page).
Detail page exposes `window.adMultimediasInfo` with `fullScreenGalleryPics[]`
(`src` at 1500×1000, `tag`/`hoverText` = room type, `multimediaId`, `orientation`), plus
`plans[]`, `videos`, `visit3DTourURL`, `virtualTour360URL`; and DOM sections
`Características básicas` / `Edificio` / `Equipamiento` / `Certificado energético`
(built year, orientation, furnished state, heating type, floor, elevator).

### Anti-bot reality

- idealista `403`s plain `curl` even with full browser headers — DataDome. A clean automated
  Chrome profile is also blocked (prior session). Only the user's real logged-in Chrome passes.
- fotocasa / habitaclia / milanuncios served full pages to bare `curl` with a UA header. No auth.
- The user's idealista session is logged in; ~15% of ads carry `hasRequiredLogin=1`, so the
  session materially increases coverage. That session is also the thing we must not get flagged.

## Approach

### Architecture

```
apps/scraper/src/chezy_scraper/
  __main__.py            # typer CLI: scrape / load / stats
  config.py              # env-bound settings (paths, tiers, rate limits)
  models.py              # pydantic v2 canonical Listing + Media + Publisher + Location
  fetch/
    http.py              # httpx client: UA rotation, jitter, retry/backoff, on-disk cache
    browser.py           # CDP driver for idealista (see below)
  adapters/
    base.py              # Adapter protocol: iter_search_pages / parse_list / parse_detail
    fotocasa.py
    habitaclia.py
    idealista.py
    milanuncios.py       # tier 2, same Adevinta payload shape as habitaclia
  media.py               # image download + transcode to /Volumes/KeVagiBe
  sinks/
    jsonl.py             # raw + canonical JSONL writers
    postgres.py          # pg0 loader (asyncpg/psycopg)
  tiers.py               # small / medium / large slicing
```

**Two-layer output, always.** Every run writes (1) the untouched source payload to
`raw/<platform>/<operation>/<run-id>/page-NNN.json`, and (2) canonical `Listing` records to
`listings/<platform>-<operation>-<tier>.jsonl`. Re-parsing never requires re-fetching — this is
what makes the idealista browser path affordable, since each page load is expensive and
session-risky.

### Canonical model (`models.py`)

Designed so an LLM can match free-text queries against it. Field groups:

- **identity**: `platform`, `platform_id`, `url`, `scraped_at`, `published_at`, `updated_at`
- **transaction**: `operation` (`rent`|`sale`), `price_eur`, `price_period`, `price_per_m2`,
  `price_drop_eur`, `deposit`, `is_temporary_rental`
- **property**: `property_type`, `property_subtype`, `built_m2`, `usable_m2`, `rooms`,
  `bathrooms`, `floor`, `orientation`, `year_built`, `condition`, `furnished`, `heating`,
  `energy_consumption`/`energy_emissions` (label + value)
- **location**: `lat`/`lon`, `street`, `street_number`, `neighbourhood`, `district`,
  `municipality`, `postal_code`, `location_accuracy` (exact vs approximate — idealista blurs)
- **features**: `amenities: list[str]` normalized to a shared vocabulary across platforms
  (`elevator`, `terrace`, `parking`, `air_conditioning`, `pool`, `garden`, `exterior`,
  `wheelchair_accessible`…), plus `raw_features: dict` so nothing is lost
- **media**: `list[Media]` — `url`, `kind` (`photo`|`plan`|`video`|`tour_3d`), `room_type`
  (the labels fotocasa/idealista already provide), `width`/`height`, `local_path`
- **publisher**: `name`, `kind` (`professional`|`private`), `phone`, `email`, `profile_url`
- **text**: `title`, `description` (full), `raw_html_excerpt`

Normalization lives in per-adapter `to_canonical()`; the union of raw fields is preserved under
`source_raw` so nothing is thrown away before we know what the agent needs.

### Rate limiting and anti-bot

`fetch/http.py`:
- 1 request per 2–5 s per host (randomized), single concurrency per host, `tsp -S 1`-style
  serialization across hosts is unnecessary since the hosts are independent.
- Exponential backoff on 429/5xx, hard stop after 3 consecutive 403s with a clear error naming
  the platform (do not grind against a block).
- On-disk response cache keyed by URL so re-runs during development cost zero requests.
- Realistic `Accept-Language: es-ES`, `Sec-Fetch-*` headers — these were what made the bare
  `curl` probes succeed.

`fetch/browser.py` (idealista only):
- Drives the user's real Chrome over CDP. Reuses the already-configured `chrome-devtools` MCP
  path in spirit but runs standalone from Python so the CLI is scriptable.
- Opens **one dedicated tab**, never touches other tabs, closes it on exit.
- 5–12 s randomized delay between page loads; a hard per-run page budget (default 60) so a
  large-tier run is split across sessions rather than hammering one.
- Two-phase: first walk the 54 list pages of the shape URL harvesting `data-element-id` +
  `utag_data.list_ads_adId`, persist that id set, then fetch detail pages from it. Phase 2 is
  resumable, so an interrupted or throttled run never redoes phase 1.

### Dataset tiers (`tiers.py`)

Per platform × operation slice:

- **small** — 50 listings. Fixture-grade; commits into `apps/scraper/tests/fixtures/` (trimmed).
- **medium** — 500 listings. Iteration set for search/ranking work.
- **large** — the full result set (fotocasa ~3.3k rent + sale, habitaclia ~3.3k,
  idealista 1617 for the shape URL).

Tiers are strict supersets — medium contains small — so a feature validated on small can be
re-run on medium without re-keying anything.

### Media (`media.py`)

- Target: `/Volumes/KeVagiBe/chezy/media/<platform>/<listing_id>/<n>-<room_type>.webp`
  (42 GB free, HFS+; paths kept lowercase since HFS+ is case-insensitive).
- Transcode to **WebP, 1280px long edge, q80** — roughly 130 KB/image. That preserves enough
  texture for the vision signals you asked about (floor material, wall finish, window frames,
  kitchen surfaces) while keeping the set within the volume.
- Cap at 25 images per listing plus all floor plans (plans are high-value and few).
- **Download for small + medium tiers only** by default (~3k listings × 25 × 130 KB ≈ 10 GB).
  Large tier stores URLs only unless `--with-media` is passed — a full media mirror of the large
  tier would be ~60 GB and does not fit.
- `room_type` from the source is carried into the filename *and* the record, so vision
  experiments get free weak labels.
- A `media_manifest.jsonl` maps listing → local paths, letting the dataset move volumes without
  a re-scrape.

### Persistence

- JSONL is the source of truth on disk, under `.data/` in the repo (gitignored — note
  `.gitignore` currently does **not** cover `data/`, `*.jsonl`, or `.audit/`; that needs adding).
- `sinks/postgres.py` loads canonical records into pg0 (`mise run db:start`). Table
  `listings` mirrors the pydantic model; `media` is a child table. This is where pgvector
  embeddings will hang off later for the NLP search layer — hence Postgres over SQLite.
- The Drizzle-side schema in `packages/db/src/schema/listings.ts` is written to match, so
  `apps/web` can read the same tables. Per `.agents/docs/architecture.md`, `apps/scraper` stays
  import-isolated from `packages/*` — the shared contract is the SQL table shape plus a
  `packages/contract` Valibot schema mirroring the pydantic model, not a code dependency.

## Files

**New** (all under `apps/scraper/src/chezy_scraper/`): `config.py`, `models.py`, `tiers.py`,
`media.py`, `fetch/{http,browser}.py`, `adapters/{base,fotocasa,habitaclia,idealista,milanuncios}.py`,
`sinks/{jsonl,postgres}.py`.

**Modified**:
- `apps/scraper/src/chezy_scraper/__main__.py` — replace hello-world with the CLI.
- `apps/scraper/pyproject.toml` — add `typer`, `pillow`, `psycopg[binary]`, `tenacity`,
  `websockets` (CDP); `parsel` and `httpx` are already declared.
- `.gitignore` — add `.data/`, `*.jsonl`, `.audit/`.
- `packages/db/src/schema/listings.ts` + `packages/db/src/index.ts` — first real schema.
- `packages/contract/src/index.ts` — Valibot mirror of the canonical Listing.
- `.agents/notes/2026-09-19-scraper-scout.md` — record the anti-bot findings above.

**Reused**: `chezy_scraper.observability` (structlog + `audit.emit`) for per-run audit events —
one `scrape.page`, `scrape.listing`, `scrape.blocked` event each, so a blocked run is diagnosable
after the fact. Note it currently calls `structlog.stdlib.ProcessorFactory`, which does not exist
in structlog 24.x; that needs fixing before it can be relied on.

## Verification

1. `uv run scraper scrape --platform fotocasa --operation rent --tier small` → 50 records in
   `.data/listings/fotocasa-rent-small.jsonl`; spot-check that `coordinates`, `description`,
   and ≥10 `media` entries with `room_type` are populated.
2. Same for `habitaclia`; confirm `rooms`, `bathrooms`, `built_m2`, `energy_consumption`, and
   `street_number` are non-null on a majority of records — these are the fields fotocasa lacks.
3. `uv run scraper scrape --platform idealista --operation rent --tier small` with the shape URL
   → watch that exactly one tab opens and closes, page budget is respected, and
   `adMultimediasInfo` yields the full gallery (13 images on ad 99569815, the one I verified).
4. `uv run scraper media --tier small` → files land on `/Volumes/KeVagiBe`; `du -sh` the tree and
   confirm the per-image size lands near the 130 KB estimate; open two images and confirm floor
   and wall texture are legible at 1280px.
5. `mise run db:start && uv run scraper load --tier small` → `select count(*), platform from
   listings group by platform` matches the JSONL counts.
6. `mise run validate` clean (ruff + basedpyright strict + pytest). Capture a baseline first per
   global rule 9c — `scripts/validate.py` currently passes `--passwithno-tests`, which is not a
   pytest flag and will hard-error under `--strict-config`, so expect that as a pre-existing
   failure to fix or confirm.
7. Adapter unit tests parse the committed HTML/JSON fixtures offline — no network in CI.

## Open item

Global policy requires all work to link to a refined task in a Project, and no GitHub Project
URL is recorded in `AGENTS.md`. `.agents/plans/` does not exist despite being referenced. On
approval I will create `.agents/plans/2026-09-19-listing-scraper.md`; you will need to point me
at the Project (or confirm working without one for this hackathon build).
