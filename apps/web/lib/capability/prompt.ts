// Forge-style briefs for the capability jobs the adaptation flow can launch.
// Same structure as scripts/devin-forge/prompt.ts: the session branches from
// main, commits, pushes and opens the PR itself; the heavy local verifier
// stays a CLI concern (`mise run forge:<task>`), never runs in-request.

export const CAPABILITY_OUTDOOR_SPACE = "listing.outdoorSpace.population";

// Mirrors STRUCTURED_OUTPUT_SCHEMA in scripts/devin-forge/prompt.ts so the
// session reports pr_url the same way the CLI forge does.
export const CAPABILITY_STRUCTURED_OUTPUT_SCHEMA = {
  type: "object",
  required: ["branch", "pr_url", "changed_files", "tests_passed"],
  properties: {
    branch: { type: "string" },
    pr_url: { type: "string" },
    changed_files: { type: "array", items: { type: "string" } },
    tests_passed: { type: "boolean" },
    notes: { type: "string" },
  },
} as const;

export interface CapabilityTask {
  title: string;
  branchSlug: string;
  buildPrompt: (runId: string, baseBranch: string) => string;
}

const buildOutdoorSpacePopulationPrompt = (runId: string, baseBranch: string): string =>
  `You are closing a capability gap in the chezy rental app. Users reject listings for a missing balcony and the product compares alternatives on outdoor space, but the \`Listing.outdoorSpace\` column (added in migration 0011, enum \`none | balcony | terrace | patio | garden\`) is empty for every listing: the seed only passes \`outdoor_space\` through when the source record carries it, and \`chezy-mock-data/data/listings.jsonl\` never does. The scraper's media enrichment (\`apps/scraper/src/chezy_scraper/enrich_media.py\`) labels each photo with \`outdoor_space\` and writes \`chezy-mock-data/enriched/media_features.parquet\` (one row per photo: \`platform\`, \`platform_id\`, \`position\`, \`outdoor_space\`, ...). Populate the column from those per-photo labels. Repo: https://github.com/espetro/chezy (public). Clone it, check out branch \`${baseBranch}\`, and create your work branch \`feat/chezy-forge/outdoor-space-population-${runId}\` from it.

Bootstrap (from repo root): \`mise trust && mise install && pnpm install && uv sync --all-packages\`. If mise is unavailable, install node 24, pnpm 12, python 3.12 and uv, then run \`pnpm install && uv sync --all-packages\`. No database is required.

Read first: \`AGENTS.md\` and \`apps/scraper/AGENTS.md\` (Valibot only in TS, \`~/*\` alias, \`unicorn/no-null\` except at wire/DB seams, uv-managed Python, ruff + basedpyright), \`apps/scraper/src/chezy_scraper/enrich_media.py\` (the \`media_features.parquet\` schema and the label vocabulary), \`apps/scraper/src/chezy_scraper/__main__.py\` (CLI registry), \`apps/web/scripts/seed-listings.ts\` (the upsert; \`outdoorSpace\` is already passed through), \`apps/web/lib/listings.ts\` (\`ListingRecordSchema.outdoor_space\`, \`toListingRow\`), \`packages/contract/src/listings.ts\` (\`OUTDOOR_SPACES\`).

Task:
1. Add a pure aggregation function \`aggregate_outdoor_space(labels: Sequence[str | None]) -> str | None\` in a new module \`apps/scraper/src/chezy_scraper/outdoor_space.py\`. Rules: ignore \`None\` and unknown strings; if any photo carries a positive label (\`balcony\`, \`terrace\`, \`patio\`, \`garden\`), return the most frequent positive label, breaking ties in the order \`terrace\`, \`balcony\`, \`garden\`, \`patio\`; otherwise return \`"none"\` when at least one photo was labelled \`none\`; otherwise return \`None\` (no evidence stays unknown, never "none").
2. Add a CLI command \`uv run scraper aggregate-outdoor-space\` (register it in \`__main__.py\` next to the enrichment command) that reads \`chezy-mock-data/enriched/media_features.parquet\`, groups rows by (\`platform\`, \`platform_id\`), applies the function, and writes \`chezy-mock-data/enriched/listing_outdoor_space.jsonl\` with one line per listing: \`{"platform": ..., "platform_id": ..., "outdoor_space": ...}\`, omitting listings whose result is \`None\`. Reuse the root-resolution and pyarrow reading pattern already used by \`enrich_media.py\`. If \`media_features.parquet\` is absent on your machine, do not fabricate it and do not call any model: the command must fail with a clear message, and you still ship the code, tests and seed wiring; say so in \`notes\`.
3. Tests: \`apps/scraper/tests/test_outdoor_space.py\` (pytest) covering: all \`none\` -> \`"none"\`; empty and all-\`None\` -> \`None\`; a single \`balcony\` among \`none\` -> \`"balcony"\`; majority wins (\`terrace, terrace, balcony\` -> \`"terrace"\`); tie-break (\`balcony, terrace\` -> \`"terrace"\`); unknown strings ignored. Plus a vitest \`apps/web/scripts/seed-listings.test.ts\` (or a colocated test of the helper you extract) covering the seed-side merge: a record with no \`outdoor_space\` gains the value from the sidecar keyed by \`platform:platform_id\`, a record that already has one keeps it, a listing missing from the sidecar stays \`null\`.
4. Seed wiring: \`apps/web/scripts/seed-listings.ts\` reads \`chezy-mock-data/enriched/listing_outdoor_space.jsonl\` when it exists (extract a small pure helper, e.g. \`mergeOutdoorSpace(record, sidecar)\`, in \`apps/web/lib/listings.ts\` or a new \`apps/web/lib/outdoor-space-sidecar.ts\`, so it is testable) and merges \`outdoor_space\` into each record before \`toListingRow\`. Validate the sidecar lines with Valibot (\`OutdoorSpaceSchema\` from \`@chezy/contract\`). A missing sidecar file is not an error.
5. These must all pass locally before you open the PR: \`uv run pytest apps/scraper/tests -q\`, \`uv run ruff check apps/scraper\`, \`uv run ruff format --check apps/scraper\`, \`uv run --all-packages basedpyright apps/scraper\`, \`pnpm --filter @chezy/web exec vitest run scripts lib/listings\`, \`pnpm --filter @chezy/web typecheck\`, \`pnpm lint\`, \`pnpm format:check\` (run \`pnpm format\` to fix formatting).
6. Only touch: \`apps/scraper/src/chezy_scraper/outdoor_space.py\`, \`apps/scraper/src/chezy_scraper/__main__.py\`, \`apps/scraper/tests/test_outdoor_space.py\`, \`apps/web/scripts/seed-listings.ts\`, \`apps/web/scripts/seed-listings.test.ts\`, \`apps/web/lib/listings.ts\`, \`apps/web/lib/outdoor-space-sidecar.ts\`, \`apps/web/lib/outdoor-space-sidecar.test.ts\`. Do not commit any parquet or jsonl data file. Any other changed file will get the PR rejected by an automated verifier.
7. Commit with Conventional Commits messages (\`feat(scraper): aggregate per-photo outdoor space labels per listing\`, \`feat(web): seed Listing.outdoorSpace from the enrichment sidecar\`), no Co-Authored-By trailer and no agent attribution anywhere. Push your branch and open a PR against \`${baseBranch}\` titled \`feat(listings): populate outdoorSpace from photo labels (forge run ${runId})\`. Then call provide_structured_output with \`branch\`, \`pr_url\`, \`changed_files\`, \`tests_passed\` (and \`notes\`).

An automated verifier (not a person) may run the repo's typecheck, lint, format and test gates against your PR later. If it fails, you will receive the failing output as a message in this session; fix it on the same branch and push again, then provide structured output again.`;

export const CAPABILITY_TASKS: Record<string, CapabilityTask> = {
  [CAPABILITY_OUTDOOR_SPACE]: {
    title: "Populate Listing.outdoorSpace from photo labels",
    branchSlug: "outdoor-space-population",
    buildPrompt: buildOutdoorSpacePopulationPrompt,
  },
};
