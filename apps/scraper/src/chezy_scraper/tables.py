# pyright: basic
# pyarrow ships partial type information, so strict inference cannot resolve its API.
"""Parquet tables for a bundle: one typed row per listing and one row per image."""

from __future__ import annotations

import json
import types
from datetime import datetime
from typing import TYPE_CHECKING, Any, Final, Union, get_args, get_origin

import pyarrow as pa
import pyarrow.parquet as pq

from chezy_scraper.models import Listing

if TYPE_CHECKING:
    from pathlib import Path

_JSON_COLUMNS: Final = ("raw_features", "source_raw")
_PUBLISHER_COLUMNS: Final = ("name", "kind", "phone", "email", "profile_url")


_SCALARS: Final[dict[object, pa.DataType]] = {
    bool: pa.bool_(),
    int: pa.int64(),
    float: pa.float64(),
    datetime: pa.timestamp("us", tz="UTC"),
}


def _arrow_type(annotation: object) -> pa.DataType:
    origin = get_origin(annotation)
    if origin in {Union, types.UnionType}:
        inner = [a for a in get_args(annotation) if a is not type(None)]
        return _arrow_type(inner[0])
    if origin is list:
        return pa.list_(_arrow_type(get_args(annotation)[0]))
    return _SCALARS.get(annotation, pa.string())


def _listing_schema() -> pa.Schema:
    fields: list[pa.Field[Any]] = []
    for name, info in Listing.model_fields.items():
        if name in {"media", "publisher"}:
            continue
        kind = pa.string() if name in _JSON_COLUMNS else _arrow_type(info.annotation)
        fields.append(pa.field(name, kind))
    fields += [pa.field(f"publisher_{c}", pa.string()) for c in _PUBLISHER_COLUMNS]
    fields.append(pa.field("image_count", pa.int64()))
    return pa.schema(fields)


def listing_row(listing: Listing) -> dict[str, object]:
    row: dict[str, object] = {}
    for name in Listing.model_fields:
        if name in {"media", "publisher"}:
            continue
        value = getattr(listing, name)
        row[name] = json.dumps(value, ensure_ascii=False) if name in _JSON_COLUMNS else value
    publisher = listing.publisher.model_dump() if listing.publisher else {}
    for column in _PUBLISHER_COLUMNS:
        row[f"publisher_{column}"] = publisher.get(column)
    row["image_count"] = sum(1 for m in listing.media if m.local_path)
    return row


def media_rows(listing: Listing) -> list[dict[str, object]]:
    return [
        {
            "platform": listing.platform,
            "platform_id": listing.platform_id,
            "position": position,
            "kind": m.kind,
            "room_type": m.room_type,
            "url": m.url,
            "path": m.local_path,
        }
        for position, m in enumerate(listing.media, start=1)
    ]


_MEDIA_SCHEMA: Final = pa.schema(
    [
        pa.field("platform", pa.string()),
        pa.field("platform_id", pa.string()),
        pa.field("position", pa.int64()),
        pa.field("kind", pa.string()),
        pa.field("room_type", pa.string()),
        pa.field("url", pa.string()),
        pa.field("path", pa.string()),
    ]
)


def write_tables(listings: list[Listing], directory: Path) -> None:
    listing_table = pa.Table.from_pylist(
        [listing_row(x) for x in listings], schema=_listing_schema()
    )
    media_table = pa.Table.from_pylist(
        [row for x in listings for row in media_rows(x)], schema=_MEDIA_SCHEMA
    )
    pq.write_table(listing_table, directory / "listings.parquet", compression="zstd")
    pq.write_table(media_table, directory / "media.parquet", compression="zstd")
