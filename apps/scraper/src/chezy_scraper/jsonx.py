"""Tolerant accessors over untyped JSON payloads.

Source payloads are large and change without notice, so adapters read them
through these helpers: every accessor returns `None` (or an empty container)
on a missing or mistyped value instead of raising.
"""

from __future__ import annotations

from typing import cast

JsonObj = dict[str, object]


def obj(value: object) -> JsonObj:
    return cast("JsonObj", value) if isinstance(value, dict) else {}


def arr(value: object) -> list[object]:
    return cast("list[object]", value) if isinstance(value, list) else []


def dig(value: object, *path: str | int) -> object:
    """Walk `path` through nested dicts/lists; `None` on any miss."""
    current: object = value
    for key in path:
        if isinstance(key, int):
            items = arr(current)
            current = items[key] if -len(items) <= key < len(items) else None
        else:
            current = obj(current).get(key)
        if current is None:
            return None
    return current


def text(value: object) -> str | None:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def integer(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    return None


def number(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        return float(value)
    return None


def boolean(value: object) -> bool | None:
    return value if isinstance(value, bool) else None
