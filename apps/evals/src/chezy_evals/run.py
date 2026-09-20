"""Run a Galtea evaluation pass for a Chezy version.

Usage: uv run --package chezy-evals python -m chezy_evals.run --version <name>

Creates the version if missing (name should be the git short SHA; description
defaults to the commit subject), runs evaluations.run with the local HTTP
agent across all runnable specifications, waits for evaluations to settle,
prints per-metric pass/fail plus judge reasons for failures, and dumps the
full result JSON to /tmp/chezy-galtea/<version>-<ts>.json.
"""

# pyright: reportMissingTypeStubs=false
# ruff: noqa: ANN401 - the galtea SDK ships no type stubs; entities are Any

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from galtea import Galtea

from chezy_evals.agent import chezy_agent
from chezy_evals.setup import IDS_PATH

OUT_DIR = Path("/tmp/chezy-galtea")  # noqa: S108 - scratch dir, per plan
WAIT_TIMEOUT_S = 3600
WAIT_POLL_S = 10
PASS_THRESHOLD = 0.5


def _git_subject() -> str:
    try:
        return subprocess.run(
            ["git", "log", "-1", "--pretty=%s"],  # noqa: S607
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    except Exception:  # noqa: BLE001
        return ""


def _get_or_create_version(galtea: Galtea, product_id: str, name: str) -> Any:
    for version in galtea.versions.list(product_id=product_id):
        if version.name == name:
            return version
    return galtea.versions.create(
        product_id=product_id,
        name=name,
        description=_git_subject(),
    )


def _session_transcript(galtea: Galtea, session_id: str) -> list[dict[str, Any]]:
    turns: list[dict[str, Any]] = []
    try:
        traces = galtea.traces.list(session_id=session_id)
    except Exception as exc:  # noqa: BLE001
        return [{"error": f"traces.list failed: {exc}"}]
    for trace in sorted(traces, key=lambda t: t.index or 0):
        turns.append(
            {
                "trace_id": trace.id,
                "input": trace.input,
                "actual_output": trace.actual_output,
            }
        )
    return turns


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True, help="version name (git short SHA)")
    parser.add_argument(
        "--specs",
        default=None,
        help="comma-separated spec keys from .galtea-ids.json (e.g. s1,s2); default all",
    )
    args = parser.parse_args()

    api_key = os.environ.get("GALTEA_API_KEY")
    if not api_key:
        sys.exit("GALTEA_API_KEY is not set; export it from the root .env")
    galtea = Galtea(api_key=api_key)

    ids = json.loads(IDS_PATH.read_text())
    product_id = ids["product_id"]
    wanted = set(args.specs.split(",")) if args.specs else None
    spec_ids = [
        spec_id
        for key, spec_id in ids["specs"].items()
        if key in ids["datasets"] and (wanted is None or key in wanted)
    ]
    if not spec_ids:
        sys.exit(f"no runnable specs matched --specs {args.specs}")
    metric_name_by_id = {v: f"chezy-{k}" for k, v in ids["metrics"].items()}

    version = _get_or_create_version(galtea, product_id, args.version)
    if version is None:
        sys.exit("version create failed")
    print(f"version {version.id} ({version.name})")

    started = time.time()
    result = galtea.evaluations.run(
        version_id=version.id,
        agent=chezy_agent,
        specification_ids=spec_ids,
    )
    print(f"evaluations.run finished in {time.time() - started:.0f}s")
    evaluations = result.get("evaluations", [])
    print(f"{result.get('testCaseCount')} test cases, {len(evaluations)} evaluations")

    eval_ids = [e.id if hasattr(e, "id") else e["id"] for e in evaluations]
    settled = galtea.evaluations.wait_for(
        evaluation_ids=eval_ids,
        timeout=WAIT_TIMEOUT_S,
        poll_interval=WAIT_POLL_S,
    )

    rows: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    for evaluation in settled:
        metric_name = metric_name_by_id.get(evaluation.metric_id, evaluation.metric_id)
        passed = evaluation.score is not None and evaluation.score >= PASS_THRESHOLD
        row: dict[str, Any] = {
            "evaluation_id": evaluation.id,
            "metric": metric_name,
            "session_id": evaluation.session_id,
            "score": evaluation.score,
            "status": str(evaluation.status),
            "reason": evaluation.reason,
        }
        rows.append(row)
        mark = "PASS" if passed else "FAIL"
        print(f"{mark} {metric_name} score={evaluation.score} session={evaluation.session_id}")
        if not passed and evaluation.session_id:
            row["transcript"] = _session_transcript(galtea, evaluation.session_id)
            failures.append(row)
        if not passed:
            print(f"  reason: {evaluation.reason}")

    summary: dict[str, dict[str, int]] = {}
    for row in rows:
        bucket = summary.setdefault(row["metric"], {"pass": 0, "fail": 0})
        passed = row["score"] is not None and row["score"] >= PASS_THRESHOLD
        bucket["pass" if passed else "fail"] += 1
    print("\nsummary:")
    for metric, counts in summary.items():
        print(f"  {metric}: {counts['pass']} pass / {counts['fail']} fail")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(tz=UTC).strftime("%Y%m%dT%H%M%SZ")
    out_path = OUT_DIR / f"{args.version}-{ts}.json"
    out_path.write_text(
        json.dumps(
            {
                "version_id": version.id,
                "version": args.version,
                "product_id": product_id,
                "spec_ids": ids["specs"],
                "dataset_ids": ids["datasets"],
                "metric_ids": ids["metrics"],
                "summary": summary,
                "evaluations": rows,
            },
            indent=2,
            default=str,
        )
    )
    print(f"\ndump: {out_path}")


if __name__ == "__main__":
    main()
