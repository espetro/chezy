"""Galtea structured agent that drives the Chezy dev server over HTTP.

Port of apps/web/evals/tool-trace.eval.ts: guest sign-in cookie handling, the
/api/chat POST shape, and SSE parsing of text-delta / tool-input-available /
tool-output-available events. One Galtea session maps to one guest session plus
one chat_id; state is keyed by input_data.session_id.
"""

# pyright: reportMissingTypeStubs=false

import json
import os
import uuid
from contextlib import AbstractContextManager
from dataclasses import dataclass, field
from http import HTTPStatus
from typing import Any

import httpx
from galtea import AgentInput, AgentResponse, GalteaSpan, SpanType, start_span

BASE_URL = os.environ.get("CHEZY_BASE_URL", "http://localhost:4656")
_SIGN_IN_PATH = "/api/auth/guest?redirectUrl=/"
_CHAT_PATH = "/api/chat"
_MAX_SIGN_IN_HOPS = 6
_TIMEOUT_S = 180.0


@dataclass
class _Session:
    """One Galtea session = one guest session cookie jar + one chat id."""

    client: httpx.Client
    chat_id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class _Turn:
    assistant_text: str = ""
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    status: int = 0
    spans: dict[str, tuple[AbstractContextManager[GalteaSpan], GalteaSpan]] = field(
        default_factory=dict
    )
    calls_by_id: dict[str, dict[str, Any]] = field(default_factory=dict)


_sessions: dict[str, _Session] = {}


def _sign_in_guest(client: httpx.Client) -> None:
    url = _SIGN_IN_PATH
    for _ in range(_MAX_SIGN_IN_HOPS):
        response = client.get(url, follow_redirects=False)
        location = response.headers.get("location")
        is_redirect = HTTPStatus.MULTIPLE_CHOICES <= response.status_code < HTTPStatus.BAD_REQUEST
        if is_redirect and location:
            url = location
            continue
        return
    msg = "guest sign-in redirect chain did not settle"
    raise RuntimeError(msg)


def _get_session(session_id: str) -> _Session:
    state = _sessions.get(session_id)
    if state is None:
        client = httpx.Client(
            base_url=BASE_URL,
            timeout=_TIMEOUT_S,
            follow_redirects=False,
        )
        _sign_in_guest(client)
        state = _Session(client=client)
        _sessions[session_id] = state
    return state


def _handle_event(turn: _Turn, event: dict[str, Any]) -> None:
    event_type = str(event.get("type", ""))
    if event_type == "text-delta":
        turn.assistant_text += str(event.get("delta", ""))
    elif event_type == "tool-input-available":
        call = {
            "toolName": str(event.get("toolName")),
            "input": event.get("input"),
            "output": None,
        }
        call_id = str(event.get("toolCallId"))
        turn.calls_by_id[call_id] = call
        turn.tool_calls.append(call)
        tool_name = str(call["toolName"])
        cm = start_span(name=tool_name, type=SpanType.TOOL, input=call["input"])
        turn.spans[call_id] = (cm, cm.__enter__())
    elif event_type == "tool-output-available":
        call_id = str(event.get("toolCallId"))
        call = turn.calls_by_id.get(call_id)
        if call is not None:
            call["output"] = event.get("output")
        entry = turn.spans.pop(call_id, None)
        if entry is not None:
            cm, span = entry
            try:
                span.update(output=event.get("output"))
            finally:
                cm.__exit__(None, None, None)


def _send_turn(state: _Session, text: str) -> _Turn:
    payload = {
        "id": state.chat_id,
        "message": {
            "id": str(uuid.uuid4()),
            "role": "user",
            "parts": [{"type": "text", "text": text}],
        },
        "selectedChatModel": "",
        "selectedVisibilityType": "private",
    }
    turn = _Turn()

    with state.client.stream("POST", _CHAT_PATH, json=payload) as response:
        turn.status = response.status_code
        if response.status_code != HTTPStatus.OK:
            turn.assistant_text = response.read().decode("utf-8", "replace")
            return turn

        buffer = ""
        for chunk in response.iter_text():
            buffer += chunk
            while "\n" in buffer:
                line, buffer = buffer.split("\n", 1)
                line = line.strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if not data or data == "[DONE]":
                    continue
                try:
                    event = json.loads(data)
                except json.JSONDecodeError:
                    continue
                _handle_event(turn, event)

    for cm, _span in turn.spans.values():
        cm.__exit__(None, None, None)
    return turn


def chezy_agent(input_data: AgentInput) -> AgentResponse:
    """Galtea agent entrypoint: one chat turn against the running dev server."""
    state = _get_session(input_data.session_id)
    text = input_data.last_user_message_str() or ""
    turn = _send_turn(state, text)
    return AgentResponse(
        content=turn.assistant_text,
        metadata={
            "tool_calls": [c["toolName"] for c in turn.tool_calls],
            "status": turn.status,
            "chat_id": state.chat_id,
        },
    )
