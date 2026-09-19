# apps/scraper

Barcelona rent and sale listings from Spanish portals into one canonical model.

| Platform | Transport | Status |
| --- | --- | --- |
| fotocasa | plain HTTP | verified live (no street, no energy data) |
| habitaclia | plain HTTP | verified live (street, energy on most records) |
| milanuncios | plain HTTP | verified live (thin data, mostly cross-posts of fotocasa) |
| idealista | your real Chrome over CDP | parser and pipeline tested on synthetic fixtures only |

## Usage

```bash
uv run scraper scrape --platform fotocasa --operation rent --tier small
uv run scraper media --tier small      # WebP mirror on the media volume
mise run db:start && uv run scraper load --tier small
uv run scraper stats                   # per file counts and field coverage
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
