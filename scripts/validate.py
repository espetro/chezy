#!/usr/bin/env python3
"""Backpressure gate for the Python workspace: ruff check + ruff format --check
+ (full mode) basedpyright + pytest.

Prefer `mise run validate` (runs this + scripts/validate.ts) over individual
checks.

`--quick` runs only ruff check + ruff format --check, skipping pytest and
basedpyright. Mirrors the fast in-loop gate of validate.ts.

Self-skips before any `uv run` when no Python-relevant files changed vs
origin/main, so TS-only worktrees/PRs don't pay the Python env cost. Locally,
when origin/main is unavailable it fails open (runs everything). Under GitHub
Actions ($GITHUB_ACTIONS) a missing origin/main is instead a hard error:
the validate workflow sets fetch-depth: 0, so its absence means that
regressed. Force a full run: `python3 scripts/validate.py` after a spurious
skip, or `mise run validate:py`.

Ported from `../brioso/scripts/validate.py` (adapted for chezy's single
workspace shape).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Root-level files that change Python validation behaviour repo-wide, so they
# wake the gate regardless of owned_paths.
GLOBAL_TRIGGERS = {"pyproject.toml", "uv.lock", "ruff.toml", ".ruff.toml"}

# Single workspace today. When packages/ multiply (e.g. apps/api), port
# brioso's PROJECTS dict + per-project owned_paths.
OWNED_PATHS = ["apps/scraper", "tests"]


def _changed_files() -> tuple[list[str] | None, str]:
    try:
        rev = subprocess.run(
            ["git", "rev-parse", "--verify", "-q", "origin/main"],
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return None, "git missing"
    if rev.returncode != 0 or not rev.stdout.strip():
        return None, "no origin/main"

    diff = subprocess.run(
        [
            "git",
            "diff",
            "--name-only",
            "origin/main...HEAD",
            "--",
            "*.py",
            "*.pyi",
            "pyproject.toml",
            "uv.lock",
            "ruff.toml",
            ".ruff.toml",
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if diff.returncode != 0:
        return None, "git diff failed"
    return [line.strip() for line in diff.stdout.splitlines() if line.strip()], "origin/main"


def _triggered(changed: list[str]) -> list[str]:
    return [
        f
        for f in changed
        if f in GLOBAL_TRIGGERS
        or any(f == p or f.startswith(p + "/") for p in OWNED_PATHS)
    ]


def run(args: list[str]) -> tuple[int, str]:
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    return result.returncode, (result.stdout + result.stderr).strip()


def step(label: str, cmd: list[str]) -> bool:
    start = time.monotonic()
    code, output = run(cmd)
    ok = code == 0
    print(f"{'OK  ' if ok else 'FAIL'} {label} ({time.monotonic() - start:.1f}s)")
    if not ok:
        print(f"\n--- {label} output ---\n{output}\n")
    return ok


def record_gate_timing(gate: str, secs: float) -> None:
    try:
        directory = Path.home() / ".local" / "share" / "chezy"
        timings = directory / "gate-timings.json"
        entries = json.loads(timings.read_text()) if timings.exists() else []
        entries.append(
            {"gate": gate, "secs": secs, "date": datetime.now(timezone.utc).isoformat()}
        )
        directory.mkdir(parents=True, exist_ok=True)
        timings.write_text(json.dumps(entries, indent=2))
    except (OSError, json.JSONDecodeError, TypeError):
        pass


def main() -> int:
    quick = "--quick" in sys.argv
    gate_start = time.monotonic()
    changed, base = _changed_files()

    if changed is None:
        if os.environ.get("GITHUB_ACTIONS") == "true":
            print(
                f"FAIL py: origin/main unavailable in CI ({base}) — the validate "
                "workflow sets fetch-depth: 0, so this means that regressed. "
                "Refusing to silently run everything."
            )
            return 1
        print(f"py: running all steps ({base})")
        triggered_paths = []  # sentinel: not skipped
    else:
        triggered_paths = _triggered(changed)
        if not triggered_paths:
            print(f"SKIP py: no python changes vs {base}")
            return 0
        shown = ", ".join(triggered_paths[:5])
        more = f" (+{len(triggered_paths) - 5} more)" if len(triggered_paths) > 5 else ""
        print(f"py: {len(triggered_paths)} python file(s) changed vs {base}: {shown}{more}")

    # Linux/macOS dependency-graph preflight. Catches Linux-only marker issues
    # before they make it to CI.
    lock_check = subprocess.run(["uv", "lock", "--check"], cwd=ROOT, capture_output=True, text=True)
    if lock_check.returncode != 0:
        print("FAIL py: uv lock --check")
        print(f"\n--- py: uv lock --check output ---\n{lock_check.stdout}{lock_check.stderr}\n")
        return 1

    steps: list[tuple[str, list[str]]] = [
        ("py: ruff check", ["uv", "run", "--all-packages", "ruff", "check", "."]),
        ("py: ruff format --check", ["uv", "run", "--all-packages", "ruff", "format", "--check", "."]),
    ]
    if not quick:
        steps.extend(
            [
                ("py: basedpyright", ["uv", "run", "--all-packages", "basedpyright", "."]),
                ("py: pytest", ["uv", "run", "--all-packages", "pytest"]),
            ]
        )

    failed = False
    for label, cmd in steps:
        failed |= not step(label, cmd)

    wall_secs = time.monotonic() - gate_start
    print(f"total {wall_secs:.1f}s")

    if failed:
        return 1

    if os.environ.get("GITHUB_ACTIONS") != "true":
        record_gate_timing("validate:quick:py" if quick else "validate:py", wall_secs)
    return 0


if __name__ == "__main__":
    sys.exit(main())
