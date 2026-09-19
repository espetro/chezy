"""Env-bound settings for the scraper.

Every environment read for the scraper lives here so the rest of the package
takes a `Settings` instead of touching `os.environ`.

    CHEZY_DATA_DIR      payloads, JSONL, cache   default: .data
    CHEZY_MEDIA_DIR     image mirror root        default: /Volumes/KeVagiBe/chezy/media
    CHEZY_CDP_URL       Chrome CDP endpoint      default: http://127.0.0.1:9222
    CHEZY_CHROME_PROFILE_DIR
                        Chrome profile dir holding DevToolsActivePort (default macOS Chrome)
    CHEZY_IDEALISTA_RENT_URL / CHEZY_IDEALISTA_SALE_URL
                        idealista search URLs (e.g. a `?shape=` polygon); default: whole city
    DATABASE_URL        pg0 connection string    default: local pg0
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

_DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres"


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    media_root: Path
    database_url: str
    cdp_url: str
    chrome_profile_dir: Path
    idealista_search_urls: dict[str, str] = field(default_factory=dict)
    # One request per 2-5 s per host, randomized.
    http_min_delay: float = 2.0
    http_max_delay: float = 5.0
    # Real-browser page loads are expensive and session-risky: 5-12 s apart.
    browser_min_delay: float = 5.0
    browser_max_delay: float = 12.0
    # Hard per-run page budget for the idealista browser path.
    browser_page_budget: int = 60

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            data_dir=Path(os.environ.get("CHEZY_DATA_DIR", ".data")),
            media_root=Path(os.environ.get("CHEZY_MEDIA_DIR", "/Volumes/KeVagiBe/chezy/media")),
            database_url=os.environ.get("DATABASE_URL", _DEFAULT_DATABASE_URL),
            cdp_url=os.environ.get("CHEZY_CDP_URL", "http://127.0.0.1:9222"),
            chrome_profile_dir=Path(
                os.environ.get(
                    "CHEZY_CHROME_PROFILE_DIR",
                    str(Path.home() / "Library/Application Support/Google/Chrome"),
                )
            ),
            idealista_search_urls={
                op: url
                for op, var in (
                    ("rent", "CHEZY_IDEALISTA_RENT_URL"),
                    ("sale", "CHEZY_IDEALISTA_SALE_URL"),
                )
                if (url := os.environ.get(var))
            },
        )

    @property
    def cache_dir(self) -> Path:
        return self.data_dir / "cache"

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def listings_dir(self) -> Path:
        return self.data_dir / "listings"
