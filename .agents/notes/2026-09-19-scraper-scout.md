# Scraper scout, 2026-09-19

Findings from building `apps/scraper` (plan: `.agents/plans/2026-09-19-listing-scraper.md`).

## Per platform

**fotocasa** (plain HTTP, 200). `initialSearch.result.realEstates` in a `<script id="__initial_props__">`.
No street, no number, no energy certificate. Coordinates carry an `accuracy` flag; we map
`1` to `exact` and anything else to `zone` (heuristic, unverified).

**habitaclia** (plain HTTP, 200). `window.__INITIAL_PROPS__ = JSON.parse("...")`, a JS string
literal decoded with `raw_decode` then `json.loads`. 30 listings per page. Pagination is
`/s/<n>`; a `?page=n` query silently returns page 1. Best data of the four: street 49 to
50 of 50, street number 45 to 47, energy label 36 to 43 (when the certificate is not
`PENDING`), plus price drop delta.

**milanuncios** (plain HTTP, 200). Same `__INITIAL_PROPS__` shape, 41 ads per page, 56 pages,
2270 rent ads. Pagination `?pagina=N` works. Rooms, baths and m2 only come as `tags`; no
coordinates, street, energy or amenities. Every ad on the scouted pages had
`origin.provider = fotocasa_pro`, so this feed is largely a cross-post of fotocasa. Dedupe
across platforms before counting it as extra coverage. Image hosts come without a scheme.

**idealista**. Plain HTTP is a DataDome 403. Only the real logged-in Chrome passes, so the
adapter and CDP driver were written against the markup as scouted and are tested with
synthetic fixtures. NOT verified against the live site. Expect selector fixes on the first
real run: the `#headerMap` location list, the `icon-energy-c-*` / `icon-energy-e-*` class
convention for energy labels, and the `.info-features` line. Raw payload is always kept in
`source_raw` so a parser fix does not need a re-scrape of the same pages, but it does need the
ids again if the run was interrupted before phase 2.

## Anti-bot posture

- HTTP: per host jittered 2 to 5 s delay, tenacity backoff on 429/5xx, hard stop after 3
  consecutive 403s, on disk cache so re-runs cost nothing.
- Browser: one dedicated tab, 5 to 12 s delay, 60 page budget per run, challenge stops the run.
- Nothing solves or evades a challenge.

## Data quality gaps that matter for search

- fotocasa lacks street and energy; habitaclia has both. A "quiet street" or "energy A"
  style query will silently under-match fotocasa and milanuncios rows.
- Only fotocasa and habitaclia expose neighbourhood and district consistently.
- No platform gives the exact pin for every ad; `location_accuracy` records what we know.

## Numbers

- 200 small listings (4 slices of 50) plus 164 milanuncios; 4768 images, 332 MB (about 70 KB
  each, under the 130 KB estimate), 9 download failures.
- pg0 load: 200 listings, 7442 media rows, 4768 with a local path.

## Repo notes

- `scripts/validate.py` passed `--passwithno-tests` to pytest, which is not a pytest flag; it
  hard-errored. Removed.
- Pre-existing and left alone: ruff errors in `scripts/validate.py` and
  `tests/test_agents_rules.py`, two pyright errors in `scripts/validate.py`.
- The pnpm `catalogs` block lives only in the uncommitted `pnpm-workspace.yaml` of the main
  checkout, so a fresh worktree cannot `pnpm install` until that lands. TS packages were
  typechecked by borrowing the main checkout's `node_modules`.
- `oxlint` fails to parse `.oxlintrc.json` (`no-restricted-syntax` not found in plugin
  `eslint`), so TS lint could not run.
- Something answers on `127.0.0.1:9222` with an empty body, so it is not a usable Chrome CDP.
