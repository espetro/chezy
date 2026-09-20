# apps/scraper

Barcelona rent and sale listings from Spanish portals into one canonical model.

| Platform | Transport | Status |
| --- | --- | --- |
| fotocasa | plain HTTP | verified live (no street, no energy data) |
| habitaclia | plain HTTP | verified live (street, energy on most records) |
| milanuncios | plain HTTP | verified live (thin data, mostly cross-posts of fotocasa) |
| idealista | your real Chrome over CDP | verified live on 2026-09-19 (50 rent ads, no exact coordinates) |

## Usage

```bash
uv run scraper scrape --platform fotocasa --operation rent --tier small
uv run scraper media --tier small      # WebP mirror on the media volume
mise run db:start && uv run scraper load --tier small
uv run scraper stats                   # per file counts and field coverage
uv run scraper package --tier small    # shareable tar.gz bundle, see below
```

Tiers are strict supersets, cut from one append only master file per platform and
operation: `small` = 50, `medium` = 500, `large` = everything. Re-running a tier the
master already fills costs zero requests. Images are mirrored for small and medium by
default; `media --tier large` needs `--with-media`.

## Layout on disk

```
.data/raw/<platform>/<operation>/<run-id>/page-NNN.json   untouched source payloads
.data/listings/<platform>-<operation>[-<tier>].jsonl      canonical Listing, one per line
.data/cache/                                              HTTP cache (safe to delete)
.audit/*.jsonl                                            audit events
<CHEZY_MEDIA_DIR>/<platform>/<id>/<nn>-<room>.webp        1280 px, q80, <=25 photos + plans
<CHEZY_MEDIA_DIR>/media_manifest.jsonl                    relative paths, relocatable
```

## Sharing a dataset

`scraper package --tier small` mirrors the images, then writes
`<media root>/../datasets/chezy-<tier>-<date>.tar.gz` (and the unpacked folder next to it):

```
data/listings.parquet   typed columns, one row per listing
data/listings.jsonl     nested JSON with the media array
data/media.parquet      one row per image; `path` is an object key
media/<platform>/<id>/<nn>-<room>.webp   images as plain files, never inside the tables
schema/listing.schema.json  DATASET.md  MANIFEST.json  SHA256SUMS
```

Defaults: fotocasa, habitaclia and milanuncios (pass `--platform` to change), contact
details scrubbed (`--pii keep` to keep them). Up to 25 photos and all floor plans are copied
per listing; other media keep only their source url. Verify a received copy with
`shasum -a 256 -c SHA256SUMS`.

## Idealista

DataDome blocks plain HTTP and clean automated browsers. The scraper drives one
dedicated tab in a Chrome you start yourself:

```bash
open -a "Google Chrome" --args --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/Google/Chrome-cdp"
# log in to idealista in that window, then:
CHEZY_IDEALISTA_RENT_URL='https://www.idealista.com/alquiler-viviendas/barcelona-barcelona/?shape=...' \
  uv run scraper scrape --platform idealista --operation rent --tier small
```

Two ways to attach. A Chrome started with `--remote-debugging-port` serves `/json/version`.
Chrome's own `chrome://inspect/#remote-debugging` toggle on your default profile does not; the
scraper then reads the websocket path from `DevToolsActivePort` in the profile folder
(`CHEZY_CHROME_PROFILE_DIR`). Chrome asks you to allow each new connection, so a run is one
process, one confirmation.

Limits: 5 to 12 s between page loads, 60 pages per run. Phase 1 stores the id list, phase 2
fetches details; both resume on the next run. A DataDome challenge stops the run with
exit code 3; do not retry from the same session.

## Configuration

| Variable | Default |
| --- | --- |
| `CHEZY_DATA_DIR` | `.data` |
| `CHEZY_MEDIA_DIR` | `/Volumes/KeVagiBe/chezy/media` (refused if the volume is not mounted) |
| `DATABASE_URL` | local pg0 |
| `CHEZY_CDP_URL` | `http://127.0.0.1:9222` |
| `CHEZY_CHROME_PROFILE_DIR` | `~/Library/Application Support/Google/Chrome` |
| `CHEZY_IDEALISTA_RENT_URL`, `CHEZY_IDEALISTA_SALE_URL` | whole city |
| `CHEZY_AUDIT_DIR`, `CHEZY_LOG_LEVEL` | see `observability.py` |

## Shared shapes

The pydantic `Listing` in `src/chezy_scraper/models.py` is the source of truth. Mirrors:
SQL DDL in `sinks/postgres.py`, Drizzle in `packages/db/src/schema/listings.ts`, Valibot in
`packages/contract/src/listings.ts` (its test validates real scraper output, so drift fails CI).

## Disk budget

`apps/scraper` shares the monorepo-wide `UV_LINK_MODE=symlink` (see `../../mise.toml`) and the
global `~/.cache/uv` cache. The per worktree `.venv` is project local; do not share it across
worktrees (see `.agents/docs/worktree-disk-budget.md`).
