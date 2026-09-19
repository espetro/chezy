"""Drive the user's real Chrome over CDP for idealista (DataDome blocks plain HTTP).

Rules this module enforces, because the logged-in session is the asset at risk:

- exactly one dedicated tab is opened and it is closed on exit; other tabs are never touched
- 5-12 s randomized delay between page loads
- a hard per-run page budget (`PageBudgetExceededError` when spent)
- a DataDome challenge stops the run (`BrowserBlockedError`); nothing retries or solves it

Start Chrome yourself first:

    open -a "Google Chrome" --args --remote-debugging-port=9222 \\
        --user-data-dir="$HOME/Library/Application Support/Google/Chrome-cdp"
"""

from __future__ import annotations

import json
import random
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Final, Protocol, Self, cast

import httpx
from websockets.sync.client import connect as ws_connect

from chezy_scraper.jsonx import JsonObj, obj, text

if TYPE_CHECKING:
    from collections.abc import Callable
    from types import TracebackType

_LOAD_TIMEOUT_S: Final = 45.0
_POLL_S: Final = 0.5
_CMD_TIMEOUT_S: Final = 30.0
_MIN_REAL_PAGE_CHARS: Final = 5_000
_BLOCK_MARKERS: Final = ("captcha-delivery.com", "geo.captcha", "datadome")


class BrowserError(RuntimeError):
    """CDP failed or the browser is unreachable."""


class BrowserBlockedError(BrowserError):
    """DataDome served a challenge instead of the page."""


class PageBudgetExceededError(BrowserError):
    """The per-run page budget is spent; resume in a later session."""


class Connection(Protocol):
    def send(self, message: str) -> None: ...
    def recv(self, timeout: float | None = None) -> str | bytes: ...
    def close(self) -> None: ...


@dataclass(frozen=True)
class RenderedPage:
    url: str
    html: str
    # Serializable window globals read after load, e.g. {"utag_data": {...}}.
    globals: JsonObj = field(default_factory=dict)


def _default_connect(url: str) -> Connection:
    return cast("Connection", ws_connect(url, max_size=None, open_timeout=10))


class CdpBrowser:
    """Context manager owning one tab in an already-running Chrome."""

    def __init__(  # noqa: PLR0913
        self,
        cdp_url: str,
        *,
        min_delay: float = 5.0,
        max_delay: float = 12.0,
        page_budget: int = 60,
        connect: Callable[[str], Connection] = _default_connect,
        sleep: Callable[[float], None] = time.sleep,
        rng: random.Random | None = None,
    ) -> None:
        self._cdp_url = cdp_url.rstrip("/")
        self._min_delay = min_delay
        self._max_delay = max_delay
        self._budget = page_budget
        self._connect = connect
        self._sleep = sleep
        self._rng = rng or random.Random()  # noqa: S311
        self._conn: Connection | None = None
        self._next_id = 0
        self._session: str | None = None
        self._target: str | None = None
        self._loaded = 0

    @property
    def pages_loaded(self) -> int:
        return self._loaded

    @property
    def pages_left(self) -> int:
        return self._budget - self._loaded

    def __enter__(self) -> Self:
        try:
            version = httpx.get(f"{self._cdp_url}/json/version", timeout=5).json()
        except (httpx.HTTPError, ValueError) as exc:
            msg = f"no Chrome with remote debugging at {self._cdp_url}: {exc}"
            raise BrowserError(msg) from exc
        ws_url = text(obj(version).get("webSocketDebuggerUrl"))
        if ws_url is None:
            msg = "Chrome did not advertise a webSocketDebuggerUrl"
            raise BrowserError(msg)
        self._conn = self._connect(ws_url)
        created = self._command("Target.createTarget", {"url": "about:blank"})
        self._target = text(created.get("targetId"))
        attached = self._command(
            "Target.attachToTarget", {"targetId": self._target, "flatten": True}
        )
        self._session = text(attached.get("sessionId"))
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        try:
            if self._target is not None and self._conn is not None:
                self._command("Target.closeTarget", {"targetId": self._target})
        except BrowserError:
            pass
        finally:
            if self._conn is not None:
                self._conn.close()
            self._conn = self._session = self._target = None

    def load(self, url: str, *, global_names: tuple[str, ...] = ()) -> RenderedPage:
        """Navigate the dedicated tab, wait for it to settle, and return its DOM."""
        if self._loaded >= self._budget:
            msg = f"page budget of {self._budget} spent"
            raise PageBudgetExceededError(msg)
        if self._loaded > 0:
            self._sleep(self._rng.uniform(self._min_delay, self._max_delay))
        self._loaded += 1
        self._command("Page.navigate", {"url": url}, session=True)
        self._wait_complete()
        html = self._evaluate("document.documentElement.outerHTML")
        html_text = html if isinstance(html, str) else ""
        title = self._evaluate("document.title")
        if self._is_blocked(html_text, title if isinstance(title, str) else ""):
            msg = f"DataDome challenge at {url}"
            raise BrowserBlockedError(msg)
        globals_: JsonObj = {}
        for name in global_names:
            raw = self._evaluate(f"JSON.stringify(window.{name} ?? null)")
            globals_[name] = json.loads(raw) if isinstance(raw, str) else None
        return RenderedPage(url=url, html=html_text, globals=globals_)

    # -- internals ---------------------------------------------------------

    @staticmethod
    def _is_blocked(html: str, title: str) -> bool:
        lowered = html.lower()
        challenged = any(marker in lowered for marker in _BLOCK_MARKERS)
        return (challenged and len(html) < _MIN_REAL_PAGE_CHARS) or "captcha" in title.lower()

    def _wait_complete(self) -> None:
        waited = 0.0
        while waited < _LOAD_TIMEOUT_S:
            if self._evaluate("document.readyState") == "complete":
                return
            self._sleep(_POLL_S)
            waited += _POLL_S
        msg = "page did not reach readyState=complete"
        raise BrowserError(msg)

    def _evaluate(self, expression: str) -> object:
        result = self._command(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True},
            session=True,
        )
        return obj(result.get("result")).get("value")

    def _command(
        self, method: str, params: JsonObj | None = None, *, session: bool = False
    ) -> JsonObj:
        if self._conn is None:
            msg = "browser is not connected"
            raise BrowserError(msg)
        self._next_id += 1
        message: JsonObj = {"id": self._next_id, "method": method, "params": params or {}}
        if session:
            message["sessionId"] = self._session
        self._conn.send(json.dumps(message))
        while True:
            try:
                reply = obj(json.loads(self._conn.recv(timeout=_CMD_TIMEOUT_S)))
            except TimeoutError as exc:
                msg = f"CDP {method} timed out"
                raise BrowserError(msg) from exc
            if reply.get("id") != self._next_id:
                continue  # an event, or a reply to something we no longer await
            if "error" in reply:
                msg = f"CDP {method} failed: {reply['error']}"
                raise BrowserError(msg)
            return obj(reply.get("result"))
