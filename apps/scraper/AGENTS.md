# `apps/scraper` — agent instructions

Scope: the `chezy-scraper` Python CLI (uv workspace member). Pulls
idealista.com listing data via HTTP, parses with parsel, validates with
pydantic. Inherits root [`AGENTS.md`](../../AGENTS.md) rules; this file
adds scraper-specific invariants.

## Stack

- **Python**: 3.12 (pinned in mise + `requires-python`).
- **HTTP**: `httpx` (async client, custom `User-Agent`, retry policy).
- **HTML parse**: `parsel` (CSS + XPath selectors).
- **Validation / models**: `pydantic` (v2, `BaseModel`).
- **Observability**: `structlog` (24.x; pinned `<25` because 25.0
  reorganized processors and broke the JSONL audit sink).
- **Package manager**: `uv` (no `pip`, no `pip-tools`).
- **Workspace**: this app is a uv workspace member with its own
  `pyproject.toml` and `.venv`. Independently runnable as
  `uv run scraper` (CLI entry point at `chezy_scraper.__main__:main`).

## Run / install

```bash
# from repo root, after `mise trust && uv sync --all-packages`
uv run scraper                       # day 0: prints hello
uv run scraper --help                # CLI surface

# one-time editable install (uv sync does this already)
uv pip install -e apps/scraper
```

`mise run validate` runs `ruff check`, `ruff format --check`, and
`pyright` over `apps/scraper`. Day 0 ships one trivially-passing pytest
in `tests/test_smoke.py` so the gate wires up.

## Adapter pattern (idealista.com)

The first adapter lives at
`src/chezy_scraper/adapters/idealista.py` and exports:

- `async def fetch_listing(url: str, *, client: httpx.AsyncClient) -> Listing`
- `class Listing(pydantic.BaseModel)` — the typed record shape.

Each adapter owns its own URL builder, parser, and field normalization
(price formatting, sqm rounding, location canonicalization). New portal =
new adapter file under `adapters/`; the CLI surfaces them as
`uv run scraper <portal> <command> ...`.

## Polite HTTP

idealista.com (and any other portal) rate-limits + blocks naive clients.
The HTTP client wraps `httpx.AsyncClient` and enforces:

- **Throttling**: `await asyncio.sleep(random.uniform(0.5, 1.5))`
  between requests; configurable per adapter.
- **User-Agent**: a real browser UA string (default in `http.py`); never
  the `python-httpx/x.y` default — it gets 403'd within minutes.
- **Retry policy**: 3 retries on 5xx + connection errors with exponential
  backoff (1s, 2s, 4s). **Do not** retry on 4xx — it's either a block
  (back off harder, don't loop) or a bad URL (no retry helps).
- **Robots.txt**: respect the portal's `robots.txt` unless the scraper
  is explicitly configured to bypass it (off by default). The
  `robots_fetcher` helper fetches and caches per host.
- **Concurrency**: max N in-flight requests per host (`sem=3` default);
  no unbounded `asyncio.gather` over a list of URLs.

Add new HTTP behavior to `http.py`, not scattered across adapters.

## Fixture offline mode (tests)

Tests must not hit idealista.com. Two patterns:

1. **HTML fixtures**: `tests/fixtures/idealista/<slug>.html` — real
   captured HTML, parsed by the same code path as live requests. New
   parser branch? Capture a fixture first.
2. **Mock transport**: pass an `httpx.MockTransport` to the adapter's
   `fetch_listing` — it returns canned HTML without a network round-trip.
   Use this when you don't have (or don't want) a real capture.

Test files are colocated as `test_*.py` next to the module they cover.
pytest runs via `mise run validate` (testmon skips unchanged tests).

## Observability

Use `structlog` with the JSONL audit sink from
[`packages/observability`](../../packages/observability/AGENTS.md).
Every fetch emits a `scraper.fetch.ok` or `scraper.fetch.fail` audit
record with `{ actor, action, target, outcome, ctx }`. Never log raw
URLs with embedded PII; log the listing id (canonical hash) instead.

## Out of scope

- **Authentication**. The hackathon ships no login surface. If a portal
  needs cookies / tokens, that gets a feature ticket.
- **API integration**. The user spec defers `apps/api` (TBD). The
  scraper persists its output to disk + the audit JSONL — no DB writes
  from the scraper on day 0.
- **Cron / scheduling**. Run manually with `uv run scraper` until a
  scheduling story exists.