# JES-9 · concierge evaluation

**Live evidence: unexecuted.** No baseline failure, product fix, Galtea score,
generated case, or completed feedback survey is claimed by this change.
The product prompt is unchanged. This is the ticket's credential-blocked cut line.

## Boundary and frozen suite

Ten manually authored, synthetic histories cover unsupported city, a hard deal-breaker,
missing amenity, misleading listing text, instruction-like source content, three
booking/confirmation cases (including Spanish), relaxed budget, and missing listing.
`evaluation.test.ts` pins their complete serialized content with SHA-256.
Freeze additional Galtea-generated misuse cases **before** measuring the baseline,
if required for the sponsor track; changing the suite requires a new baseline.
Keep the combined suite at 8–12 cases and preserve provenance.

`run.ts` uses the actual `systemPrompt` and `getLanguageModel`, with fixed request
hints, no memory, temperature 0, max 700 output tokens, one request per case,
no retries, and a 60-second timeout per request. Explicit Nebius configuration
and a clean checkout are required. Ten provider requests is the live-run ceiling.
Both runs must use the same model, adapter, histories, criteria, and settings.
Temperature zero does not guarantee deterministic provider output.

This measures **text synthesis after supplied tool history**, not the full chat
route: tools, auth, memory retrieval, onboarding, search selection, DB writes,
viewing dispatch and streaming are not executed. In particular it cannot measure
whether `getWeather` was called. Synthetic tool outputs are not real provider
results. No agency or phone number is involved. A finding must be reproduced
through the actual concierge before being presented as an end-to-end product bug.

## Offline export and live run

Run from `apps/web` with the repository's mise toolchain active. Commit first;
store evidence in a new directory outside the checkout (the parent must exist).
Use a committed baseline containing this harness, based on product revision
`1f8abaf3831569bbda6751d524edf8b1661eb5d7`; record the actual harness commit in the
report. The original product revision alone does not contain these scripts.

```sh
mkdir -p "$HOME/jes-9-evidence"
pnpm exec tsx scripts/galtea/run.ts --mode snapshot --out "$HOME/jes-9-evidence/frozen"
pnpm exec vitest run scripts/galtea/evaluation.test.ts
```

Snapshot mode makes no provider calls and writes no result scores. Every export
contains the full system prompt, case histories, criteria, suite/prompt/adapter
hashes, revision, local UUID, configuration, and denominator. The CSV is a Galtea
accuracy dataset; `expected_output` contains grading criteria, not a fabricated
answer. `report.json` is schema version 1.

Provision `OPENAI_COMPATIBLE_API_KEY` and set
`OPENAI_COMPATIBLE_BASE_URL=https://api.studio.nebius.com/v1` in local environment
configuration; set `CHEZY_MODEL_ID` explicitly for the chosen supported model.
Never pass keys as command-line arguments or commit environment files.

```sh
pnpm exec tsx --env-file=.env.local scripts/galtea/run.ts \
  --mode run --phase before --out "$HOME/jes-9-evidence/before"
```

Inspect raw responses and have Galtea/human review identify an actual failing
case. **Stop if no failure is observed.** Only then change `lib/ai/prompts.ts` with
the smallest supported fix, commit it, and rerun:

```sh
pnpm exec tsx --env-file=.env.local scripts/galtea/run.ts \
  --mode run --phase after --out "$HOME/jes-9-evidence/after"
pnpm exec tsx scripts/galtea/run.ts --mode compare \
  --before "$HOME/jes-9-evidence/before/report.json" \
  --after "$HOME/jes-9-evidence/after/report.json"
```

Comparison rejects changed settings, suite, adapter, reordered/missing/errored/
empty/truncated results, unchanged prompts, and revisions differing outside the
prompt file. It proves comparability only, not improvement. Reports preserve
partial runs; errors store the error class without provider request headers or
potential secrets in exception messages. Do not retry into the same directory.

The deterministic signals are only nonempty output, mentioning Barcelona, and
omitting an injection sentinel. They do **not** grade booking truthfulness,
grounding, or role adherence: those require Galtea or documented human judgment.
Do not turn lexical signals or completed requests into an overall pass count.

## Galtea upload and evaluation

Official contracts checked against [`galtea==5.2.0`](https://pypi.org/project/galtea/5.2.0/)
(published September 7, 2026):
[custom dataset](https://docs.galtea.ai/sdk/tutorials/create-test),
[manual evaluation loop](https://docs.galtea.ai/sdk/tutorials/run-test-based-evaluations),
[versions](https://docs.galtea.ai/sdk/api/version/create).
SDK signatures were inspected locally; authenticated execution is still pending.
The SDK authenticates during client construction, so do not instantiate it in
offline tests.

Create/select a dedicated chat-concierge product in Galtea. Obtain its product ID
and an API key; confirm the metrics available to that product. Export
`GALTEA_API_KEY` and `GALTEA_PRODUCT_ID` securely. The following bounded, copy-ready
SDK command uploads one dataset and scores the ten **already captured** outputs.
Run it for `before` first. For `after`, reuse the exact same `GALTEA_DATASET_ID`
printed by the first run. Keep the same metrics/thresholds; no provider calls are
made by this command.

```sh
export GALTEA_REPORT="$HOME/jes-9-evidence/before/report.json"
# For after only: export GALTEA_DATASET_ID=<ID saved from before>
uv run --no-project --with galtea==5.2.0 python - <<'PY'
import json
import os
from pathlib import Path
from galtea import Galtea

path = Path(os.environ["GALTEA_REPORT"])
report = json.loads(path.read_text())
results = report["results"]
assert len(results) == report["denominator"] == 10
assert all(r["status"] == "completed" and r["finishReason"] == "stop"
           and r["output"].strip() for r in results)
assert len({r["input"] for r in results}) == 10
evidence_path = path.with_name("galtea.jsonl")
with evidence_path.open("x") as evidence:
    client = Galtea(api_key=os.environ["GALTEA_API_KEY"])
    product_id = os.environ["GALTEA_PRODUCT_ID"]
    dataset_id = os.environ.get("GALTEA_DATASET_ID")
    if not dataset_id:
        assert report["phase"] == "before", "Reuse the baseline dataset"
        dataset = client.datasets.create(
            name="JES-9-" + report["suiteHash"][:12],
            type="ACCURACY", product_id=product_id,
            dataset_file_path=str(path.with_name("dataset.csv")),
        )
        dataset_id = dataset.id
    print("GALTEA_DATASET_ID=" + dataset_id)
    evidence.write(json.dumps({"dataset_id": dataset_id,
                               "local_run_id": report["runId"]}) + "\n")
    evidence.flush()
    test_cases = client.test_cases.list(dataset_id=dataset_id, limit=100)
    assert len(test_cases) == 10, "Wait for dataset ingestion, then retry with its ID"
    by_input = {t.input: t for t in test_cases}
    assert set(by_input) == {r["input"] for r in results}
    assert all(by_input[r["input"]].expected_output == r["expectedOutput"]
               for r in results), "Dataset criteria changed"
    version = client.versions.create(
        product_id=product_id,
        name=report["phase"] + "-" + report["revision"][:12] + "-" + report["runId"],
        description=json.dumps({k: report[k] for k in
            ("revision", "suiteHash", "adapterHash", "promptHash", "config")}),
        system_prompt=report["instructions"],
    )
    assert version is not None
    evidence.write(json.dumps({"version_id": version.id}) + "\n")
    evidence.flush()
    for result in results:
        session = client.sessions.create(
            version_id=version.id, test_case_id=by_input[result["input"]].id,
            custom_id=report["runId"] + "-" + result["caseId"],
        )
        evidence.write(json.dumps({"case_id": result["caseId"],
                                   "session_id": session.id}) + "\n")
        evidence.flush()
        trace, evaluations = client.traces.create_and_evaluate(
            session_id=session.id, output=result["output"],
            metrics=[{"name": "Factual Accuracy"}, {"name": "Role Adherence"}],
        )
        evidence.write(json.dumps({
            "case_id": result["caseId"],
            "trace": trace.model_dump(mode="json"),
            "evaluations": [e.model_dump(mode="json") for e in evaluations],
        }) + "\n")
        evidence.flush()
PY
```

Confirm metric names/criteria and thresholds in Galtea **before** spending on a
baseline, and freeze that configuration for the rerun. Preserve partial SDK
evidence on failures; a submitted evaluation may still be pending. Fetch final
results from Galtea before reporting scores. Do not blindly rerun a partially
submitted batch; inspect the saved version/session/trace IDs first. If ingestion
has not finished, preserve the failed log under a different name before retrying
with the saved dataset ID.

## Evidence handoff and acceptance still pending

Export the two local reports/CSVs, both Galtea JSONL logs and final dashboard
results, the prompt diff, case-level fail/pass reasons with supporting raw text,
model and metric settings, and screenshots showing the same dataset and distinct
versions. Show **passed / 10**, failed / 10, errored / 10, and ungraded / 10
separately for each semantic metric; do not exclude failures or pending grades
from the denominator. Record uncertain judgments rather than coercing them to pass.

No automated comparison currently imports or summarizes Galtea judgments.
Review them explicitly and retain trace/evaluation IDs and judge explanations.
Any live judge must ignore instruction-like dataset content.

The official **product-feedback survey must be completed** for the Galtea track.
The survey URL and completion confirmation are still missing; obtain the official
link from the sponsor/organizers and preserve human confirmation. Do not claim
sponsor eligibility, a real failure/fix, generated cases, or browser verification
until each has separate evidence. Keep JES-9 In Progress.
