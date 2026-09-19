"""Chezy scraper CLI.

uv run scraper scrape --platform fotocasa --operation rent --tier small
uv run scraper stats
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Annotated

import typer

from chezy_scraper.adapters.fotocasa import FotocasaAdapter
from chezy_scraper.adapters.habitaclia import HabitacliaAdapter
from chezy_scraper.config import Settings
from chezy_scraper.fetch.http import BlockedError, HttpFetcher
from chezy_scraper.models import Listing, Operation, Platform
from chezy_scraper.observability import audit, configure_logging
from chezy_scraper.pipeline import scrape as run_scrape
from chezy_scraper.sinks.jsonl import read_listings
from chezy_scraper.tiers import Tier

app = typer.Typer(no_args_is_help=True, add_completion=False, help="Barcelona listing scraper.")

_HTTP_ADAPTERS = {"fotocasa": FotocasaAdapter, "habitaclia": HabitacliaAdapter}

# Fields whose fill rate `stats` reports; these are the ones LLM queries lean on.
_MIN_PHOTOS = 10
_COVERAGE_FIELDS = (
    "price_eur",
    "rooms",
    "bathrooms",
    "built_m2",
    "lat",
    "street",
    "street_number",
    "energy_consumption_label",
    "description",
    "publisher",
)


@app.command()
def scrape(
    platform: Annotated[Platform, typer.Option(help="Source platform.")],
    operation: Annotated[Operation, typer.Option(help="rent or sale.")],
    tier: Annotated[Tier, typer.Option(help="small=50, medium=500, large=all.")] = "small",
    *,
    refresh: Annotated[bool, typer.Option(help="Ignore the on-disk HTTP cache.")] = False,
) -> None:
    """Scrape one platform x operation slice into the JSONL dataset."""
    settings = Settings.from_env()
    configure_logging()
    if platform not in _HTTP_ADAPTERS:
        typer.echo(
            f"{platform}: not available over plain HTTP; see the idealista command.", err=True
        )
        raise typer.Exit(2)
    adapter = _HTTP_ADAPTERS[platform]()
    now = datetime.now(UTC)
    fetcher = HttpFetcher(
        settings.cache_dir,
        min_delay=settings.http_min_delay,
        max_delay=settings.http_max_delay,
        use_cache=not refresh,
    )
    try:
        result = run_scrape(
            adapter,
            fetcher,
            settings,
            operation,
            tier,
            run_id=now.strftime("%Y%m%dT%H%M%SZ"),
            scraped_at=now,
        )
    except BlockedError as exc:
        typer.echo(f"BLOCKED: {exc}", err=True)
        raise typer.Exit(3) from exc
    finally:
        fetcher.close()
    audit.emit("cli.scrape", actor="user", outcome="success", target=platform, **result.__dict__)
    typer.echo(
        f"{result.platform}/{result.operation}/{result.tier}: {result.tier_total} listings "
        f"({result.new_listings} new, {result.pages_fetched} pages, master {result.master_total})"
    )


@app.command()
def stats() -> None:
    """Per-file record counts and field coverage for every dataset file."""
    settings = Settings.from_env()
    files = sorted(settings.listings_dir.glob("*.jsonl"))
    if not files:
        typer.echo("no datasets yet; run `scraper scrape` first")
        return
    for path in files:
        listings = read_listings(path)
        typer.echo(f"{path.name}: {len(listings)}")
        if listings:
            typer.echo("  " + json.dumps(_coverage(listings)))


def _coverage(listings: list[Listing]) -> dict[str, str]:
    total = len(listings)
    out: dict[str, str] = {}
    for field in _COVERAGE_FIELDS:
        filled = sum(1 for x in listings if getattr(x, field) is not None)
        out[field] = f"{filled}/{total}"
    out[f"media>={_MIN_PHOTOS}"] = (
        f"{sum(1 for x in listings if len(x.media) >= _MIN_PHOTOS)}/{total}"
    )
    return out


def main() -> None:
    app()


if __name__ == "__main__":
    main()
