export const STRUCTURED_OUTPUT_SCHEMA = {
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

export function buildDetailPrompt(runId: string, baseBranch: string): string {
  return `You are extending the pisos.com adapter in the chezy scraper with a detail-page parser. Repo: https://github.com/espetro/chezy (public). Clone it, check out branch \`${baseBranch}\`, and create your work branch \`feat/chezy-forge/pisos-detail-${runId}\` from it.

Bootstrap (from repo root): \`mise trust && mise install && pnpm install && uv sync --all-packages\`. If mise is unavailable, install python 3.12 + uv and run \`uv sync --all-packages\`; the Python side is all you need.

Read first: \`apps/scraper/AGENTS.md\`, \`apps/scraper/src/chezy_scraper/adapters/pisos.py\` (the existing search-page adapter; reuse its helpers), \`apps/scraper/src/chezy_scraper/adapters/idealista.py\` (the only adapter with a detail parser today), \`apps/scraper/src/chezy_scraper/models.py\` (\`Listing\`, \`Media\`, \`Publisher\`).

The standard you must meet is \`apps/scraper/tests/test_pisos_detail.py\` with the captured page \`apps/scraper/tests/fixtures/pisos_detail_rent.html\` and golden values \`apps/scraper/tests/fixtures/pisos_detail_rent.golden.json\`. Do not edit the test, the fixture or the golden file.

Task:
1. Add \`PisosAdapter.parse_detail(self, html: str, *, operation: Operation, scraped_at: datetime) -> Listing\` in \`adapters/pisos.py\`. It parses one pisos.com listing detail page (no network calls).
2. Populate every \`Listing\` field the page carries: identity (the \`id\` and \`data-lnk-href\` on the \`details js-contactInfo\` block; URLs must be absolute \`https://www.pisos.com/...\`), title (h1), price and period, property type, the Características block (built and usable m2, rooms, bathrooms; every "Label: value" row kept verbatim in \`raw_features\` keyed by its label, e.g. \`raw_features["Planta"] == "2ª"\`, \`raw_features["Referencia"]\`, \`raw_features["Antigüedad"]\`, \`raw_features["Calefacción"]\`; single-word rows such as "Amueblado", "Ascensor", "Terraza", "Exterior" go into \`raw_features\` as \`True\` and "Amueblado" also sets \`furnished=True\`), the energy certificate (consumption and emissions letter, upper-cased, plus their numeric values), location (neighbourhood and district from the subtitle under the h1, municipality "Barcelona", lat/lon from the page's coordinates), the publisher (agency name, kind \`professional\` when it is an agency, phone from the contact button's \`data-number\`), media (one \`Media\` per photo, full-size URL, deduplicated across the size variants the page repeats, in page order), and \`description\` (the Spanish text only; strip the "Traducciones disponibles" language switcher). Keep the raw page data you extracted in \`source_raw\`.
3. Parse generally: the same method will run against live detail pages for BOTH operations (\`rent\` and \`sale\`) and other listings. Do not special-case any platform_id, reference or text from the fixture.
4. These must all pass locally before you open the PR: \`uv run pytest apps/scraper/tests/test_pisos_detail.py -q\`, \`uv run pytest apps/scraper/tests -q\`, \`uv run ruff check apps/scraper\`, \`uv run ruff format --check apps/scraper\`, \`uv run --all-packages basedpyright apps/scraper\`.
5. Only touch: \`apps/scraper/src/chezy_scraper/adapters/pisos.py\`, and only if strictly needed \`apps/scraper/src/chezy_scraper/adapters/base.py\`, \`apps/scraper/src/chezy_scraper/models.py\`, \`apps/scraper/src/chezy_scraper/__main__.py\`. Any other changed file will get the PR rejected by an automated verifier.
6. Commit with a Conventional Commits message (\`feat(scraper): pisos.com detail-page parser\`), no Co-Authored-By trailer. Push your branch and open a PR against \`${baseBranch}\` titled \`feat(scraper): pisos.com detail parser (forge run ${runId})\`. Then call provide_structured_output with \`branch\`, \`pr_url\`, \`changed_files\`, \`tests_passed\`.

An automated verifier (not a person) will run the standard plus extra checks against your PR. If it fails, you will receive the failing output as a message in this session; fix it on the same branch and push again, then provide structured output again.`;
}

export function buildPrompt(runId: string, baseBranch: string): string {
  return `You are adding a pisos.com adapter to the chezy scraper. Repo: https://github.com/espetro/chezy (public). Clone it, check out branch \`${baseBranch}\`, and create your work branch \`feat/chezy-forge/pisos-adapter-${runId}\` from it.

Bootstrap (from repo root): \`mise trust && mise install && pnpm install && uv sync --all-packages\`. If mise is unavailable, install python 3.12 + uv and run \`uv sync --all-packages\`; the Python side is all you need.

Read first: \`AGENTS.md\`, \`apps/scraper/AGENTS.md\`, \`apps/scraper/src/chezy_scraper/adapters/base.py\` (the \`Adapter\` protocol and \`SearchPage\`), \`apps/scraper/src/chezy_scraper/adapters/milanuncios.py\` and \`fotocasa.py\` (existing adapters), \`apps/scraper/src/chezy_scraper/models.py\` (\`Listing\`, \`Platform\`), \`apps/scraper/src/chezy_scraper/__main__.py\` (adapter registry).

The standard you must meet is \`apps/scraper/tests/test_pisos.py\` with the captured page \`apps/scraper/tests/fixtures/pisos_rent.html\` and golden values \`apps/scraper/tests/fixtures/pisos_rent.golden.json\`. Do not edit the test, the fixture or the golden file.

Task:
1. Create \`apps/scraper/src/chezy_scraper/adapters/pisos.py\` with \`class PisosAdapter\` implementing the \`Adapter\` protocol: \`platform = "pisos"\`, \`search_url(operation, page)\`, \`parse_list(html, *, operation, scraped_at) -> SearchPage\`.
2. Add \`"pisos"\` to the \`Platform\` Literal in \`models.py\` and wherever else that literal is mirrored (grep for \`"milanuncios"\` across \`apps/scraper\` and \`packages/contract\`; basedpyright will tell you if you miss one).
3. Register the adapter in \`__main__.py\` (\`_ADAPTERS\` and \`_BUNDLE_PLATFORMS\`).
4. pisos.com search pages carry one \`div.ad-preview[id][data-lnk-href]\` per listing plus one \`<script type="application/ld+json">\` \`SingleFamilyResidence\` block per listing (same \`@id\`). Parse generally: the adapter will run against live pages for BOTH operations (\`rent\` and \`sale\`) and other result pages, not only this fixture. Populate every \`Listing\` field the page carries (price, period, rooms, bathrooms, built m2, floor label kept verbatim in \`raw_features["floor"]\`, title, neighbourhood/district from the subtitle, municipality, lat/lon from the ld+json geo, first photo as media, the ld+json block as \`source_raw\`). Do not special-case any platform_id from the fixture. Absolute URLs. Keep the raw payload for \`SearchPage.payload\`. Follow the polite-HTTP rules in \`apps/scraper/AGENTS.md\` for \`search_url\` only; no network calls in \`parse_list\`.
5. These must all pass locally before you open the PR: \`uv run pytest apps/scraper/tests/test_pisos.py -q\`, \`uv run ruff check apps/scraper\`, \`uv run ruff format --check apps/scraper\`, \`uv run --all-packages basedpyright apps/scraper\`.
6. Only touch: \`apps/scraper/src/chezy_scraper/adapters/pisos.py\`, \`apps/scraper/src/chezy_scraper/models.py\`, \`apps/scraper/src/chezy_scraper/__main__.py\`, \`apps/scraper/src/chezy_scraper/sinks/postgres.py\`, files under \`packages/contract/src/\`. Any other changed file will get the PR rejected by an automated verifier.
7. Commit with a Conventional Commits message (\`feat(scraper): pisos.com adapter\`), no Co-Authored-By trailer. Push your branch and open a PR against \`${baseBranch}\` titled \`feat(scraper): pisos.com adapter (forge run ${runId})\`. Then call provide_structured_output with \`branch\`, \`pr_url\`, \`changed_files\`, \`tests_passed\`.

An automated verifier (not a person) will run the standard plus extra checks against your PR. If it fails, you will receive the failing output as a message in this session; fix it on the same branch and push again, then provide structured output again.`;
}

export function buildOutdoorSpacePrompt(runId: string, baseBranch: string): string {
  return `You are closing a capability gap in the chezy rental app. Users reject listings for a missing balcony, and the product asks Devin to compare alternatives, but the \`Listing\` table has no field for outdoor space: the comparison panel shows "Not listed" even when the photos show a balcony. The scraper's media enrichment step (\`apps/scraper/src/chezy_scraper/enrich_media.py\`) already labels each photo with \`outdoor_space\` in \`none | balcony | terrace | patio | garden\`. Bring that label into the web app. Repo: https://github.com/espetro/chezy (public). Clone it, check out branch \`${baseBranch}\`, and create your work branch \`feat/chezy-forge/outdoor-space-${runId}\` from it.

Bootstrap (from repo root): \`mise trust && mise install && pnpm install\`. If mise is unavailable, install node 24 and pnpm 12 and run \`pnpm install\`; the TypeScript side is all you need. No database is required: drizzle-kit generates the migration from the schema file alone.

Read first: \`AGENTS.md\` (Valibot only, \`~/*\` alias, \`unicorn/no-null\` except at wire/DB seams, camelCase column names on \`Listing\`), \`apps/web/lib/db/schema.ts\` (the \`listing\` table), \`apps/web/lib/listings.ts\` (\`ListingRecordSchema\`, \`toListingRow\`), \`apps/web/lib/adaptation/{types,facts,prompt,resolve}.ts\`, \`apps/web/scripts/seed-listings.ts\`, \`packages/contract/src/listings.ts\`.

The standard you must meet is \`scripts/devin-forge/standards/outdoor-space.test.ts\`. Copy it to \`apps/web/lib/adaptation/outdoor-space.test.ts\` to run it locally, but do NOT commit that copy and do not edit the standard: the verifier injects it at that path itself and refuses PRs that touch it.

Task:
1. \`packages/contract/src/listings.ts\`: export \`OUTDOOR_SPACES = ["none", "balcony", "terrace", "patio", "garden"] as const\`, \`OutdoorSpaceSchema = v.picklist(OUTDOOR_SPACES)\` and \`type OutdoorSpace\`. Add the optional nullable \`outdoor_space\` field to the wire \`ListingSchema\` there if one exists.
2. \`apps/web/lib/db/schema.ts\`: add a nullable column \`outdoorSpace: text("outdoorSpace").$type<OutdoorSpace>()\` to \`listing\` (same camelCase style as \`priceEur\`). Then run \`pnpm --filter @chezy/web db:generate\` to produce \`apps/web/lib/db/migrations/0011_*.sql\`, its \`meta/0011_snapshot.json\` and the \`_journal.json\` entry. Commit the generated files as they are; never hand-write the migration.
3. \`apps/web/lib/listings.ts\`: \`ListingRecordSchema\` gains \`outdoor_space: v.optional(v.nullable(OutdoorSpaceSchema))\`; \`toListingRow\` maps it to \`outdoorSpace\` (null when absent). \`apps/web/scripts/seed-listings.ts\` passes \`outdoorSpace\` through its upsert like the other columns.
4. \`apps/web/lib/adaptation/types.ts\`: \`CandidateFacts\` gains \`outdoorSpace: OutdoorSpace | null\`; \`sanitizeCandidate\` in \`prompt.ts\` copies it from the row (and nothing else new).
5. \`apps/web/lib/adaptation/facts.ts\`: \`hasOutdoorSpace\` is true when the amenities mention balcony or terrace (as today) OR \`outdoorSpace\` is \`balcony\` or \`terrace\`. \`none\` and \`null\` are both false: a photo label of none is still not a fact about the flat, and absence is unknown.
6. \`apps/web/lib/adaptation/resolve.ts\`: the \`balcony\` cell keeps "Balcony listed" / "Terrace listed" from amenities first; otherwise, when \`outdoorSpace\` is balcony, terrace, patio or garden, render \`"<Label> seen in photos"\` with the label capitalised (\`"Balcony seen in photos"\`, \`"Terrace seen in photos"\`, \`"Patio seen in photos"\`, \`"Garden seen in photos"\`); otherwise "Not listed" (including for \`none\`).
7. Update the existing tests that build \`Listing\` or \`CandidateFacts\` fixtures only where the new field makes them fail to typecheck (\`resolve.test.ts\`, \`prompt.test.ts\` are allowlisted for that).
8. These must all pass locally before you open the PR: \`pnpm --filter @chezy/web exec vitest run lib/adaptation\`, \`pnpm --filter @chezy/web typecheck\`, \`pnpm lint\`, \`pnpm format:check\` (run \`pnpm format\` to fix formatting).
9. Only touch: \`apps/web/lib/db/schema.ts\`, files under \`apps/web/lib/db/migrations/\`, \`apps/web/lib/listings.ts\`, \`apps/web/lib/adaptation/facts.ts\`, \`apps/web/lib/adaptation/types.ts\`, \`apps/web/lib/adaptation/prompt.ts\`, \`apps/web/lib/adaptation/resolve.ts\`, \`apps/web/lib/adaptation/resolve.test.ts\`, \`apps/web/lib/adaptation/prompt.test.ts\`, \`apps/web/lib/devin/client.ts\`, \`apps/web/scripts/seed-listings.ts\`, files under \`packages/contract/src/\`. Any other changed file will get the PR rejected by an automated verifier.
10. Commit with Conventional Commits messages (\`feat(db): outdoor space column on Listing\`, \`feat(adaptation): photo-derived outdoor space in the balcony comparison\`), no Co-Authored-By trailer. Push your branch and open a PR against \`${baseBranch}\` titled \`feat(listings): photo-derived outdoor space (forge run ${runId})\`. Then call provide_structured_output with \`branch\`, \`pr_url\`, \`changed_files\`, \`tests_passed\`.

An automated verifier (not a person) will run the standard plus a hidden hold-out and the repo's typecheck, lint and format gates against your PR. If it fails, you will receive the failing output as a message in this session; fix it on the same branch and push again, then provide structured output again.`;
}
