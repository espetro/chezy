# Dataset sizing and packaging assessment, 2026-09-19

Scope: assessment only. Nothing was implemented, committed, scraped or written to
`/Volumes/KeVagiBe`. All numbers below were measured from `.data/`, the media volume and pg0
(SELECT only), or are labelled as estimates. Scratch files lived in `/tmp/ds/`.

Task linkage: this needs a refined GitHub Project item before implementation starts (global
rule). None was created here.

## 0. Findings that change the plan

1. The "large" tier is much bigger than the plan assumed. Result-set totals read from the raw
   payloads on disk:

   | Platform | Rent | Sale | Notes |
   | --- | --- | --- | --- |
   | fotocasa | 3306 | 14381 | 31 per page, so 107 + 464 pages |
   | habitaclia | 3270 | 14262 | 30 per page, so 109 + 476 pages |
   | milanuncios | 2270 | 8200 reachable | search reports 10000 (`gte`) but `totalPages` is 200 x 41 |
   | idealista | 1617 (shape URL) | unknown | 30 per list page, one detail page per listing |

   Fotocasa "3.3k" is rent only. Known large (3 HTTP platforms) is 45689 listings, not 6.6k.
   Whether fotocasa and habitaclia allow paging to page 464 and 476 is untested.
2. Images dominate everything. Data is about 1 percent of bytes; images are about 99 percent.
3. A mirrored listing has about 24 images (cap is 25) at about 70 KB, so 1.7 MB per listing,
   not 25 x 130 KB = 3.2 MB as planned. Real medium media is about 6 GB, not 10 GB.
4. `media_manifest.jsonl` and the media tree currently cover only fotocasa and habitaclia
   (100 listings each, 4768 files). The 100 milanuncios small listings have no mirrored images.
   The "200 small listings" in the scout note are fotocasa plus habitaclia only.
5. JSONL on disk has `media[].local_path` null everywhere. It is filled only at pg load time
   from the manifest. A shareable JSONL must be written with paths filled in.
6. `source_raw` is redundant with `raw/` pages (it is the listing object inside the page). A
   bundle needs one or the other, not both.
7. Tiers are prefixes of first seen order (search relevance order), not random samples. Small
   and medium are biased to whatever each portal ranks first. The datacard must say so.
8. 94 of 100 small milanuncios ads (252 of 264 in the master files) carry
   `origin.provider = fotocasa_pro`, so they are mostly fotocasa cross-posts. No shared id
   exists. The cheapest dedupe key is the image UUID: fotocasa and milanuncios image URLs share
   the pattern `.../images/ads/<uuid>`. On today's data the overlap is small (35 of 1412 rent
   UUIDs) only because the fotocasa master holds 62 of 3306 listings, so this proves nothing yet.
9. PII: phone is present on 196 of 300 small listings, email on 100 (habitaclia). Phone and
   email also live inside `source_raw`. Two small listings are `kind=private` with a name.
10. `psql` and `pg_dump` are not on PATH. `duckdb` CLI exists via mise. `pyarrow` and the
    `duckdb` Python module are not installed in the scraper venv.

## 1. Measured per listing costs

Sample: 300 small listings (fotocasa, habitaclia, milanuncios, rent and sale, 50 each),
raw pages, 4768 mirrored images, pg0 with 200 listings and 7442 media rows.

| Platform and op | JSONL full | JSONL without source_raw | source_raw | description | media entries |
| --- | --- | --- | --- | --- | --- |
| fotocasa rent | 20.9 KB | 11.0 KB | 11.0 KB | 2.1 KB | 37 |
| fotocasa sale | 19.9 KB | 10.5 KB | 10.5 KB | 1.9 KB | 35 |
| habitaclia rent | 22.7 KB | 12.3 KB | 11.5 KB | 2.3 KB | 43 |
| habitaclia sale | 19.3 KB | 10.1 KB | 10.2 KB | 2.0 KB | 33 |
| milanuncios rent | 8.8 KB | 5.5 KB | 3.8 KB | 1.0 KB | 17 |
| milanuncios sale | 12.8 KB | 8.0 KB | 5.4 KB | 1.8 KB | 26 |
| all 300 | 17.4 KB | 9.6 KB | 8.7 KB | 1.9 KB | 32 |

Raw payload bytes per listing (page bytes divided by listings on the page): fotocasa about
20.7 KB, habitaclia about 11.5 KB, milanuncios about 4.8 KB. Raw for the 6 runs is 5.46 MB.

Images (fotocasa and habitaclia only, from the volume):

| | Value |
| --- | --- |
| files | 4768 (2373 fotocasa, 2395 habitaclia) |
| images per listing | 23.7 fotocasa, 23.95 habitaclia (cap 25 hit by most) |
| bytes per image | 73.0 KB fotocasa, 68.8 KB habitaclia; p50 59 KB, p90 129 KB, p99 238 KB, max 400 KB |
| bytes per listing | 1.73 MB fotocasa, 1.65 MB habitaclia |
| total | 332 MB on disk |

Re-encode experiment (80 random mirrored files, Pillow WebP, in `/tmp` only):

| Profile | Avg bytes | vs current |
| --- | --- | --- |
| 1280 px q80 (current) | 64.6 KB | 1.00 |
| 1024 px q75 | 36.4 KB | 0.56 |
| 800 px q75 (lite) | 25.9 KB | 0.40 |
| 640 px q70 | 17.6 KB | 0.27 |

Postgres (pg0, `pg_total_relation_size`): `listings` 2.03 MB for 200 rows (10.2 KB per row,
`source_raw` is TOASTed, 5.7 KB average compressed); `listing_media` 1.97 MB for 7442 rows
(264 bytes per row including the PK index). About 20 KB per listing all in. Whole database
12.4 MB. No embeddings are stored yet; a 1536 dim float4 vector would add about 6 KB per
listing.

Compression, actually run on the 300 listing sample:

| Payload | Raw | zstd 19 | gzip 6 (zip deflate class) | Ratio zstd / deflate |
| --- | --- | --- | --- | --- |
| JSONL with source_raw | 5.22 MB | 378 KB | 673 KB | 13.8x / 7.8x |
| JSONL without source_raw | 2.87 MB | 296 KB | 505 KB | 9.7x / 5.7x |
| raw pages | 5.46 MB | 463 KB | 1.04 MB | 11.8x / 5.2x |
| Parquet zstd, full (source_raw as struct) | | 785 KB | | |
| Parquet zstd, no source_raw | | 324 KB | | |
| SQLite (JSON column) | 5.45 MB | 401 KB | | |
| WebP, 300 files | 19.50 MB | 19.33 MB | 19.50 MB | 1.01x / 1.00x |

Conclusion: WebP must be stored, not deflated (`zip -0`, 140 MB/s). Data compresses 8x to 14x
and is small enough that plain zip deflate is fine.

## 2. Extrapolation

Assumptions: milanuncios images estimated at 20.5 per listing and 70 KB (not mirrored yet);
idealista estimated at 24 images and 72 KB, JSONL 18 KB (parser never ran live, so it is a
guess); large counts are the known totals above with milanuncios sale at 8200 and idealista
excluded from large. Zip column uses the measured 7.8x deflate ratio.

| Tier | Listings | Images | JSONL full | Zipped data (deflate / zstd) | Lean JSONL | Raw pages | pg rows | Media 1280 q80 | Media lite 800 q75 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| small, 3 platforms, 50 per op | 300 | 6.8k | 5.2 MB | 0.7 / 0.4 MB | 2.9 MB | 3.7 MB | 5.4 MB | 481 MB | 193 MB |
| small, 4 platforms | 400 | 9.2k | 7.0 MB | 0.9 / 0.5 MB | 3.9 MB | 5.2 MB | 7.2 MB | 654 MB | 262 MB |
| medium, 3 platforms, 500 per op | 3000 | 68k | 52 MB | 6.7 / 3.8 MB | 29 MB | 37 MB | 54 MB | 4.8 GB | 1.9 GB |
| medium, 4 platforms, idealista capped at 300 per op | 3600 | 83k | 63 MB | 8.1 / 4.6 MB | 35 MB | 46 MB | 65 MB | 5.9 GB | 2.3 GB |
| medium, 4 platforms, uniform 500 | 4000 | 92k | 70 MB | 9.0 / 5.1 MB | 39 MB | 52 MB | 72 MB | 6.5 GB | 2.6 GB |
| large, 3 HTTP platforms, everything known | 45.7k | 1.05M | 842 MB | 108 / 61 MB | 460 MB | 613 MB | 855 MB | 74.5 GB | 29.8 GB |

Small media, fotocasa plus habitaclia only (what exists today): 200 listings, 332 MB.

Media only, per platform at medium uniform 500 per op: fotocasa 1.73 GB, habitaclia 1.65 GB,
milanuncios 1.44 GB, idealista 1.73 GB.

Bundle size by content (medium, 3600 listings): data zip about 8 MB (JSONL) plus about 5 MB
(Parquet) plus optional raw about 9 MB, media about 5.9 GB. Without images the whole medium
bundle is under 25 MB, which is the "quick share" case (chat, email, git LFS).

Volume: 42 GB free of 119 GB (HFS+ journaled, so no 4 GB file limit, case insensitive). Working
mirror 332 MB today. Small plus medium at 1280 q80 is about 6.5 GB working mirror plus about
6.5 GB of zips, so about 13 GB, leaving about 29 GB. Large at full quality (74.5 GB) does not
fit; large at lite (29.8 GB) would leave 12 GB minus zips, so it does not fit with zips either.

Effective counts after dedupe (estimates): milanuncios contributes at most about 5 percent new
listings (95 percent are fotocasa cross-posts). Cross-portal overlap between fotocasa,
habitaclia and idealista is unmeasured and likely large (agencies multi-post), so the "large"
45.7k is probably about 30k to 35k unique properties. Treat counts as listings, not properties.

Scrape time (HTTP: 2 to 5 s per page per host, so 3.5 s average; hosts are independent
processes; the browser path is 5 to 12 s, 8.5 s average, 60 loads per run shared by both
phases):

| Work | Page loads | Time |
| --- | --- | --- |
| medium HTTP, 3 platforms, both ops | about 94 pages | about 5.5 min |
| large HTTP, 3 platforms | 1412 pages (fotocasa 571, habitaclia 585, milanuncios 256) | 82 min serial, about 34 min wall in parallel |
| idealista small, per op | 2 list + 50 detail = 52 | 1 run, about 7.4 min; 2 ops about 15 min |
| idealista medium 300 per op | 10 list + 300 detail = 310 | 6 runs, about 44 min of page time; 2 ops about 1.5 h, 12 runs |
| idealista medium 500 per op | 17 + 500 = 517 | 9 runs per op, about 73 min |
| idealista large, rent only | 54 + 1617 = 1671 | 28 runs, about 3.9 h; sale roughly the same or more |
| media download, medium | about 83k to 92k images | not measured (6 threads, no rate limit); at 20 to 40 images per second, 35 to 70 min |

Zipped share time: zip of stored WebP is disk bound (measured 140 MB/s for the compression
step). Copy time to the external disk was not measured (no writes allowed); at an assumed
100 MB/s, small media is about 5 s, medium about 1 min, and at 30 MB/s medium is about 3.3 min.
Sending medium media over the network at 50 Mbit/s is about 16 min for 5.9 GB; lite (2.3 GB)
is about 6 min.

## 3. Recommendation

| Tier | Size | Media | Why |
| --- | --- | --- | --- |
| small | 50 per platform and operation (keep) | full 1280 q80 for all platforms | 300 to 400 listings, 0.5 to 0.65 GB. Fixture grade, fits any laptop and a chat upload if lite. Enough for UI, prompt and schema work. |
| medium | 500 per operation for fotocasa, habitaclia, milanuncios; idealista capped at 300 per operation | full 1280 q80, split per platform; lite profile offered | 3600 listings, 83k images, 5.9 GB. Big enough for ranking, embedding recall and vision experiments (room type labels come free), small enough to scrape in an afternoon and copy in minutes. |
| large | everything the HTTP platforms give: about 45.7k listings | none (URLs only), optional cover set | 108 MB zipped data (61 MB zstd), 34 min of polite scraping. Worth it for embedding scale, price statistics, dedupe evaluation, retrieval latency. Not worth mirroring images (74.5 GB). |

Decisions and reasoning:

- Keep 50 and 500 (tiers stay strict prefixes). Do not go to 1000 for medium: media would be
  about 13 GB and vision experiments do not need it, while the incremental ranking value is low.
- Large is worth it as data only, for fotocasa, habitaclia and milanuncios. It is cheap
  (1412 HTTP pages), 108 MB zipped, and is the only tier that exercises search at realistic
  scale. Its risk is untested deep pagination and sale volume (28.6k of 45.7k are sale).
- Idealista large is not worth it. Rent alone is 28 sessions of 60 page loads (about 3.9 h of
  page time, all through the user's logged in Chrome, with DataDome risk on each session) and
  the parser has never met the live site. Cap idealista at small now and medium at 300 per
  operation after the first live run is verified. Ship idealista as an additive release, not
  as a blocker for the first bundle.
- Milanuncios: keep its data (cheap, tags and price are useful) but flag cross-posts in a
  `dedupe.jsonl` sidecar and skip mirroring images for ads whose image UUID already exists in
  fotocasa. That cuts milanuncios medium media from 1.44 GB to a small fraction once the
  fotocasa master is larger.
- Large optional media: `--media-profile lite --max-photos 4` for 45.7k listings is about
  4 x 26 KB x 45.7k = 4.8 GB. Only build it if a vision experiment needs breadth over depth.
- Ship one media rendition by default (the already mirrored 1280 q80). Re-encoding to lite from
  the mirrored WebP is a second lossy generation and is only a convenience for constrained
  recipients.

## 4. Package design

### 4.1 Layout on the volume

```
/Volumes/KeVagiBe/chezy/
  media/                          working mirror, unchanged (source of truth, keyed platform/id)
  datasets/
    <tier>/                       small | medium | large
      <release>/                  YYYY-MM-DD of packaging, for example 2026-09-19
        DATASET.md                datacard (also browsable without unzipping)
        MANIFEST.json             machine readable twin of the datacard
        SHA256SUMS                sha256 of every file in this directory (sha256sum -c compatible)
        chezy-<tier>-<release>-data.zip
        chezy-<tier>-<release>-media-<platform>.zip     one per platform, WebP stored (zip -0)
        chezy-<tier>-<release>-raw.zip                  optional, only with --include-raw
      latest -> <release>         plain text file `LATEST` instead of a symlink (HFS+ is fine with
                                  symlinks but recipients on zip/exFAT are not)
```

Unpacked, a recipient sees one directory per bundle (the data zip and each media zip extract
into a common root named `chezy-<tier>-<release>/`):

```
chezy-<tier>-<release>/
  DATASET.md  MANIFEST.json  SHA256SUMS  LICENSE_AND_TERMS.md
  schema/
    listing.schema.json         pydantic model_json_schema()
    schema.sql                  DDL from sinks/postgres.py (tables, indexes)
    FIELDS.md                   field dictionary plus per platform coverage table (from `stats`)
  data/
    <platform>-<operation>.jsonl      full Listing, source_raw kept, local_path filled in
    listings.parquet                  flat columns, no source_raw (about 1.1 KB per listing)
    listing_media.parquet             one row per image
    dedupe.jsonl                      cross-post candidates (image UUID match, same phone, same geo+price)
    listings.sql.zst                  optional pg_dump plain SQL (COPY), see 4.5
  media/                              media root; only present once a media zip is extracted
    <platform>/<id>/<nn>-<room>.webp
    media_manifest.jsonl              url and relative path, plus bytes and sha256
  raw/                                optional
```

### 4.2 Tiers and reuse of media

Tiers are prefixes, so `small` is a subset of `medium` and `medium` a subset of `large`. The
working mirror `media/` is already tier independent (keyed by platform and id), so media is
mirrored once. In the packages:

- Standalone bundles (recommended): each tier zip is self contained. Small media is about 10
  percent of medium, so duplicating it costs about 0.5 to 0.65 GB on the volume, and recipients
  never need to know about release ordering.
- Layered alternative if disk gets tight: `--base small` writes only the media delta
  (medium minus small) and `MANIFEST.json` lists `requires: chezy-small-<release>`. Extracting
  both into the same root reproduces medium. Not recommended until volume space is a problem.
- Zips are built by streaming from the media root using the manifest file list, so no staging
  copy of 6 GB is needed. Hardlinks are not needed.

### 4.3 Relocatable media paths

- Every path in JSONL, Parquet, SQL and `media_manifest.jsonl` is relative to the media root,
  never absolute (already the convention in `media_manifest.jsonl`).
- Packaging writes `media[].local_path = "<platform>/<id>/<nn>-<room>.webp"` into the shipped
  JSONL and the loaders take a `--media-root` argument that is joined at read time.
- The datacard states: media root is the `media/` directory beside `data/`; move both together
  or set `CHEZY_MEDIA_DIR`.
- Paths are lowercase and slugged (HFS+ and Windows are case insensitive) and contain no
  colons, so bundles extract on macOS, Linux and Windows.

### 4.4 Zip strategy and integrity

- Data zip: deflate level 9. Data is at most 108 MB even for large, zstd would only save
  about 45 percent and cost universal openability. Parquet and JSONL inside.
- Media zips: `ZIP_STORED` (WebP gains 1 percent from zstd and 0 percent from deflate). One zip
  per platform (1.4 to 1.7 GB each at medium) so copies resume and recipients can take a
  subset. Python `zipfile` writes ZIP64 automatically above 4 GB, but per platform splitting
  keeps every file under it at medium anyway.
- Do not put raw pages in the default bundle (redundant with `source_raw`, adds 8.8 MB zipped at
  medium). `--include-raw` adds a separate zip.
- Integrity: `SHA256SUMS` over every deliverable file; `MANIFEST.json` carries per file bytes and
  sha256 for data files; `media_manifest.jsonl` carries bytes and sha256 per image (hashing
  6 GB is under a minute); the zip CRC32 covers in archive checks. `scraper package verify`
  recomputes everything and compares counts to `MANIFEST.json`.
- Atomic: write into `<release>.partial/` on the volume and rename when the checksum pass
  succeeds. The volume must be mounted (reuse `ensure_root`).

### 4.5 Contents of the datacard (`DATASET.md`)

- Identity: name, tier, release, package date, scraper git sha, pydantic model version, row
  counts per platform and operation, image counts and bytes, formats included.
- Provenance: for each platform the search URL or shape, transport (HTTP or CDP Chrome), page
  count, first and last `scraped_at`, raw payload run ids. Explicit sampling statement: tiers are
  prefixes of first seen search order, not random, so they over-represent what each portal ranks
  first.
- Known gaps (from the scout note): fotocasa has no street or energy data, coordinates only
  approximate for some ads, only fotocasa and habitaclia expose neighbourhood and district
  consistently, milanuncios is thin and mostly fotocasa cross-posts, idealista parser is
  unverified against the live site (until it is).
- Dedupe: how `dedupe.jsonl` was built and the unmeasured false positive rate.
- Licensing and terms: content and photos are third party (portals and agencies). Listing text
  and images are copyright of their owners and the portals' terms are expected to forbid
  scraping and redistribution (terms were not read for this assessment; verify them). The data
  is for internal research, prototyping and evaluation by named recipients only. No public
  hosting, no resale, no training of models that are redistributed. EU database right applies to
  bulk extraction. robots.txt was not checked. Include takedown contact.
- PII: default `--pii scrub` (see 4.6). Say which mode the bundle was built with.
- Media: profile (1280 px q80 WebP or lite), photo cap (25 plus floor plans), failure count
  (9 download failures in the first 4768), room type is a weak label from the source.
- How to load (section 4.7) and how to verify.

### 4.6 PII handling

Present in data: `publisher.phone` (196 of 300 small listings), `publisher.email` (100, all
habitaclia), phone and email again inside `source_raw`, private seller names (2 of 300), and
possibly phone numbers written into `description`.

`--pii scrub` (default for shared bundles):

- null `publisher.phone` and `publisher.email` (keep a boolean `has_phone` and `has_email` so
  contactability stays queryable);
- drop private seller names, keep professional agency names (agencies are businesses);
- scrub `source_raw` keys `phone`, `email`, `contact`, `clientPhone` and any value matching a
  phone or email regex; run the same regex over `description` and `raw_html_excerpt`;
- publish the scrub counts in `MANIFEST.json` and fail the package if any regex still matches
  after scrubbing (test guard).

`--pii keep` is for internal use only and the datacard says so. Exact lat and lon plus street
and number for private listings is a soft identifier; keep, but note it.

### 4.7 How a recipient loads it

Plain JSONL or Parquet (no repo, no Postgres), recommended for recipients:

```
unzip 'chezy-medium-*.zip' -d chezy-medium && cd chezy-medium && shasum -a 256 -c SHA256SUMS
duckdb -c "select platform, operation, count(*), median(price_eur) from 'data/listings.parquet' group by 1,2"
python -c "import pandas as pd; df = pd.read_json('data/fotocasa-rent.jsonl', lines=True)"
```

Images: `media/<local_path>` relative to the extracted root.

Postgres, for recipients running the app:

- With the repo: `uv run scraper load --from chezy-medium --media-root chezy-medium/media`
  (new `--from` reads the bundle JSONL instead of `.data/`, reuses the idempotent upsert; no
  `pg_dump` needed).
- Without the repo: `schema/schema.sql` then `\copy` from a plain SQL dump `listings.sql.zst`
  (`zstd -dc listings.sql.zst | psql "$DATABASE_URL"`). Producing that dump needs `pg_dump` (not on
  PATH here; install via mise or run it through the Dory postgres container). Optional phase.
  Size estimate: medium about 65 MB raw SQL, about 6 MB compressed.

### 4.8 `scraper package` sketch

```
scraper package
  --tier small|medium|large              required
  --platform fotocasa,habitaclia,milanuncios,idealista   default: all with data
  --out /Volumes/KeVagiBe/chezy/datasets default from CHEZY_DATASETS_DIR
  --release YYYY-MM-DD                   default today
  --media / --no-media                   default on for small and medium, off for large
  --media-profile full|lite              full = mirrored 1280 q80; lite = 800 px q75 re-encode
  --max-photos N                         default 25 (lite large: 4)
  --pii scrub|keep                       default scrub
  --formats jsonl,parquet,sql            default jsonl,parquet
  --include-raw                          adds raw.zip
  --base <release-dir>                   layered media delta (optional)
  --dry-run                              print counts, bytes, missing media, PII findings; write nothing
scraper package verify <dir>            recompute sha256 and counts against MANIFEST.json
scraper load --from <bundle-dir> [--media-root PATH]
```

Exit codes follow the existing convention (4 for a missing volume). Missing media for listings
in the tier is a warning with a count in dry-run, an error only with `--strict`.

## 5. Phased build plan

| Phase | Deliverable | Effort | Files to add or change |
| --- | --- | --- | --- |
| 0 | Packaging spike, first slice: `scraper package --tier small --pii scrub` for fotocasa, habitaclia, milanuncios. JSONL with local_path filled, `media_manifest.jsonl` subset with bytes and sha256, `schema/`, `DATASET.md`, `MANIFEST.json`, `SHA256SUMS`, one data zip, media zips (fotocasa and habitaclia only, 332 MB), `verify`. | M | `apps/scraper/src/chezy_scraper/package.py` (assemble, checksums, zip), `apps/scraper/src/chezy_scraper/pii.py`, `apps/scraper/src/chezy_scraper/datacard.py` (renders DATASET.md from stats and `MANIFEST.json`), `__main__.py` (command), `config.py` (`datasets_dir`), `.agents/docs/dataset-bundles.md` |
| 1 | Milanuncios small media mirrored (about 100 listings, about 140 MB), medium bundle for 3 platforms (5.4 GB with all of medium mirrored: scrape 5.5 min, media mirror 35 to 70 min unmeasured, package a few minutes). Per platform media zips. `--dry-run`. | M | `pipeline`/`media.py` tweaks for workers and progress, tests below |
| 2 | Dedupe sidecar (image UUID, phone hash, geo plus price), used to skip milanuncios image mirroring for cross-posts. `scraper load --from`. | M | `apps/scraper/src/chezy_scraper/dedupe.py`, `sinks/postgres.py` (`--from` reader), `__main__.py` |
| 3 | Large data only bundle (HTTP platforms), Parquet writer (`duckdb` or `pyarrow` as optional extra), deep pagination validation, optional `listings.sql.zst`. | L | `pyproject.toml` optional extra `package`, `sinks/parquet.py`, `tiers.py` per platform caps for idealista, `pipeline.py` last page probe |
| 4 | Idealista additive release after the first live run, lite media profile, layered `--base` delta if needed. | M to L (depends on live selector fixes) | `adapters/idealista.py` fixes, `media.py` profile option, `package.py` |

Tests (all offline, in `apps/scraper/tests/`):

- `test_package.py`: builds a bundle from the fixtures into `tmp_path`, checks the file list,
  that `SHA256SUMS` verifies, that extraction into a second directory keeps every
  `local_path` resolvable, and that media zips use `ZIP_STORED`.
- `test_pii.py`: phone and email removed from `publisher`, `source_raw` and `description` in
  fotocasa and habitaclia fixtures; the post scrub regex guard fails when a value is planted.
- `test_package_verify.py`: corrupt one byte and confirm `verify` fails with the file name.
- `test_load_from_bundle.py`: `load --from` against a Postgres fixture (reuse `test_postgres`),
  idempotent re-run.
- Volume missing: reuse `ensure_root` test pattern, exit code 4.
- Prefix property: medium JSONL starts with the small JSONL bytes for each platform.

Verification before merge follows the repo rules (`mise run validate:quick` in loop,
`mise run validate` before push, baselines cached per the global rule).

Risks:

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Deep pagination unavailable on fotocasa and habitaclia sale (pages 464 and 476), milanuncios caps at 200 pages | Large is smaller than the 45.7k estimate | Probe last page before promising a count; the datacard lists real counts |
| Terms and copyright of third party content and photos | Cannot share beyond named recipients | Internal only, datacard caveats, ask user who receives it (open question 1) |
| PII leaks through `description` or nested raw fields | Personal data in a shared bundle | Regex guard in tests and at package time, `--pii scrub` default |
| Idealista parser untested live and DataDome exposure | Bad idealista data, banned session | Separate additive release, budget 60, stop on challenge, never in the first bundle |
| Prefix tiers biased to portal ranking | Misleading evaluation results | State it in the datacard; optionally add a stratified random sample later |
| Media mirror has failures (9 of 4768, about 0.2 percent) and no rate limit at 6 threads | Holes in bundle, possible CDN throttling | Manifest records failures, dry-run reports them, cap threads |
| Source image links rot | URLs in large tier die | Note scrape date; large is URLs only by design |
| Volume space (42 GB free) | Large media impossible | Data only large, lite profile, standalone tiers about 13 GB total |
| Media not fully mirrored for milanuncios and idealista | Bundle claims images it lacks | `package --dry-run` reports missing media per platform; `MANIFEST.json` records coverage |
| Optional dependencies (pyarrow or duckdb, pg_dump) not installed | Parquet or SQL unavailable | Make Parquet and SQL optional formats, JSONL always works |

## 6. Open questions for the user

1. Who receives the bundles (teammates, hackathon judges, a partner, public)? This decides
   whether `--pii scrub` and the terms of use wording are enough, and whether images may be
   included at all.
2. Confirm that the shipped default should be PII scrubbed (phones and emails removed), with an
   internal only `--pii keep` bundle.
3. Is idealista required in the first bundle? Recommendation is no (unverified live, 60 page
   budget); ship 3 platforms and add idealista later.
4. Accept milanuncios image mirroring being skipped for fotocasa cross-posts, and a smaller
   medium for milanuncios if dedupe makes it redundant?
5. Is a full 1280 px rendition needed by recipients, or is the 800 px lite profile acceptable
   for anything shared off this machine (2.3 GB instead of 5.9 GB)?
6. Is a data only large (about 45.7k listings, 108 MB zipped, about 34 min scrape) a go, given
   28.6k of it is sale and that sale listings were not part of the stated demo scope?
7. Should tiers stay first seen prefixes (biased), or should medium and large be a stratified
   sample by district and price band? Prefix is simpler and preserves the superset property.
8. Recipient loading target: is Parquet or JSONL enough, or is a pg_dump needed (requires
   installing a Postgres client via mise)?
9. Tracker: which GitHub Project item and estimate should this work attach to (global rule
   requires a refined item before implementation)?
