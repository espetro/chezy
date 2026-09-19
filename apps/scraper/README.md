# apps/scraper

Idealista.com data extraction + analysis pipeline. Day 0 is a hello-world CLI.
See [`AGENTS.md`](../../AGENTS.md) for monorepo-wide conventions and the
future-feature backlog.

## Day-0 scope

- One CLI entry point: `uv run scraper` (prints a hello message and exits 0).
- One smoke test under `tests/test_smoke.py` so the validate gate stays green.
- No HTTP fetches, no parsing, no DB. Add those in feature tickets.

## Planned feature tickets (not started)

- **small/medium/large dataset support**: configurable page count, request rate,
  and dataset size budget. `httpx` with `asyncio` + `parsel` for HTML.
- **pydantic models**: listing, neighborhood, price-history records.
- **sinks**: JSON Lines (default), SQLite (when a DB ships), CSV.
- **analysis pipeline**: price-per-m² distribution, days-on-market histogram,
  neighborhood summary statistics. Uses `polars` for columnar ops.

## Disk budget

`apps/scraper` shares the monorepo-wide `UV_LINK_MODE=symlink` (see
`../../mise.toml`) and the global `~/.cache/uv` cache. Per-worktree `.venv`
is project-local — do NOT share it across worktrees (see
`.agents/docs/worktree-disk-budget.md`).
