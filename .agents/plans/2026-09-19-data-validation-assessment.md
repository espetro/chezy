# Data validation and cleaning assessment, 2026-09-19

Scope: assessment only. Nothing in `apps/scraper`, masters or tiers was changed. Every number
below was computed read only over `.data/listings/*.jsonl` (the 6 masters: fotocasa 62+62,
habitaclia 60+60, milanuncios 82+82 = 408 rows; the tier slices are strict prefixes, verified
for all 12 pairs). Analysis scripts lived in `/tmp/chezy-val/` and are not part of the repo.

## 0. Read this first: sample caveats

- 408 rows is a first-page sample, not a market sample. Fotocasa rent median is 4080 EUR/month
  (habitaclia 6000), far above Barcelona's real median, so the search default order is
  skewed to premium or recent listings. Do not calibrate market thresholds to these
  distributions. Thresholds below are plausibility bounds, checked only to confirm they do not
  fire on legitimate rows.
- Milanuncios is 82 of ~2270 rent ads, fotocasa 62 of an unknown universe. Cross portal overlap
  measured here is bounded by sample size, not by the true cross-post rate.
- Idealista has no data yet. Every rule must be re-run on the first live idealista file.

## 1. Value sanity: what the data actually shows

Null rates are per platform, rent and sale merged where equal.

| Field | fotocasa | habitaclia | milanuncios |
| --- | --- | --- | --- |
| price, built_m2, rooms | 0% null | 0% null | 0% null rent; sale 7% null m2/rooms/baths |
| bathrooms | 0 to 2% | 0 to 2% | 0% null, but see "0 baths" below |
| lat/lon | 0% | 0% | 100% (never supplied) |
| street | 100% | 2% | 100% |
| energy label | 100% | 12% rent, 30% sale | 100% |
| published_at | 0% | 100% | 0% |
| postal_code | 0% | 100% | 100% |
| is_temporary_rental | False or True always | True or None only (never False) | 100% null |

Ranges (min / p50 / max):

- fotocasa rent price 1550 / 4080 / 12000; built 40 / 140 / 395; price_per_m2 14.9 / 29.9 / 64.8.
- habitaclia rent price 1550 / 6000 / 25000; built 50 / 196 / 886; ppm2 17.6 / 30.9 / 64.8.
- milanuncios rent price 800 / 1800 / 10000; built 1 / 50 / 234.
- sale ppm2: fotocasa 3559 to 11236, habitaclia 2212 to 12141. Sale price max 6.5M (habitaclia).
- lat 41.373 to 41.428, lon 2.094 to 2.219 (fotocasa and habitaclia, 240 pinned rows). Zero rows
  outside a Barcelona box of lat 41.32 to 41.47, lon 2.05 to 2.23. Municipality is always
  Barcelona (fotocasa 122, milanuncios 164) or the variant `Barcelona Capital` (habitaclia 120,
  fotocasa 2): normalisation needed, not a defect.
- Postal codes all 08001 to 08037. price_per_m2 agrees with price/built within 2% everywhere
  it exists. No `updated_at < published_at`, no timestamps after `scraped_at`.

Concrete outliers (platform / operation / platform_id):

| Problem | Rows | Verdict |
| --- | --- | --- |
| `built_m2 == 1` placeholder ("1 m²" tag) | milanuncios rent: 543389840, 543397254, 543391557, 601149874, 600981796, 543395196, 543394323, 543398353, 543396367, 543398362 (10 of 82, 12%) | Parse artefact of the source. Rooms are real (0 to 5), m2 is not. Implies ppm2 of 1145 to 3000. |
| Non listing ads: `sell_type == demand`, `origin.provider == null` | milanuncios sale: 528982369 (145000), 530084818 (0), 543745003 (0), 541600586 (0), 489906138 (999999), 401149599 (99000) | 6 of 82 sale rows are "we buy your flat" or "buy part of a flat" ads, not stock. Three have price 0, one is the 999999 sentinel. One rule catches all six. |
| Price 0 | the three above | Error. |
| Implausible rent ppm2 (>80 EUR/m2/month) after removing 1 m2 rows | milanuncios rent: 543398386 (6500 for 70 m2), 543397226 (2070/21 m2), 583978214 (8000/80), 543386197 (6933/80) | Warn. Three are premium or serviced (one has "servicios... limpieza semanal"), one is a 21 m2 studio at 98 EUR/m2. Plausible but worth flagging. |
| "0 baths" with rooms >= 1 | milanuncios: 604486158, 595997184, 613025813, 612709173, 543357215, 595997255 (rent), 615547775 (sale) | Placeholder, not truth. Five of the milanuncios rows with `baños: '0'` also contain unfilled `??m²` template text in the description. Treat as unknown. |
| rooms 0 with built > 50 m2 | milanuncios rent 543393350 (55), 543396612 (60), 543396636 (65); habitaclia sale 59765000000005 (508 m2) | Milanuncios "0 dormitorios" means studio only up to ~45 m2, above that it is unknown. The habitaclia row is a whole historic building ("Edificio historico reformado en centro del Born", rooms 0, baths 0, 3.5M) typed as `flat`. |
| Large built area | habitaclia rent 4737003824060 (886 m2, 25000, 10 rooms), 4017003411060 (510, 16000), 4737003817460 (511, 16000); habitaclia sale 51125000000413 (1250 m2, 13 rooms, "residential building"), 2277003488096 (453), 59765000000005 (508); fotocasa sale 190374019 (534, 6M duplex) | All coherent with price and type. Warn only, never error. |
| usable_m2 > built_m2 | habitaclia rent 531205772786, 4017003411060 | Warn, tiny. |
| Description placeholder `??m²` | fotocasa rent 190660009 (also: no bathroom key in source, so its null is legitimately sparse) and 8 milanuncios rows | Text quality warn. |

Rooms distribution: rooms 0 appears 23 of 82 milanuncios rent rows, 0 of 76 milanuncios sale
rows, and 1 habitaclia sale row. Rooms range 1 to 7 (fotocasa), 1 to 10 (habitaclia), 1 to 13 max.

## 2. Duplicates: measured

### In platform

- `platform_id` duplicates: 0 in every master. `url` duplicates: 0. Cross operation id reuse: 0.
  The scrape pipeline enforces this (`known` set), so this check is a cheap invariant, not a finding.
- Same agency listing the same unit repeatedly (same price + m2 + rooms + baths, different id):
  fotocasa rent (5635, 232 m2, 5 rooms, 3 baths) x2; habitaclia rent the same key x2 and
  (10000, 200 m2, 3 rooms) x2; milanuncios rent 4 keys x2, sale 6 keys x2. Description text
  shows milanuncios 596297411 / 596389086 are the same unit re-posted (desc similarity high);
  the fotocasa/habitaclia pairs are ambiguous (see below).

### Cross portal (silver truth = shared image UUID)

Fotocasa and habitaclia (same group) serve photos from the same `static.fotocasa.es/images/ads/<uuid>`
host, and milanuncios uses `images-re.milanuncios.com/images/ads/<uuid>`. Shared image UUIDs give
a labelling signal independent of the fields being tested.

- 82 listing pairs share at least one image UUID: 76 fotocasa to habitaclia, 3 habitaclia to
  milanuncios, 2 fotocasa to milanuncios, 1 fotocasa to fotocasa.
- Of those 82, 81 are cross platform pairs and 80 of those have an identical price. Image
  overlap alone is still not sufficient: 188770763 vs 188770746 (both fotocasa sale) share
  11 images (same building) but sell different units (752000/89 m2 vs 548000/60 m2). One
  of 82 image pairs is a false positive on price/m2. Fotocasa 189275746 vs habitaclia 8166003810671
  is a true duplicate with built 115 vs 132 m2 (one side probably reports usable), so an
  exact m2 key would miss it.
- Fotocasa to habitaclia cross links: 39 of 62 fotocasa rent, 41 of 60 habitaclia rent,
  40 of 62 fotocasa sale, 37 of 60 habitaclia sale rows have a counterpart. That is a 60%
  to 70% overlap between the two portals in this sample, and it is the dominant duplication.
- Milanuncios: only 3 of 82 rent and 3 of 82 sale rows link to fotocasa or habitaclia by image
  or description. Yet 82 of 82 rent and 76 of 82 sale ads say `origin.provider = fotocasa_pro`.
  The previous session's inference ("largely fotocasa cross-posts") is right about origin but
  the sample cannot confirm a high in dataset overlap because the two samples are tiny
  slices of large universes. Expect the true ratio to appear only at large tier. The 6
  remaining sale ads are the `demand` non listings above.

Candidate keys scored against the silver truth (81 cross platform pairs):

| Key | Candidate pairs | Hit silver truth | Precision | Recall |
| --- | --- | --- | --- | --- |
| op + price + built_m2 + rooms + baths | 86 | 80 | 0.93 | 0.99 |
| op + price + built_m2 | 88 | 80 | 0.91 | 0.99 |
| op + lat/lon rounded to 3 decimals + price | 46 | 46 | 1.00 | 0.57 |
| op + lat/lon rounded to 4 decimals + price + m2 | 6 | 6 | 1.00 | 0.07 |
| description first 400 chars, ratio >= 0.85 (difflib) | not scored as key | all fotocasa to habitaclia truth pairs score 1.00; non matching pairs p50 0.05, p95 0.13, max 0.68 | clean separation | needs text on both sides |

Why coordinates must be a distance test, not a rounding key: for the 76 fotocasa/habitaclia
truth pairs the pin distance is p50 19 m, p90 162 m, max 347 m, and only 3 are 0 m.

Why price alone is unsafe: all 6 false positives of the price+m2+rooms+baths key come from the
same two situations: an agency listing near identical units (aProperties 10000/200/3 x4 across
three portals; REVEL vs aProperties on 5635/232/5 with descriptions differing at 0.04 to 0.05
similarity), and one true coincidence across unrelated agencies (habitaclia sale 38188000001872
vs milanuncios sale 615545377, 370000/60/4, desc sim 0.11). Rule of thumb from the data: a
price key needs a second, independent signal.

Prototype linking rule (price within 1%, same operation, plus at least one confirmer):
shared image UUID, or description ratio >= 0.85, or pins within 400 m and built_m2 within
15%. Result over 408 rows: 84 confirmed (image or description) edges, 7 geo only edges, 323
clusters (243 singletons, 76 pairs, 3 triples, 1 quad). So about 21% of rows are duplicates
in this sample (rent 204 rows to 160 clusters, sale 204 to 163). The 7 geo only edges are the
ambiguous tier: possible same agency multi listing or two agencies on one unit. They should
be reported, not merged automatically.

Tier interaction: of the 84 confirmed edges, only 66 have both endpoints inside the small
slices; 13 have one endpoint outside. Each platform's first 50 are scraped independently, so
cross portal dedupe on a small tier will miss links whose partner sits in the tail of the
master. Clusters must be computed over the master, then projected per tier.

## 3. Rental type (is_temporary_rental)

- Fotocasa rent: 31 of 62 rows (50%) flagged `isTemporaryRental = true` (28 also carry the
  `IS_TEMPORARY` dynamic feature, 3 do not). Median rent of flagged rows 3400 vs 4451 for
  unflagged. Half of "rent" in this sample is seasonal, which changes any rent analysis.
- Habitaclia: the adapter sets `True` only if `IS_TEMPORARY` is present, otherwise `None` (never
  `False`). For 17 rent rows linked to a fotocasa twin that is temporary, habitaclia flags only
  5 (recall 29%), and the other 12 have `None`. So habitaclia `None` cannot be read as
  "permanent". Verified counts: (fotocasa, habitaclia) flag pairs = (False, None) 22,
  (True, None) 12, (True, True) 5.
- Milanuncios: 100% `None`. Text carries the signal:
  - 568615690 (3397/month, the case from the previous session): "se arrienda unica y
    exclusivamente por uso vacacional o recreativo ... Duracion maximo de 89 dias".
  - 615437683 (2700) same template; 595900568 (3500): "Alquiler de vivienda temporal/vacacional".
  - A narrow regex (`uso vacacional`, `uso recreativo`, `duracion maxim[oa]`, `vivienda
    temporal`, `alquileres? temporales?`, `finalidad del contrato es temporal`,
    `contratos? vacacionales?`, `de 1 a 11 meses`, `finalidad de ocio`) finds 3 of 82
    milanuncios rent ads. Sanity check against portal flags (broad variant including
    `temporal`): it matches 16 of 31 fotocasa flagged rows and 0 of 5 habitaclia flagged rows,
    and the narrow variant matches none of them (their text says "temporal", not "uso
    vacacional"). So text rules are a recall booster for `None`, not a replacement for the
    portal flag, and the rule set must be tuned per template family.
  - Do NOT use the word `turistic*`: 10 milanuncios hits are "atracciones turisticas" prose or
    "sin pisos turisticos", none are temporary rentals. `estancia` and `semana` also
    misfire (living room, "fines de semana").
- Cluster inheritance helps: a milanuncios row linked to a fotocasa twin can take the
  fotocasa flag.

Proposed derived field `rental_term`: `temporary | long_term | unknown`, with `rental_term_source`
(`portal_flag | text_rule | cluster | none`). Never write back to `is_temporary_rental`.

## 4. Location accuracy

Distribution: fotocasa `zone` 120, `exact` 4; habitaclia `street` 86, `zone` 31, `exact` 3.
Raw fotocasa `coordinates.accuracy` is 0 for 120 rows and 1 for 4 rows.

Evidence from the 76 twins (fotocasa vs habitaclia pin distance, m):

- fotocasa accuracy 1 (mapped `exact`) vs habitaclia `exact`: 3 pairs, distance 0, 0, 0. The
  one directional test we have supports the heuristic (n = 3, do not overclaim).
- fotocasa accuracy 0 (mapped `zone`) vs habitaclia `street`: 55 pairs, distances 5 to 45 m,
  median about 16 m. So fotocasa `zone` pins are near the street level pin for those rows:
  the label `zone` understates them. Fotocasa lat has 13 to 15 decimals, consistent with a
  jittered or projected coordinate, not a rounded neighbourhood centroid.
- fotocasa `zone` vs habitaclia `zone`: 18 pairs, 43 to 347 m (median about 150 m): these
  really are blurred.
- Caveat: habitaclia `street` is itself an unverified portal claim. 55 agreeing pairs show
  mutual consistency, not ground truth.

Recommendation: keep the model label as is (mapping is portal derived), but add a derived
`geo_error_m_estimate` only where a twin exists, and never validate accuracy by rule. Validate
only the invariants: `location_accuracy` present iff lat/lon present, lat and lon both or
neither, coordinates inside the Barcelona box.

## 5. Parse failure vs legitimately sparse

Current pipeline has no failed record class: `to_canonical` exceptions abort a whole page
(no per item try/except), and a bad parse otherwise yields nulls that look like sparse data.
Examples in this data:

- Legitimately sparse: fotocasa 190660009 has no `bathrooms` key in `source_raw.features`;
  habitaclia sale 51125000000413 raw `bathrooms: null`. The source is empty, canonical null is right.
- Platform structural nulls: milanuncios never has lat, street, energy, postal_code. Not a
  failure of any record.
- Parse artefact: milanuncios `1 m²` and `baños: '0'`: the parser is faithful, the source is
  wrong. It needs a quality flag, not a parser fix.

Design: an expected fields profile per (platform, operation), learned from data and pinned in
code, e.g. `EXPECTED_ALWAYS = {fotocasa: price, built_m2, rooms, lat, lon, district, description, publisher; habitaclia: price, built_m2, rooms, bathrooms, lat, lon, district, street, description; milanuncios: price, description, published_at}`.
Classification per row:

1. `parse_failed`: required identity or price missing, or an expected always field is null
   while the raw payload has a non null value at the known source path (the reparse test:
   run the adapter on `source_raw` and compare). This needs source paths per field; start
   with a small table for price, built_m2, rooms, bathrooms, lat/lon.
2. `not_a_listing`: milanuncios `sell_type == demand`, price 0.
3. `source_bad`: parse faithful but value implausible (1 m2, baths 0 with rooms >= 1).
4. `sparse`: null only for fields outside the platform profile or null in source. No action.

Also add a reparse invariant (no network): re-run each adapter's `to_canonical` on
`source_raw` and diff against the stored row. Flags stale parsers after a mapping fix without
a re-scrape.

## 6. Proposed design

### Commands

```
uv run scraper validate [--tier small|medium|large] [--platform ...] [--fail-on error|warn|never] [--json PATH]
uv run scraper derive   [--tier ...]   # phase 2, writes derived files, no network
```

`validate` reads the tier file or master, prints per rule counts by platform and operation, lists
the first N offending ids per rule, exits non zero only for `error` when `--fail-on error`.
It writes nothing, except optionally `--json` under `.data/derived/`. It is safe to run in
`mise run validate`.

### Derived files (never mutate masters or tiers)

```
.data/derived/<platform>-<operation>.quality.jsonl     one row per master row, same order
.data/derived/clusters-<operation>.jsonl              one row per master row: cluster_id, is_primary, ...
.data/derived/derive_manifest.json                    rules version, master lengths and sha256 of ids
```

`quality.jsonl` row: `{platform, platform_id, master_pos, severity, flags:[{code, severity, detail}], record_class, rental_term, rental_term_source, clean: {built_m2, rooms, bathrooms}}`.
`clean` holds a sanitised view (1 m2 to null, baths 0 with rooms >= 1 to null), so consumers can
use effective values without overwriting the truth.
`clusters` row: `{platform, platform_id, cluster_id, cluster_size, is_primary, link_signals, link_confidence: confirmed|possible}`.

### Tier superset guarantee

- Masters are append only and first seen ordered; tiers are `master[:N]`. Derived files are
  row aligned to the master (same order, same length, keyed by `(platform, platform_id)`), so
  `quality[:N]` is the tier's quality data automatically. Nothing is removed or reordered.
- Row level facts (flags, record_class, rental_term) depend only on that row, so they are
  identical across tiers. That keeps the superset property literal: small quality rows are a
  prefix of medium's.
- Cluster level facts depend on the whole master. Make them stable under growth:
  `cluster_id = "c_" + <platform>_<platform_id> of the earliest member by (scraped_at,
  platform priority, master_pos)`. New members only ever join; when two clusters merge the
  older id survives and the loser is written as an alias line. `is_primary` is a fixed platform
  priority (habitaclia > fotocasa > idealista > milanuncios, because habitaclia has street and
  energy, milanuncios is thinnest) then earliest master_pos.
- A deduped view of a tier is computed on read: keep rows where `is_primary` or where no
  cluster member with higher priority is inside the tier. This is a view, not a file,
  because whether a duplicate's primary sits in the tier depends on the tier. The 13 of 84
  cross tier edges seen in small show this is real.
- Re-derive is idempotent and deterministic; `derive_manifest.json` records the master length
  so `validate` can warn when derived files are stale versus the master.

### Postgres, Drizzle, Valibot impact

Keep it out of the `listings` table and out of `LISTING_COLUMNS`. `postgres.load` upserts every
column in `_NAMES` on conflict; extra derived columns on `listings` would either get clobbered
or force coupling of scrape and derive. Add two tables keyed by `(platform, platform_id)` with a
foreign key to `listings` (`on delete cascade`):

- `listing_quality(platform, platform_id, severity, record_class, flags jsonb, rental_term,
  rental_term_source, clean_built_m2, clean_rooms, clean_bathrooms, rules_version, derived_at)`.
- `listing_cluster(platform, platform_id, cluster_id, cluster_size, is_primary, link_confidence,
  link_signals jsonb)`.

Mirrors (per README, "SQL DDL, Drizzle, Valibot" move together): add `listingQuality` and
`listingCluster` to `packages/db/src/schema/listings.ts` (or a new `quality.ts`); add
`ListingQualitySchema` and `ListingClusterSchema` to `packages/contract/src/listings.ts` with a
fixture built from real `derive` output so the existing drift test pattern covers them. A
convenience SQL view `listings_clean` joins them for the chat app (exclude `not_a_listing` and
`parse_failed`, `is_primary` only) and is where LLM search should point by default. Loader
change: `scraper load --with-derived`, same idempotent upsert in the same transaction.

### Rule list (thresholds anchored to data above)

Severity `error` marks a row as excluded from `listings_clean`. `warn` keeps it, records the flag.

| Code | Rule | Severity | Data justification |
| --- | --- | --- | --- |
| `id.dup` | duplicate (platform, platform_id) or url in master | error | 0 today, invariant |
| `price.missing_or_zero` | price null or <= 0 | error | 3 milanuncios sale rows, all `demand` ads |
| `ad.not_listing` | milanuncios `sell_type == demand` | error | 6 of 82 sale rows, all non stock |
| `price.sentinel` | price in {99999, 999999, 1111111} | warn | 1 hit (489906138, also demand) |
| `price.rent_abs` | rent price < 300 or > 30000 | error; 15000 to 30000 warn | max seen 25000 (886 m2 house); 4 warns at > 15000 all >= 500 m2 |
| `price.sale_abs` | sale price < 30000 or > 30M | error; < 80000 or > 10M warn | 0 warns today, min 129000 |
| `m2.placeholder` | built_m2 < 10 | error (source_bad) | 10 milanuncios rent rows, all exactly 1.0 |
| `m2.large` | built_m2 > 500 warn, > 3000 error | warn | 6 rows, all coherent big houses or buildings |
| `m2.usable_gt_built` | usable > built | warn | 2 habitaclia rows |
| `ppm2.rent` | price/built (built >= 10) outside [6, 80] EUR/m2/month | warn | 4 milanuncios rows hit above 80; fotocasa/habitaclia range 14.9 to 64.8 |
| `ppm2.sale` | outside [1500, 15000] EUR/m2 | warn | fotocasa 3559 to 11236, habitaclia 2212 to 12141; 0 hits, headroom kept |
| `ppm2.mismatch` | given price_per_m2 differs from price/built by > 2% | warn | 0 hits |
| `rooms.range` | rooms < 0 or > 15 error; > 8 warn | warn | 2 rows > 8 (10, 13) both large houses or buildings |
| `rooms.zero_large` | rooms == 0 and built > 50 | warn | 4 rows (3 milanuncios rent, 1 habitaclia building) |
| `baths.zero_placeholder` | bathrooms == 0 and rooms >= 1 | warn, cleaned to null | 7 milanuncios rows, correlates with `??m²` template text |
| `baths.range` | baths > rooms + 3 or > 8 | warn | 0 hits |
| `geo.bbox` | lat/lon outside 41.32 to 41.47, 2.05 to 2.23 | error | 0 hits, observed 41.373 to 41.428 |
| `geo.pair` | only one of lat/lon, or accuracy set without coords | error | 0 hits, invariant |
| `geo.municipality` | municipality not in {Barcelona, Barcelona Capital} | warn | normalise variant, 122 rows use it |
| `geo.postal` | postal_code not `080\d\d` | warn | 0 hits |
| `date.order` | updated < published, or either > scraped_at + 1 day | warn | 0 hits |
| `rental.temporary_text` | text rule hits and flag is not True | warn, sets `rental_term` | 3 milanuncios rent hits |
| `rental.flag_conflict` | flag False but text rule hits | warn | 0 today |
| `text.placeholder` | description contains `??` | warn | 9 rows |
| `text.missing` | description null or < 40 chars | warn | 0 hits |
| `media.empty` | media list empty | warn | 0 hits |
| `sparse.profile` | expected always field null (see section 5) | warn, class `parse_failed` if raw has the value | 0 hits by the profile above |

`validate` output should print a per rule per platform table so a new platform (idealista)
is judged against its own profile and thresholds are tuned once, in one file.

## 7. Phased build plan

| Phase | Deliverable | Effort | Files |
| --- | --- | --- | --- |
| 1 | `scraper validate` report only: rules engine, expected field profiles, per rule table, `--json`, `--fail-on` | S to M (about 1 day) | `apps/scraper/src/chezy_scraper/quality/rules.py`, `quality/profile.py`, `quality/report.py`, edit `__main__.py` to add the command; `tests/test_quality_rules.py`, `tests/test_validate_cli.py` |
| 2 | Row level derive: `quality.jsonl` with `clean` view, `rental_term`, record classes; reparse invariant | M (1 to 2 days) | `quality/derive.py`, `quality/rental.py`, `tests/test_derive_quality.py`, `tests/test_rental_term.py`, edit `config.py` for `derived_dir` |
| 3 | Cluster derive: blocking (operation + price within 1%), confirmers (image UUID, description ratio, geo + m2), stable ids and aliases, confirmed vs possible | M to L (2 days) | `quality/dedupe.py`, `quality/imgkey.py`, `tests/test_dedupe.py` (fixtures hand built from the pairs above), tier property test |
| 4 | Postgres, Drizzle, Valibot mirrors, `listings_clean` view, `load --with-derived` | M (1 to 2 days) | `sinks/postgres.py` (new DDL, separate from `LISTING_COLUMNS`), `packages/db/src/schema/quality.ts`, `packages/contract/src/quality.ts` and fixture, extend `test_postgres.py` |
| 5 | Idealista re-baseline after the first live run, tune profile and thresholds | S | `quality/profile.py`, notes file |

Tests to write (by phase):

- Phase 1: table driven rule tests, one fixture row per rule from the IDs listed above; a test
  that runs `validate` over the checked in real fixture files and asserts no `error` on
  legitimate rows; asserts `validate` never writes into `listings_dir`.
- Phase 2: `clean` view never contains a sanitised value that differs from raw for
  a non flagged row; reparse invariant returns no diffs on the real masters.
- Phase 3: symmetry (order of input does not change clusters), monotonic growth (adding
  rows never changes an existing `cluster_id`), merge writes an alias, geo only edges are
  `possible`, same agency near identical units are not merged (aProperties 10000/200/3 case),
  the 188770763/188770746 shared building case is not merged.
- Tier property: `quality[:50]` equals the quality of the small slice; a deduped small view
  is a subset of small; masters and tier files are byte identical before and after `derive`.

## 8. Risks

- Small sample: thresholds are plausibility bounds, not calibrated. Recheck at medium tier and
  after idealista lands. Idealista adds a fourth portal and is the likeliest to shift rules
  (parsed from free text lines, unverified selectors).
- Overmerge: same agency posting near identical units in one building looks like a duplicate.
  Mitigation: confirmers required, `possible` tier is report only.
- Undermerge: milanuncios has no coordinates or street, thin descriptions with a `Ref: NNN`
  prefix that lowers similarity, image UUIDs differ per host. all 5 linked milanuncios pairs
  score 0.95 to 0.96 on description ratio; a normalisation step (strip `Ref: ...`,
  whitespace, lowercase) is needed before scoring.
- Append only staleness: `scrape` skips ids in `known`, so price changes and delisted ads are
  never refreshed and `updated_at` moves on the portal but not in the master. Duplicate and
  price checks operate on stale values. Out of scope here, but the manifest should record
  master `scraped_at` ranges.
- `_tier_listings` globs `*-{tier}.jsonl`, so `--tier large` would find nothing because masters
  have no `-large` suffix; and no `-medium` files exist yet. Not a validation issue, but
  `validate` and `derive` should resolve the master directly for large.
- Coupling: derive is deliberately outside `LISTING_COLUMNS` so a re-`load` cannot clobber
  it. The cost is one more pair of tables to mirror.
- Time and money: no network; `derive` over 408 rows takes seconds. Pairwise description
  similarity is O(n^2) inside price blocks; fine for thousands, needs a shingling or minhash
  blocker before the large tier.
- Failed record separation depends on a maintained source path table per platform; the
  reparse diff covers drift automatically but not new fields.

## 9. Open questions

1. Should `not_a_listing` and `parse_failed` rows be dropped from the Postgres load
   entirely, or loaded and hidden by `listings_clean`? This plan loads everything.
2. Primary source priority for a cluster: habitaclia first (street, energy), or fotocasa
   first (publisher, coordinates blur)?
3. How should the chat product treat `rental_term = temporary`: exclude from rent search by
   default, or surface with a badge? About half of fotocasa rent in this sample is temporary.
4. Are two agencies listing the same unit (REVEL vs aProperties on 5635/232 m2) one property
   or two products for the user?
5. Is stale data acceptable, or should `scrape` learn to refresh known ids before we trust
   price based dedupe?
6. Acceptable to change habitaclia's `is_temporary_rental` to `False` when the platform
   explicitly lists no `IS_TEMPORARY`? The data shows that would be wrong 12 of 17 times, so
   leaving `None` and using `rental_term` is safer.
