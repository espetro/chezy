"""Polite HTTP fetching for the platforms that serve full pages to plain clients.

- one request per `min_delay`..`max_delay` seconds per host, single-threaded
- exponential backoff on 429 / 5xx / transport errors
- hard stop after `max_blocks` consecutive 403s: we never grind against a block
- on-disk response cache keyed by URL so re-runs cost zero requests
"""

from __future__ import annotations

import hashlib
import random
import time
from collections.abc import Callable
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from tenacity import Retrying, retry_if_exception_type, stop_after_attempt, wait_exponential

# One UA is picked per fetcher (per run). Rotating per request is itself a bot tell.
USER_AGENTS = (
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.6 Safari/605.1.15"
    ),
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/130.0.0.0 Safari/537.36"
    ),
)

_MAX_ATTEMPTS = 5
_FORBIDDEN = 403
_TOO_MANY_REQUESTS = 429
_SERVER_ERROR = 500
_CLIENT_ERROR = 400


class BlockedError(RuntimeError):
    """The host refused us repeatedly (403). Stop; do not retry."""

    def __init__(self, host: str, count: int) -> None:
        super().__init__(f"{host} returned {count} consecutive 403s; refusing to keep going")
        self.host = host
        self.count = count


class _RetryableError(Exception):
    pass


class FetchError(RuntimeError):
    """A non-retryable HTTP failure (e.g. 404)."""


class HttpFetcher:
    def __init__(  # noqa: PLR0913
        self,
        cache_dir: Path,
        *,
        min_delay: float = 2.0,
        max_delay: float = 5.0,
        use_cache: bool = True,
        max_blocks: int = 3,
        backoff: float = 2.0,
        client: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        rng: random.Random | None = None,
    ) -> None:
        self._cache_dir = cache_dir
        self._min_delay = min_delay
        self._max_delay = max_delay
        self._use_cache = use_cache
        self._max_blocks = max_blocks
        self._backoff = backoff
        self._sleep = sleep
        self._clock = clock
        self._rng = rng or random.Random()  # noqa: S311
        self._last_request: dict[str, float] = {}
        self._consecutive_403 = 0
        self.network_requests = 0
        self._client = client or httpx.Client(timeout=30, follow_redirects=True)
        self._headers = {
            "User-Agent": self._rng.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9,en;q=0.5",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }

    def close(self) -> None:
        self._client.close()

    def get(self, url: str) -> str:
        """Return the body for `url`, from cache when possible."""
        cached = self._cache_path(url)
        if self._use_cache and cached.exists():
            return cached.read_text(encoding="utf-8")
        body = self._fetch_with_retry(url)
        cached.parent.mkdir(parents=True, exist_ok=True)
        cached.write_text(body, encoding="utf-8")
        return body

    def _cache_path(self, url: str) -> Path:
        digest = hashlib.sha256(url.encode()).hexdigest()[:24]
        return self._cache_dir / urlsplit(url).netloc / f"{digest}.html"

    def _fetch_with_retry(self, url: str) -> str:
        retrying = Retrying(
            retry=retry_if_exception_type(_RetryableError),
            wait=wait_exponential(multiplier=self._backoff, max=60),
            stop=stop_after_attempt(_MAX_ATTEMPTS),
            reraise=True,
        )
        return retrying(self._fetch_once, url)

    def _fetch_once(self, url: str) -> str:
        host = urlsplit(url).netloc
        self._throttle(host)
        self.network_requests += 1
        try:
            response = self._client.get(url, headers=self._headers)
        except httpx.TransportError as exc:
            msg = f"transport error for {url}: {exc}"
            raise _RetryableError(msg) from exc
        status = response.status_code
        if status == _FORBIDDEN:
            self._consecutive_403 += 1
            if self._consecutive_403 >= self._max_blocks:
                raise BlockedError(host, self._consecutive_403)
            msg = f"403 from {host}"
            raise _RetryableError(msg)
        self._consecutive_403 = 0
        if status == _TOO_MANY_REQUESTS or status >= _SERVER_ERROR:
            msg = f"{status} from {host}"
            raise _RetryableError(msg)
        if status >= _CLIENT_ERROR:
            msg = f"{status} for {url}"
            raise FetchError(msg)
        return response.text

    def _throttle(self, host: str) -> None:
        last = self._last_request.get(host)
        if last is not None:
            wait = self._rng.uniform(self._min_delay, self._max_delay) - (self._clock() - last)
            if wait > 0:
                self._sleep(wait)
        self._last_request[host] = self._clock()
