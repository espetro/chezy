"""Chezy scraper package.

Day-0 scope: a hello-world CLI. Future tickets add:
- idealista.com listing adapters (httpx + parsel + pydantic).
- small / medium / large dataset extraction pipelines.
- analysis passes (price-per-m² distribution, neighborhood summaries).
- CSV / Parquet / SQLite sinks.

Run via `uv run scraper` (after `uv sync --all-packages`).
"""

from chezy_scraper.observability import audit, configure_logging

__version__ = "0.0.0"

__all__ = ["__version__", "audit", "configure_logging"]
