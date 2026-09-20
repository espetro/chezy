# pyright: basic
# pyarrow ships partial type information, so strict inference cannot resolve its API.
"""Photo enrichment: VLM labelling via mock transport, cache reuse, image statistics."""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from chezy_scraper.config import Settings
from chezy_scraper.enrich_media import (
    FEATURE_SCHEMA,
    MAX_ATTEMPTS,
    VLM_FIELDS,
    cache_path,
    image_stats,
    run,
)
from PIL import Image

MODEL = "test/vlm"
GOOD_FIELDS = {
    "room_type_pred": "kitchen",
    "brightness": "bright",
    "floor_material": "tile",
    "wall_condition": "good",
    "condition": "renovated",
    "kitchen_modern": True,
    "bath_modern": None,
    "furnished_level": "furnished",
    "view": "none",
    "outdoor_space": "none",
    "notes": "A white kitchen.",
}
EXPECTED_COLUMNS = [
    *VLM_FIELDS,
    "platform",
    "platform_id",
    "position",
    "path",
    "width",
    "height",
    "aspect",
    "luminance",
    "colorfulness",
    "sharpness",
    "phash",
    "model",
    "ok",
]


def _no_sleep(_: float) -> None:
    return None


def _settings(tmp_path: Path) -> Settings:
    return Settings(
        data_dir=tmp_path / ".data",
        media_root=tmp_path / "media",
        database_url="postgresql://x",
        cdp_url="http://127.0.0.1:1",
        chrome_profile_dir=tmp_path,
        vlm_base_url="http://vlm.test/v1",
        vlm_api_key="k",
        vlm_model=MODEL,
    )


def _webp(
    path: Path, color: tuple[int, int, int] = (200, 120, 60), size: tuple[int, int] = (30, 20)
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", size, color).save(path, format="WEBP")


def _dataset(tmp_path: Path) -> Path:
    root = tmp_path / "ds"
    rows = [
        ("fotocasa", "1", 1, "media/fotocasa/1/01-kitchen.webp"),
        ("fotocasa", "1", 2, "media/fotocasa/1/02-bedroom.webp"),
        ("fotocasa", "1", 3, "media/fotocasa/1/03-missing.webp"),
        ("fotocasa", "1", 4, None),
    ]
    table = pa.table(
        {
            "platform": [r[0] for r in rows],
            "platform_id": [r[1] for r in rows],
            "position": pa.array([r[2] for r in rows], pa.int64()),
            "path": [r[3] for r in rows],
        }
    )
    (root / "data").mkdir(parents=True)
    pq.write_table(table, root / "data" / "media.parquet")
    _webp(root / rows[0][3])
    _webp(root / rows[1][3])
    return root


def _completion(content: str, status: int = 200) -> httpx.Response:
    return httpx.Response(status, json={"choices": [{"message": {"content": content}}]})


class _Recorder:
    def __init__(self, reply: str, status: int = 200) -> None:
        self.calls = 0
        self.reply = reply
        self.status = status
        self.transport = httpx.MockTransport(self._handle)

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.calls += 1
        assert request.url.path == "/v1/chat/completions"
        assert request.headers["authorization"] == "Bearer k"
        body = json.loads(request.content)
        assert body["model"] == MODEL
        assert body["messages"][0]["content"][1]["image_url"]["url"].startswith(
            "data:image/webp;base64,"
        )
        return _completion(self.reply, self.status)


def test_happy_path_writes_table_and_cache(tmp_path: Path) -> None:
    root = _dataset(tmp_path)
    fenced = "```json\n" + json.dumps(GOOD_FIELDS) + "\n```"
    recorder = _Recorder(fenced)
    result = run(_settings(tmp_path), root, transport=recorder.transport, sleep=_no_sleep)

    assert (result.listings, result.photos, result.ok, result.failed) == (1, 3, 2, 1)
    table = pq.read_table(result.out_path)
    assert table.schema.names == EXPECTED_COLUMNS
    assert table.schema.equals(FEATURE_SCHEMA)
    rows = sorted(table.to_pylist(), key=lambda r: int(r["position"]))
    assert [r["ok"] for r in rows] == [True, True, False]
    assert rows[0]["room_type_pred"] == "kitchen"
    assert rows[0]["kitchen_modern"] is True
    assert rows[0]["bath_modern"] is None
    assert rows[0]["width"] == 30
    assert rows[2]["phash"] is None
    assert {r["model"] for r in rows} == {MODEL}
    assert recorder.calls == 2

    cache = json.loads(cache_path(root, "fotocasa", "1").read_text(encoding="utf-8"))
    assert list(cache) == ["platform", "platform_id", "model", "photos"]
    assert cache["model"] == MODEL
    photos = cache["photos"]
    assert [list(p) for p in photos] == [["position", "ok", "attempts", "error", "fields"]] * 3
    assert all(list(p["fields"]) == list(VLM_FIELDS) for p in photos)
    assert photos[0]["attempts"] == 1
    assert photos[2] == {
        "position": 3,
        "ok": False,
        "attempts": 0,
        "error": "missing file",
        "fields": dict.fromkeys(VLM_FIELDS),
    }


def test_cache_reuse_only_calls_for_missing_or_failed(tmp_path: Path) -> None:
    root = _dataset(tmp_path)
    settings = _settings(tmp_path)
    first = _Recorder(json.dumps(GOOD_FIELDS))
    run(settings, root, transport=first.transport, sleep=_no_sleep)
    assert first.calls == 2

    second = _Recorder(json.dumps(GOOD_FIELDS))
    run(settings, root, transport=second.transport, sleep=_no_sleep)
    assert second.calls == 0

    _webp(root / "media/fotocasa/1/03-missing.webp")
    third = _Recorder(json.dumps(GOOD_FIELDS))
    result = run(settings, root, transport=third.transport, sleep=_no_sleep)
    assert third.calls == 1
    assert (result.ok, result.failed) == (3, 0)

    fourth = _Recorder(json.dumps(GOOD_FIELDS))
    run(settings, root, transport=fourth.transport, refresh=True, sleep=_no_sleep)
    assert fourth.calls == 3


@pytest.mark.parametrize(
    ("reply", "status", "attempts"),
    [
        ("not json at all", 200, MAX_ATTEMPTS),
        ("[1, 2]", 200, MAX_ATTEMPTS),
        ("{}", 500, MAX_ATTEMPTS),
        ("{}", 429, MAX_ATTEMPTS),
        ("{}", 400, 1),
        ("{}", 401, 1),
    ],
)
def test_failures_record_attempts(tmp_path: Path, reply: str, status: int, attempts: int) -> None:
    root = _dataset(tmp_path)
    recorder = _Recorder(reply, status)
    result = run(_settings(tmp_path), root, transport=recorder.transport, sleep=_no_sleep)
    assert result.ok == 0
    rows = pq.read_table(result.out_path).to_pylist()
    assert all(r["ok"] is False for r in rows)
    photos = json.loads(cache_path(root, "fotocasa", "1").read_text(encoding="utf-8"))["photos"]
    labelled = [p for p in photos if p["error"] != "missing file"]
    assert [p["attempts"] for p in labelled] == [attempts, attempts]
    assert all(p["error"] for p in labelled)
    assert recorder.calls == 2 * attempts


@pytest.mark.parametrize(
    ("color", "luminance"),
    [((255, 255, 255), 1.0), ((0, 0, 0), 0.0), ((128, 128, 128), 128 / 255)],
)
def test_flat_image_stats(tmp_path: Path, color: tuple[int, int, int], luminance: float) -> None:
    path = tmp_path / "flat.webp"
    _webp(path, color, size=(60, 40))
    st = image_stats(path)
    assert (st.width, st.height) == (60, 40)
    assert st.aspect == pytest.approx(1.5)
    assert st.luminance == pytest.approx(luminance, abs=0.02)
    assert st.colorfulness == pytest.approx(0.0, abs=0.5)
    assert st.sharpness == pytest.approx(0.0, abs=1e-6)
    assert len(st.phash) == 16
    assert st.phash == st.phash.lower()
    int(st.phash, 16)


def test_phash_and_sharpness_distinguish_structure(tmp_path: Path) -> None:
    flat = tmp_path / "flat.webp"
    _webp(flat, (255, 255, 255), size=(64, 64))
    split_img = Image.new("L", (64, 64), 0)
    split_img.paste(255, (0, 0, 32, 64))
    split = tmp_path / "split.webp"
    split_img.convert("RGB").save(split, format="WEBP", lossless=True)
    a, b = image_stats(flat), image_stats(split)
    assert a.phash != b.phash
    assert b.sharpness > a.sharpness
    assert image_stats(split).phash == b.phash


def test_downscale_keeps_original_dimensions(tmp_path: Path) -> None:
    path = tmp_path / "big.webp"
    _webp(path, (10, 200, 30), size=(1280, 853))
    st = image_stats(path)
    assert (st.width, st.height) == (1280, 853)
    assert st.aspect == pytest.approx(1280 / 853)
