"""Idempotent Galtea setup for the Chezy eval harness.

Resolves the product by name, creates the specifications + judge metrics from
specs.py, links them, creates one dataset per runnable spec, waits for dataset
generation, prints all IDs, and writes them to apps/evals/.galtea-ids.json.

Run: uv run --package chezy-evals python -m chezy_evals.setup
"""

# pyright: reportMissingTypeStubs=false
# ruff: noqa: ANN401 - the galtea SDK ships no type stubs; entities are Any

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

from galtea import Galtea

from chezy_evals.specs import (
    EVALUATION_PARAMS,
    EVALUATION_PARAMS_FALLBACK,
    EVALUATOR_MODEL,
    MAX_TEST_CASES,
    MAX_TURNS,
    PRODUCT_NAME,
    RUNNABLE_SPECS,
    S4,
    Spec,
)

IDS_PATH = Path(__file__).resolve().parents[2] / ".galtea-ids.json"
DATASET_POLL_S = 15
DATASET_TIMEOUT_S = 1800
_DATASET_PENDING = {"PENDING", "AUGMENTING", "EXTENDING"}


def _client() -> Galtea:
    api_key = os.environ.get("GALTEA_API_KEY")
    if not api_key:
        sys.exit("GALTEA_API_KEY is not set; export it from the root .env")
    return Galtea(api_key=api_key)


def _resolve_product(galtea: Galtea) -> Any:
    try:
        product = galtea.products.get_by_name(PRODUCT_NAME)
    except Exception:  # noqa: BLE001
        product = None
    if product is None:
        sys.exit(
            f"Product {PRODUCT_NAME!r} not found and the SDK cannot create products; "
            "create it in https://platform.galtea.ai and re-run."
        )
    return product


def _find_metric(galtea: Galtea, name: str) -> Any:
    for metric in galtea.metrics.list():
        if metric.name == name:
            return metric
    return None


def _create_metric(galtea: Galtea, spec: Spec) -> Any:
    name = f"chezy-{spec.key}"
    existing = _find_metric(galtea, name)
    if existing is not None:
        return existing
    kwargs: dict[str, Any] = {
        "name": name,
        "evaluator_model_name": EVALUATOR_MODEL,
        "source": "partial_prompt",
        "judge_prompt": spec.judge_prompt,
        "description": spec.description,
        "tags": ["chezy", spec.key],
    }
    try:
        return galtea.metrics.create(evaluation_params=EVALUATION_PARAMS, **kwargs)
    except Exception as exc:  # noqa: BLE001 - retry with conversation-level params
        print(f"metric {name}: {EVALUATION_PARAMS} rejected ({exc}); trying fallback")
        return galtea.metrics.create(evaluation_params=EVALUATION_PARAMS_FALLBACK, **kwargs)


def _find_spec(galtea: Galtea, product_id: str, spec: Spec) -> Any:
    for existing in galtea.specifications.list(product_id=product_id):
        if existing.name == spec.name and str(existing.type).endswith(spec.type):
            return existing
    return None


def _create_spec(galtea: Galtea, product_id: str, spec: Spec, metric: Any) -> Any:
    existing = _find_spec(galtea, product_id, spec)
    if existing is not None:
        return existing
    kwargs: dict[str, Any] = {}
    if spec.dataset_type:
        kwargs["dataset_type"] = spec.dataset_type
    if spec.test_variant:
        kwargs["dataset_variant"] = spec.test_variant
    if metric is not None:
        kwargs["metric_ids"] = [metric.id]
    return galtea.specifications.create(
        product_id=product_id,
        name=spec.name,
        description=spec.description,
        type=spec.type,
        **kwargs,
    )


def _find_dataset(galtea: Galtea, product_id: str, name: str) -> Any:
    for dataset in galtea.datasets.list(product_id=product_id):
        if dataset.name == name:
            return dataset
    return None


def _create_dataset(galtea: Galtea, product_id: str, spec: Spec, spec_id: str) -> Any:
    name = f"chezy-{spec.key}"
    existing = _find_dataset(galtea, product_id, name)
    if existing is not None:
        return existing
    kwargs: dict[str, Any] = {"max_test_cases": MAX_TEST_CASES}
    if spec.dataset_type == "SECURITY":
        # Spec-derived SECURITY datasets require variants=["custom"]; the spec's
        # own test_variant carries the real threat category.
        kwargs["variants"] = ["custom"]
        kwargs["strategies"] = ["original"]
    else:
        kwargs["max_iterations"] = MAX_TURNS
    return galtea.datasets.create(
        name=name,
        product_id=product_id,
        specification_id=spec_id,
        **kwargs,
    )


def _wait_datasets(galtea: Galtea, dataset_ids: list[str]) -> dict[str, str]:
    deadline = time.monotonic() + DATASET_TIMEOUT_S
    status_by_id = dict.fromkeys(dataset_ids, "PENDING")
    while time.monotonic() < deadline:
        pending = False
        for dataset_id in dataset_ids:
            dataset = galtea.datasets.get(dataset_id)
            status = str(dataset.status).split(".")[-1]
            status_by_id[dataset_id] = status
            if status in _DATASET_PENDING:
                pending = True
        if not pending:
            return status_by_id
        print(f"datasets: {status_by_id}")
        time.sleep(DATASET_POLL_S)
    return status_by_id


def main() -> None:
    galtea = _client()
    product = _resolve_product(galtea)
    print(f"product {product.id} ({product.name})")

    ids: dict[str, Any] = {
        "product_id": product.id,
        "specs": {},
        "metrics": {},
        "datasets": {},
    }

    dataset_ids: list[str] = []
    for spec in RUNNABLE_SPECS:
        metric = _create_metric(galtea, spec)
        if metric is None:
            sys.exit(f"metric create returned None for {spec.key}")
        ids["metrics"][spec.key] = metric.id
        print(f"metric {metric.id} chezy-{spec.key}")

        created = _create_spec(galtea, product.id, spec, metric)
        ids["specs"][spec.key] = created.id
        print(f"spec   {created.id} {spec.name!r}")

        dataset = _create_dataset(galtea, product.id, spec, created.id)
        ids["datasets"][spec.key] = dataset.id
        dataset_ids.append(dataset.id)
        print(f"dataset {dataset.id} chezy-{spec.key} status={dataset.status}")

    # S4 INABILITY gets no dataset, but still gets a spec row for completeness.
    s4 = _find_spec(galtea, product.id, S4)
    if s4 is None:
        s4 = galtea.specifications.create(
            product_id=product.id,
            name=S4.name,
            description=S4.description,
            type=S4.type,
        )
    if s4 is None:
        sys.exit("spec create returned None for s4")
    ids["specs"][S4.key] = s4.id
    print(f"spec   {s4.id} {S4.name!r} (no dataset)")

    statuses = _wait_datasets(galtea, dataset_ids)
    print(f"dataset statuses: {statuses}")
    not_ready = {k: v for k, v in statuses.items() if v != "SUCCESS"}
    if not_ready:
        print(f"WARNING: datasets not ready: {not_ready}", file=sys.stderr)

    IDS_PATH.write_text(json.dumps(ids, indent=2))
    print(f"wrote {IDS_PATH}")
    print(json.dumps(ids, indent=2))


if __name__ == "__main__":
    main()
