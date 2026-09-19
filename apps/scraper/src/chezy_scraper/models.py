"""Canonical listing model shared by every platform adapter.

Designed so an LLM can match free-text queries against it: prose (`title`,
`description`), structured attributes, geo, and media all live on one record.
The SQL table shape in `sinks/postgres.py` and the Valibot schema in
`packages/contract` mirror this model field for field.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue

Platform = Literal["fotocasa", "habitaclia", "idealista", "milanuncios"]
Operation = Literal["rent", "sale"]
PricePeriod = Literal["month", "total"]
MediaKind = Literal["photo", "plan", "video", "tour_3d"]
PublisherKind = Literal["professional", "private"]
LocationAccuracy = Literal["exact", "street", "zone"]


class Media(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: str
    kind: MediaKind = "photo"
    room_type: str | None = None
    width: int | None = None
    height: int | None = None
    # Relative to the media root; populated from media_manifest.jsonl at load time.
    local_path: str | None = None


class Publisher(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    kind: PublisherKind | None = None
    phone: str | None = None
    email: str | None = None
    profile_url: str | None = None


class Listing(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # identity
    platform: Platform
    platform_id: str
    url: str
    scraped_at: datetime
    published_at: datetime | None = None
    updated_at: datetime | None = None

    # transaction
    operation: Operation
    price_eur: float | None = None
    price_period: PricePeriod | None = None
    price_per_m2: float | None = None
    price_drop_eur: float | None = None
    deposit: float | None = None
    is_temporary_rental: bool | None = None

    # property
    property_type: str | None = None
    property_subtype: str | None = None
    built_m2: float | None = None
    usable_m2: float | None = None
    rooms: int | None = None
    bathrooms: int | None = None
    floor: str | None = None
    orientation: str | None = None
    year_built: int | None = None
    condition: str | None = None
    furnished: bool | None = None
    heating: str | None = None
    energy_consumption_label: str | None = None
    energy_consumption_value: float | None = None
    energy_emissions_label: str | None = None
    energy_emissions_value: float | None = None

    # location
    lat: float | None = None
    lon: float | None = None
    street: str | None = None
    street_number: str | None = None
    neighbourhood: str | None = None
    district: str | None = None
    municipality: str | None = None
    postal_code: str | None = None
    location_accuracy: LocationAccuracy | None = None

    # features: `amenities` uses the shared vocabulary in `vocab.py`;
    # `raw_features` keeps whatever the platform said, untouched.
    amenities: list[str] = Field(default_factory=list)
    raw_features: dict[str, JsonValue] = Field(default_factory=dict)

    media: list[Media] = Field(default_factory=list)
    publisher: Publisher | None = None

    # text
    title: str | None = None
    description: str | None = None
    raw_html_excerpt: str | None = None

    # The listing object exactly as the platform served it.
    source_raw: dict[str, JsonValue] = Field(default_factory=dict)
