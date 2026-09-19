"""Shared amenity vocabulary.

Every adapter maps its platform-specific feature keys onto this closed set so
queries like "with a terrace and elevator" behave the same across sources.
Unmapped keys are not lost: they stay in `Listing.raw_features`.
"""

from __future__ import annotations

from typing import Final

AMENITIES: Final[frozenset[str]] = frozenset(
    {
        "air_conditioning",
        "alarm",
        "balcony",
        "doorman",
        "elevator",
        "equipped_kitchen",
        "exterior",
        "fireplace",
        "furnished",
        "garden",
        "gym",
        "heating",
        "laundry",
        "parking",
        "parquet",
        "pets_allowed",
        "pool",
        "sea_view",
        "storage_room",
        "terrace",
        "wardrobes",
        "wheelchair_accessible",
    }
)

FOTOCASA_FEATURES: Final[dict[str, str]] = {
    "air_conditioner": "air_conditioning",
    "alarm": "alarm",
    "balcony": "balcony",
    "cabinets": "wardrobes",
    "community_pool": "pool",
    "elevator": "elevator",
    "equiped_kitchen": "equipped_kitchen",
    "fitness_center": "gym",
    "furnished": "furnished",
    "heating": "heating",
    "laundry": "laundry",
    "parking": "parking",
    "parquet": "parquet",
    "pets_allowed": "pets_allowed",
    "porter_service": "doorman",
    "private_garden": "garden",
    "storage_room": "storage_room",
    "swimming_pool": "pool",
    "terrace": "terrace",
    "yard": "garden",
}

FOTOCASA_DYNAMIC: Final[dict[str, str]] = {
    "HAS_A_FIREPLACE": "fireplace",
    "HAS_VIEW_TO_BEACH": "sea_view",
    "IS_EXTERIOR": "exterior",
}

HABITACLIA_FEATURES: Final[dict[str, str]] = {
    "AIR_CONDITIONER": "air_conditioning",
    "ALARM": "alarm",
    "BALCONY": "balcony",
    "COMMUNITY_POOL": "pool",
    "DOORMAN": "doorman",
    "ELEVATOR": "elevator",
    "EQUIPPED_KITCHEN": "equipped_kitchen",
    "FIREPLACE": "fireplace",
    "FURNISHED": "furnished",
    "GYM": "gym",
    "LAUNDRY": "laundry",
    "PARQUET": "parquet",
    "PETS_ALLOWED": "pets_allowed",
    "PRIVATE_GARDEN": "garden",
    "PRIVATE_PARKING": "parking",
    "PRIVATE_POOL": "pool",
    "STORAGE_ROOM": "storage_room",
    "WARDROBES": "wardrobes",
    "YARD": "garden",
}

HABITACLIA_DYNAMIC: Final[dict[str, str]] = FOTOCASA_DYNAMIC


# Spanish phrases idealista prints in its detail lists; matched as substrings on the
# lowercased line. A line starting with "sin " (e.g. "Sin ascensor") never matches.
IDEALISTA_KEYWORDS: Final[dict[str, str]] = {
    "aire acondicionado": "air_conditioning",
    "amueblado": "furnished",
    "armarios empotrados": "wardrobes",
    "balcón": "balcony",
    "calefacción": "heating",
    "chimenea": "fireplace",
    "cocina equipada": "equipped_kitchen",
    "con ascensor": "elevator",
    "conserje": "doorman",
    "exterior": "exterior",
    "garaje": "parking",
    "gimnasio": "gym",
    "jardín": "garden",
    "lavadora": "laundry",
    "mascotas": "pets_allowed",
    "piscina": "pool",
    "portero": "doorman",
    "trastero": "storage_room",
    "terraza": "terrace",
    "vistas al mar": "sea_view",
}


def keyword_amenities(lines: list[str], mapping: dict[str, str]) -> list[str]:
    """Map free-text feature lines onto the shared vocabulary (substring match)."""
    seen: dict[str, None] = {}
    for line in lines:
        lowered = line.lower().strip()
        if lowered.startswith(("sin ", "no ")):
            continue
        for phrase, canonical in mapping.items():
            if phrase in lowered:
                seen.setdefault(canonical)
    return list(seen)


def normalize(keys: list[str], mapping: dict[str, str]) -> list[str]:
    """Map platform keys to the shared vocabulary, deduped, stable order."""
    seen: dict[str, None] = {}
    for key in keys:
        canonical = mapping.get(key)
        if canonical is not None:
            seen.setdefault(canonical)
    return list(seen)
