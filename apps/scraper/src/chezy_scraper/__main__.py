"""Chezy scraper CLI.

uv run scraper scrape --platform fotocasa --operation rent --tier small
uv run scraper media --tier small
uv run scraper load --tier small
uv run scraper package --tier small
uv run scraper enrich-media --dataset chezy-mock-data
uv run scraper aggregate-outdoor-space --dataset chezy-mock-data
uv run scraper stats
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Final, get_args

import psycopg
import typer

from chezy_scraper.adapters.fotocasa import FotocasaAdapter
from chezy_scraper.adapters.habitaclia import HabitacliaAdapter
from chezy_scraper.adapters.idealista import IdealistaAdapter
from chezy_scraper.adapters.milanuncios import MilanunciosAdapter
from chezy_scraper.adapters.pisos import PisosAdapter
from chezy_scraper.config import Settings
from chezy_scraper.enrich_media import run as run_enrich_media
from chezy_scraper.fetch.browser import BrowserBlockedError, BrowserError, CdpBrowser
from chezy_scraper.fetch.http import BlockedError, HttpFetcher
from chezy_scraper.media import MediaRootUnavailableError, mirror, read_manifest, write_manifest
from chezy_scraper.models import Listing, Operation, Platform
from chezy_scraper.observability import audit, configure_logging
from chezy_scraper.outdoor_space import run as run_aggregate_outdoor_space
from chezy_scraper.package import Pii, build_bundle
from chezy_scraper.pipeline import ScrapeResult
from chezy_scraper.pipeline import scrape as run_scrape
from chezy_scraper.pipeline_browser import scrape_idealista
from chezy_scraper.sinks import postgres
from chezy_scraper.sinks.jsonl import read_listings
from chezy_scraper.tiers import MEDIA_BY_DEFAULT, Tier

app = typer.Typer(no_args_is_help=True, add_completion=False, help="Barcelona listing scraper.")

_HTTP_ADAPTERS = {
    "fotocasa": FotocasaAdapter,
    "habitaclia": HabitacliaAdapter,
    "milanuncios": MilanunciosAdapter,
    "pisos": PisosAdapter,
}

# Idealista is browser only and a shared bundle should not depend on it, so it is opt in.
_BUNDLE_PLATFORMS: Final[tuple[Platform, ...]] = (
    "fotocasa",
    "habitaclia",
    "milanuncios",
    "pisos",
)

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
    now = datetime.now(UTC)
    run_id = now.strftime("%Y%m%dT%H%M%SZ")
    if platform == "idealista":
        _scrape_idealista(settings, operation, tier, run_id=run_id, now=now)
        return
    if platform not in _HTTP_ADAPTERS:
        typer.echo(f"{platform}: no adapter yet.", err=True)
        raise typer.Exit(2)
    adapter = _HTTP_ADAPTERS[platform]()
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
            run_id=run_id,
            scraped_at=now,
        )
    except BlockedError as exc:
        typer.echo(f"BLOCKED: {exc}", err=True)
        raise typer.Exit(3) from exc
    finally:
        fetcher.close()
    _report(result)


def _report(result: ScrapeResult) -> None:
    audit.emit(
        "cli.scrape", actor="user", outcome="success", target=result.platform, **result.__dict__
    )
    typer.echo(
        f"{result.platform}/{result.operation}/{result.tier}: {result.tier_total} listings "
        f"({result.new_listings} new, {result.pages_fetched} pages, master {result.master_total})"
    )


def _scrape_idealista(
    settings: Settings, operation: Operation, tier: Tier, *, run_id: str, now: datetime
) -> None:
    """Needs the user's real Chrome with `--remote-debugging-port` (see fetch/browser.py)."""
    adapter = IdealistaAdapter(settings.idealista_search_urls)
    try:
        with CdpBrowser(
            settings.cdp_url,
            min_delay=settings.browser_min_delay,
            max_delay=settings.browser_max_delay,
            page_budget=settings.browser_page_budget,
            active_port_file=settings.chrome_profile_dir / "DevToolsActivePort",
        ) as browser:
            result = scrape_idealista(
                adapter, browser, settings, operation, tier, run_id=run_id, scraped_at=now
            )
    except BrowserBlockedError as exc:
        typer.echo(f"BLOCKED by DataDome: {exc}. Stop; do not retry from this session.", err=True)
        raise typer.Exit(3) from exc
    except BrowserError as exc:
        typer.echo(f"BROWSER: {exc}", err=True)
        raise typer.Exit(6) from exc
    _report(result)


@app.command()
def media(
    tier: Annotated[Tier, typer.Option(help="Tier whose images are mirrored.")] = "small",
    *,
    with_media: Annotated[
        bool, typer.Option(help="Required to mirror the large tier (tens of GB).")
    ] = False,
) -> None:
    """Mirror listing images (WebP, 1280 px, <=25 photos + plans) to the media volume."""
    settings = Settings.from_env()
    configure_logging()
    if tier not in MEDIA_BY_DEFAULT and not with_media:
        typer.echo(f"{tier} images are opt-in; pass --with-media.", err=True)
        raise typer.Exit(2)
    listings = _tier_listings(settings, tier)
    if not listings:
        typer.echo(f"no {tier} datasets yet; run `scraper scrape --tier {tier}` first", err=True)
        raise typer.Exit(1)
    try:
        manifest, result = mirror(listings, settings.media_root)
    except MediaRootUnavailableError as exc:
        typer.echo(f"MEDIA VOLUME MISSING: {exc}", err=True)
        raise typer.Exit(4) from exc
    write_manifest(settings.media_root, manifest)
    audit.emit("cli.media", actor="user", outcome="success", target=tier, **result.__dict__)
    typer.echo(
        f"{tier}: {result.listings} listings, {result.downloaded} downloaded, "
        f"{result.skipped_existing} existing, {result.failed} failed"
    )


@app.command()
def package(
    tier: Annotated[Tier, typer.Option(help="Tier to bundle.")] = "small",
    platform: Annotated[
        list[str] | None,
        typer.Option(help="Platforms to include (repeatable). Default: all but idealista."),
    ] = None,
    release: Annotated[str | None, typer.Option(help="Release label, default today.")] = None,
    out: Annotated[
        Path | None, typer.Option(help="Output folder, default <media root>/../datasets.")
    ] = None,
    pii: Annotated[Pii, typer.Option(help="scrub (default) or keep contact details.")] = "scrub",
) -> None:
    """Mirror images, then write a checksummed `chezy-<tier>-<release>.tar.gz` bundle."""
    wanted = set(platform or _BUNDLE_PLATFORMS)
    unknown = wanted - set(get_args(Platform))
    if unknown:
        typer.echo(f"unknown platform(s): {sorted(unknown)}", err=True)
        raise typer.Exit(2)
    settings = Settings.from_env()
    configure_logging()
    listings = [x for x in _tier_listings(settings, tier) if x.platform in wanted]
    if not listings:
        typer.echo(f"no {tier} datasets for {sorted(wanted)}; run `scraper scrape` first", err=True)
        raise typer.Exit(1)
    try:
        manifest, stats = mirror(listings, settings.media_root)
    except MediaRootUnavailableError as exc:
        typer.echo(f"MEDIA VOLUME MISSING: {exc}", err=True)
        raise typer.Exit(4) from exc
    write_manifest(settings.media_root, manifest)
    label = release or datetime.now(UTC).strftime("%Y-%m-%d")
    target = out or settings.media_root.parent / "datasets"
    target.mkdir(parents=True, exist_ok=True)
    result = build_bundle(
        listings,
        manifest,
        media_root=settings.media_root,
        out_root=target,
        tier=tier,
        release=label,
        pii=pii,
    )
    audit.emit(
        "cli.package", actor="user", outcome="success", target=tier,
        listings=result.listings, images=result.images, missing=result.missing_images,
    )  # fmt: skip
    typer.echo(
        f"{result.listings} listings, {result.images} images ({stats.downloaded} newly downloaded, "
        f"{result.missing_images} missing) -> {result.archive} "
        f"({result.archive_bytes / 1e6:.0f} MB)"
    )


@app.command()
def load(
    tier: Annotated[Tier, typer.Option(help="Tier to load into Postgres.")] = "small",
) -> None:
    """Upsert a tier into pg0 Postgres (DATABASE_URL); safe to re-run."""
    settings = Settings.from_env()
    configure_logging()
    listings = _tier_listings(settings, tier)
    if not listings:
        typer.echo(f"no {tier} datasets yet; run `scraper scrape --tier {tier}` first", err=True)
        raise typer.Exit(1)
    manifest = read_manifest(settings.media_root) if settings.media_root.exists() else {}
    try:
        with psycopg.connect(settings.database_url) as conn:
            loaded = postgres.load(conn, listings, manifest)
    except psycopg.OperationalError as exc:
        typer.echo(f"DATABASE UNAVAILABLE: {exc}; try `mise run db:start`.", err=True)
        raise typer.Exit(5) from exc
    audit.emit("cli.load", actor="user", outcome="success", target=tier, loaded=loaded)
    typer.echo(f"{tier}: {loaded} listings upserted")


@app.command("enrich-media")
def enrich_media(
    dataset: Annotated[
        Path, typer.Option(help="Dataset root holding data/media.parquet and media/.")
    ],
    workers: Annotated[int, typer.Option(help="Listings labelled concurrently.")] = 4,
    limit: Annotated[int | None, typer.Option(help="Only the first N listings.")] = None,
    model: Annotated[str | None, typer.Option(help="Override CHEZY_VLM_MODEL.")] = None,
    *,
    refresh: Annotated[bool, typer.Option(help="Ignore enriched/cache/vlm and relabel.")] = False,
) -> None:
    """Label every photo with the configured VLM and write enriched/media_features.parquet."""
    settings = Settings.from_env()
    configure_logging()
    if not settings.vlm_api_key:
        typer.echo("OPENAI_COMPATIBLE_API_KEY is empty; refusing to call the gateway.", err=True)
        raise typer.Exit(2)
    if not (dataset / "data" / "media.parquet").is_file():
        typer.echo(f"{dataset}: no data/media.parquet; is this a dataset root?", err=True)
        raise typer.Exit(2)
    result = run_enrich_media(
        settings, dataset, model=model, workers=workers, limit=limit, refresh=refresh
    )
    audit.emit(
        "cli.enrich_media", actor="user", outcome="success", target=str(dataset),
        listings=result.listings, photos=result.photos, ok=result.ok, failed=result.failed,
    )  # fmt: skip
    typer.echo(
        f"{result.listings} listings, {result.photos} photos ({result.ok} labelled, "
        f"{result.failed} failed) -> {result.out_path}"
    )


@app.command("aggregate-outdoor-space")
def aggregate_outdoor_space(
    dataset: Annotated[
        Path, typer.Option(help="Dataset root holding enriched/media_features.parquet.")
    ] = Path("chezy-mock-data"),
) -> None:
    """Collapse per-photo outdoor_space labels into enriched/listing_outdoor_space.jsonl."""
    configure_logging()
    features = dataset / "enriched" / "media_features.parquet"
    if not features.is_file():
        typer.echo(
            f"{features}: not found; run `scraper enrich-media --dataset {dataset}` first.",
            err=True,
        )
        raise typer.Exit(2)
    result = run_aggregate_outdoor_space(dataset)
    audit.emit(
        "cli.aggregate_outdoor_space", actor="user", outcome="success", target=str(dataset),
        listings=result.listings, labelled=result.labelled,
    )  # fmt: skip
    typer.echo(
        f"{result.listings} listings, {result.labelled} with outdoor_space -> {result.out_path}"
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


def _tier_listings(settings: Settings, tier: Tier) -> list[Listing]:
    listings: list[Listing] = []
    for path in sorted(settings.listings_dir.glob(f"*-{tier}.jsonl")):
        listings.extend(read_listings(path))
    return listings


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
