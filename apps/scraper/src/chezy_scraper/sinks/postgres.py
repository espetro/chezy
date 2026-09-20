"""Idempotent loader from the JSONL dataset into pg0 Postgres.

Two tables, created if missing:

- `listings`: one row per (platform, platform_id); publisher flattened into
  `publisher_*` columns, `amenities` as `text[]`, `raw_features` / `source_raw` as jsonb.
- `listing_media`: one row per image, replaced wholesale per listing on every load.

The Drizzle schema in `packages/db` and the Valibot schema in `packages/contract`
mirror these definitions column for column.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Final

from psycopg import Connection, sql
from psycopg.types.json import Jsonb

if TYPE_CHECKING:
    from collections.abc import Iterable

    from chezy_scraper.media import MediaFile
    from chezy_scraper.models import Listing

# (column, SQL type); order matches `_row`.
LISTING_COLUMNS: Final[tuple[tuple[str, str], ...]] = (
    ("platform", "text not null"),
    ("platform_id", "text not null"),
    ("url", "text not null"),
    ("scraped_at", "timestamptz not null"),
    ("published_at", "timestamptz"),
    ("updated_at", "timestamptz"),
    ("operation", "text not null"),
    ("price_eur", "double precision"),
    ("price_period", "text"),
    ("price_per_m2", "double precision"),
    ("price_drop_eur", "double precision"),
    ("deposit", "double precision"),
    ("is_temporary_rental", "boolean"),
    ("property_type", "text"),
    ("property_subtype", "text"),
    ("built_m2", "double precision"),
    ("usable_m2", "double precision"),
    ("rooms", "integer"),
    ("bathrooms", "integer"),
    ("floor", "text"),
    ("orientation", "text"),
    ("year_built", "integer"),
    ("condition", "text"),
    ("furnished", "boolean"),
    ("heating", "text"),
    ("energy_consumption_label", "text"),
    ("energy_consumption_value", "double precision"),
    ("energy_emissions_label", "text"),
    ("energy_emissions_value", "double precision"),
    ("lat", "double precision"),
    ("lon", "double precision"),
    ("street", "text"),
    ("street_number", "text"),
    ("neighbourhood", "text"),
    ("district", "text"),
    ("municipality", "text"),
    ("postal_code", "text"),
    ("location_accuracy", "text"),
    ("amenities", "text[] not null default '{}'"),
    ("raw_features", "jsonb not null default '{}'"),
    ("publisher_name", "text"),
    ("publisher_kind", "text"),
    ("publisher_phone", "text"),
    ("publisher_email", "text"),
    ("publisher_profile_url", "text"),
    ("title", "text"),
    ("description", "text"),
    ("raw_html_excerpt", "text"),
    ("source_raw", "jsonb not null default '{}'"),
)

_KEY: Final = ("platform", "platform_id")
_NAMES: Final = tuple(name for name, _ in LISTING_COLUMNS)

_IDENT = sql.Identifier
_TABLE_COLUMNS = sql.SQL(", ").join(
    sql.SQL("{} ").format(_IDENT(name)) + sql.SQL(kind) for name, kind in LISTING_COLUMNS
)

DDL: Final[tuple[sql.Composable, ...]] = (
    sql.SQL("create table if not exists listings ({}, primary key (platform, platform_id))").format(
        _TABLE_COLUMNS
    ),
    sql.SQL("create index if not exists listings_operation_idx on listings (operation, price_eur)"),
    sql.SQL("create index if not exists listings_geo_idx on listings (lat, lon)"),
    sql.SQL(
        "create table if not exists listing_media ("
        "platform text not null, platform_id text not null, position integer not null, "
        "url text not null, kind text not null, room_type text, width integer, "
        "height integer, local_path text, "
        "primary key (platform, platform_id, position), "
        "foreign key (platform, platform_id) references listings (platform, platform_id) "
        "on delete cascade)"
    ),
)

_UPSERT: Final = sql.SQL(
    "insert into listings ({cols}) values ({marks}) "
    "on conflict (platform, platform_id) do update set {updates}"
).format(
    cols=sql.SQL(", ").join(map(_IDENT, _NAMES)),
    marks=sql.SQL(", ").join(sql.Placeholder() * len(_NAMES)),
    updates=sql.SQL(", ").join(
        sql.SQL("{n} = excluded.{n}").format(n=_IDENT(n)) for n in _NAMES if n not in _KEY
    ),
)

_INSERT_MEDIA: Final = (
    "insert into listing_media "
    "(platform, platform_id, position, url, kind, room_type, width, height, local_path) "
    "values (%s, %s, %s, %s, %s, %s, %s, %s, %s)"
)


def _row(listing: Listing) -> tuple[object, ...]:
    publisher = listing.publisher
    values: dict[str, object] = {
        **listing.model_dump(
            exclude={"media", "publisher", "raw_features", "source_raw"}, mode="python"
        ),
        "raw_features": Jsonb(listing.raw_features),
        "source_raw": Jsonb(listing.source_raw),
        "publisher_name": publisher.name if publisher else None,
        "publisher_kind": publisher.kind if publisher else None,
        "publisher_phone": publisher.phone if publisher else None,
        "publisher_email": publisher.email if publisher else None,
        "publisher_profile_url": publisher.profile_url if publisher else None,
    }
    return tuple(values[name] for name in _NAMES)


def _media_rows(listing: Listing, mirrored: dict[str, str]) -> list[tuple[object, ...]]:
    return [
        (
            listing.platform,
            listing.platform_id,
            position,
            item.url,
            item.kind,
            item.room_type,
            item.width,
            item.height,
            mirrored.get(item.url) or item.local_path,
        )
        for position, item in enumerate(listing.media, start=1)
    ]


def ensure_schema(conn: Connection) -> None:
    for statement in DDL:
        conn.execute(statement)


def load(
    conn: Connection,
    listings: Iterable[Listing],
    manifest: dict[tuple[str, str], list[MediaFile]] | None = None,
) -> int:
    """Upsert `listings` and replace their media rows, in one transaction."""
    manifest = manifest or {}
    count = 0
    with conn.transaction():
        ensure_schema(conn)
        with conn.cursor() as cur:
            for listing in listings:
                key = (listing.platform, listing.platform_id)
                mirrored = {f.url: f.path for f in manifest.get(key, [])}
                cur.execute(_UPSERT, _row(listing))
                cur.execute(
                    "delete from listing_media where platform = %s and platform_id = %s", key
                )
                media_rows = _media_rows(listing, mirrored)
                if media_rows:
                    cur.executemany(_INSERT_MEDIA, media_rows)
                count += 1
    return count
