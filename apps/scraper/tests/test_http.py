"""HttpFetcher behaviour against a mock transport; no network."""

from __future__ import annotations

import random
from pathlib import Path

import httpx
import pytest
from chezy_scraper.fetch.http import BlockedError, FetchError, HttpFetcher

URL = "https://www.example.test/search"


def _fetcher(tmp_path: Path, handler: httpx.MockTransport, sleeps: list[float]) -> HttpFetcher:
    return HttpFetcher(
        tmp_path,
        min_delay=2,
        max_delay=5,
        backoff=0,
        client=httpx.Client(transport=handler),
        sleep=sleeps.append,
        clock=lambda: 0.0,
        rng=random.Random(1),  # noqa: S311
    )


def test_cache_hit_costs_no_request(tmp_path: Path) -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, text="<html>ok</html>")

    fetcher = _fetcher(tmp_path, httpx.MockTransport(handler), [])
    assert fetcher.get(URL) == "<html>ok</html>"
    assert fetcher.get(URL) == "<html>ok</html>"
    assert calls == 1


def test_refresh_bypasses_cache(tmp_path: Path) -> None:
    fetcher = HttpFetcher(
        tmp_path,
        use_cache=False,
        client=httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, text="x"))),
        sleep=lambda _: None,
    )
    fetcher.get(URL)
    fetcher.get(URL)
    assert fetcher.network_requests == 2


def test_requests_to_one_host_are_spaced(tmp_path: Path) -> None:
    sleeps: list[float] = []
    fetcher = _fetcher(
        tmp_path, httpx.MockTransport(lambda _: httpx.Response(200, text="x")), sleeps
    )
    fetcher.get(f"{URL}?a=1")
    fetcher.get(f"{URL}?a=2")
    assert len(sleeps) == 1
    assert 2 <= sleeps[0] <= 5


def test_sends_spanish_browser_headers(tmp_path: Path) -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(request.headers)
        return httpx.Response(200, text="x")

    _fetcher(tmp_path, httpx.MockTransport(handler), []).get(URL)
    assert seen["accept-language"].startswith("es-ES")
    assert seen["sec-fetch-mode"] == "navigate"
    assert "Mozilla" in seen["user-agent"]


def test_retries_5xx_then_succeeds(tmp_path: Path) -> None:
    responses = iter([503, 429, 200])

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(next(responses), text="done")

    fetcher = _fetcher(tmp_path, httpx.MockTransport(handler), [])
    assert fetcher.get(URL) == "done"
    assert fetcher.network_requests == 3


def test_three_consecutive_403s_stop_the_run(tmp_path: Path) -> None:
    fetcher = _fetcher(tmp_path, httpx.MockTransport(lambda _: httpx.Response(403)), [])
    with pytest.raises(BlockedError) as excinfo:
        fetcher.get(URL)
    assert excinfo.value.host == "www.example.test"
    assert excinfo.value.count == 3
    assert fetcher.network_requests == 3


def test_a_success_resets_the_403_streak(tmp_path: Path) -> None:
    responses = iter([403, 403, 200, 403, 403, 200])

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(next(responses), text="ok")

    fetcher = _fetcher(tmp_path, httpx.MockTransport(handler), [])
    assert fetcher.get(f"{URL}?a=1") == "ok"
    assert fetcher.get(f"{URL}?a=2") == "ok"


def test_404_is_not_retried(tmp_path: Path) -> None:
    fetcher = _fetcher(tmp_path, httpx.MockTransport(lambda _: httpx.Response(404)), [])
    with pytest.raises(FetchError):
        fetcher.get(URL)
    assert fetcher.network_requests == 1
