"""CDP driver against a scripted fake connection; no Chrome involved."""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest
from chezy_scraper.fetch.browser import (
    BrowserBlockedError,
    BrowserError,
    CdpBrowser,
    PageBudgetExceededError,
)
from chezy_scraper.jsonx import JsonObj, obj

REAL_HTML = "<html>" + "x" * 6000 + "</html>"
CHALLENGE_HTML = "<html><iframe src='https://geo.captcha-delivery.com/x'></iframe></html>"


class FakeChrome:
    """Answers CDP commands; records every method it saw."""

    def __init__(self, html: str, title: str = "Piso") -> None:
        self.html = html
        self.title = title
        self.methods: list[str] = []
        self.sessions: list[str | None] = []
        self._replies: list[str] = []
        self.closed = False

    def send(self, message: str) -> None:
        request = obj(json.loads(message))
        method = request["method"]
        self.methods.append(str(method))
        session = request.get("sessionId")
        self.sessions.append(str(session) if session is not None else None)
        self._replies.append(json.dumps({"method": "Page.frameNavigated", "params": {}}))
        self._replies.append(json.dumps({"id": request["id"], "result": self._result(request)}))

    def _result(self, request: JsonObj) -> dict[str, object]:
        method = request["method"]
        params = obj(request["params"])
        if method == "Target.createTarget":
            return {"targetId": "T1"}
        if method == "Target.attachToTarget":
            return {"sessionId": "S1"}
        if method == "Runtime.evaluate":
            expr = str(params["expression"])
            value: object = {
                "document.readyState": "complete",
                "document.documentElement.outerHTML": self.html,
                "document.title": self.title,
            }.get(expr)
            if value is None and "utag_data" in expr:
                value = json.dumps({"list_totalResult": "1617"})
            return {"result": {"value": value}}
        return {}

    def recv(self, timeout: float | None = None) -> str:  # noqa: ARG002
        return self._replies.pop(0)

    def close(self) -> None:
        self.closed = True


def _open(
    chrome: FakeChrome, monkeypatch: pytest.MonkeyPatch, *, budget: int = 60
) -> tuple[CdpBrowser, list[float]]:
    def fake_get(*_args: object, **_kwargs: object) -> httpx.Response:
        return httpx.Response(
            200,
            json={"webSocketDebuggerUrl": "ws://x/devtools/browser/1"},
            request=httpx.Request("GET", "http://x"),
        )

    monkeypatch.setattr(httpx, "get", fake_get)
    sleeps: list[float] = []
    connect: Callable[[str], FakeChrome] = lambda _url: chrome  # noqa: E731
    return (
        CdpBrowser(
            "http://127.0.0.1:9222",
            page_budget=budget,
            connect=connect,
            sleep=sleeps.append,
        ),
        sleeps,
    )


def test_opens_one_tab_reads_globals_and_closes_it(monkeypatch: pytest.MonkeyPatch) -> None:
    chrome = FakeChrome(REAL_HTML)
    browser, _ = _open(chrome, monkeypatch)
    with browser:
        page = browser.load("https://www.idealista.com/x", global_names=("utag_data",))
    assert page.html == REAL_HTML
    assert page.globals == {"utag_data": {"list_totalResult": "1617"}}
    assert chrome.methods.count("Target.createTarget") == 1
    assert chrome.methods[-1] == "Target.closeTarget"
    assert chrome.closed
    # Page-level commands are always sent on the attached session, never the browser.
    nav = chrome.methods.index("Page.navigate")
    assert chrome.sessions[nav] == "S1"


def test_delay_between_loads_and_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    chrome = FakeChrome(REAL_HTML)
    browser, sleeps = _open(chrome, monkeypatch, budget=2)
    with browser:
        browser.load("https://www.idealista.com/1")
        assert sleeps == []
        browser.load("https://www.idealista.com/2")
        assert len(sleeps) == 1
        assert 5.0 <= sleeps[0] <= 12.0
        assert browser.pages_left == 0
        with pytest.raises(PageBudgetExceededError):
            browser.load("https://www.idealista.com/3")


def test_datadome_challenge_stops_the_run(monkeypatch: pytest.MonkeyPatch) -> None:
    chrome = FakeChrome(CHALLENGE_HTML)
    browser, _ = _open(chrome, monkeypatch)
    with browser, pytest.raises(BrowserBlockedError):
        browser.load("https://www.idealista.com/x")
    assert chrome.methods[-1] == "Target.closeTarget"


def test_falls_back_to_devtools_active_port(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """chrome://inspect mode: /json/version is a 404, the ws path lives in DevToolsActivePort."""

    def not_found(*_args: object, **_kwargs: object) -> httpx.Response:
        return httpx.Response(404, request=httpx.Request("GET", "http://x"))

    monkeypatch.setattr(httpx, "get", not_found)
    port_file = tmp_path / "DevToolsActivePort"
    port_file.write_text("9222\n/devtools/browser/abc-123", encoding="utf-8")
    chrome = FakeChrome(REAL_HTML)
    urls: list[str] = []

    def connect(url: str) -> FakeChrome:
        urls.append(url)
        return chrome

    with CdpBrowser("http://127.0.0.1:9222", active_port_file=port_file, connect=connect):
        pass
    assert urls == ["ws://127.0.0.1:9222/devtools/browser/abc-123"]


def test_no_endpoint_at_all_is_a_clear_error(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    def not_found(*_args: object, **_kwargs: object) -> httpx.Response:
        return httpx.Response(404, request=httpx.Request("GET", "http://x"))

    monkeypatch.setattr(httpx, "get", not_found)
    browser = CdpBrowser("http://127.0.0.1:9222", active_port_file=tmp_path / "missing")
    with pytest.raises(BrowserError, match="chrome://inspect"), browser:
        pass
