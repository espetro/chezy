import { buildDetailPrompt, buildPrompt } from "./prompt.ts";

export interface ForgeTask {
  visibleTests: string[];
  holdoutFiles: { src: string; dest: string }[];
  holdoutDir: string;
  allowlist: string[];
  allowlistPrefixes: string[];
  forbidden: string[];
  buildPrompt: (runId: string, baseBranch: string) => string;
  branchSlug: string;
  feedbackHint: string;
}

const LIST_FORBIDDEN = [
  "apps/scraper/tests/test_pisos.py",
  "apps/scraper/tests/test_pisos_holdout.py",
  "apps/scraper/tests/fixtures/pisos_rent.html",
  "apps/scraper/tests/fixtures/pisos_rent.golden.json",
  "apps/scraper/tests/fixtures/pisos_sale.html",
  "apps/scraper/tests/fixtures/pisos_sale.golden.json",
];

const DETAIL_FORBIDDEN = [
  "apps/scraper/tests/test_pisos_detail.py",
  "apps/scraper/tests/test_pisos_detail_holdout.py",
  "apps/scraper/tests/test_pisos_detail_holdout2.py",
  "apps/scraper/tests/fixtures/pisos_detail_bare_rows.html",
  "apps/scraper/tests/fixtures/pisos_detail_bare_rows.golden.json",
  "apps/scraper/tests/fixtures/pisos_detail_rent.html",
  "apps/scraper/tests/fixtures/pisos_detail_rent.golden.json",
  "apps/scraper/tests/fixtures/pisos_detail_sale.html",
  "apps/scraper/tests/fixtures/pisos_detail_sale.golden.json",
];

export const TASKS: Record<string, ForgeTask> = {
  list: {
    visibleTests: ["apps/scraper/tests/test_pisos.py", "apps/scraper/tests/test_pisos_holdout.py"],
    holdoutDir: "/tmp/chezy-forge/holdout",
    holdoutFiles: [
      {
        src: "pisos_sale.html",
        dest: "apps/scraper/tests/fixtures/pisos_sale.html",
      },
      {
        src: "pisos_sale.golden.json",
        dest: "apps/scraper/tests/fixtures/pisos_sale.golden.json",
      },
      {
        src: "test_pisos_holdout.py",
        dest: "apps/scraper/tests/test_pisos_holdout.py",
      },
    ],
    allowlist: [
      "apps/scraper/src/chezy_scraper/adapters/pisos.py",
      "apps/scraper/src/chezy_scraper/models.py",
      "apps/scraper/src/chezy_scraper/__main__.py",
      "apps/scraper/src/chezy_scraper/sinks/postgres.py",
    ],
    allowlistPrefixes: ["packages/contract/src/"],
    forbidden: LIST_FORBIDDEN,
    buildPrompt,
    branchSlug: "pisos-adapter",
    feedbackHint:
      "The adapter must parse both rent and sale pages generally (sale listings link under a different path and carry a total price, not a monthly one).",
  },
  detail: {
    visibleTests: [
      "apps/scraper/tests/test_pisos_detail.py",
      "apps/scraper/tests/test_pisos_detail_holdout.py",
      "apps/scraper/tests/test_pisos_detail_holdout2.py",
    ],
    holdoutDir: "/tmp/chezy-forge/holdout-detail",
    holdoutFiles: [
      {
        src: "pisos_detail_sale.html",
        dest: "apps/scraper/tests/fixtures/pisos_detail_sale.html",
      },
      {
        src: "pisos_detail_sale.golden.json",
        dest: "apps/scraper/tests/fixtures/pisos_detail_sale.golden.json",
      },
      {
        src: "test_pisos_detail_holdout.py",
        dest: "apps/scraper/tests/test_pisos_detail_holdout.py",
      },
      {
        src: "pisos_detail_bare_rows.html",
        dest: "apps/scraper/tests/fixtures/pisos_detail_bare_rows.html",
      },
      {
        src: "pisos_detail_bare_rows.golden.json",
        dest: "apps/scraper/tests/fixtures/pisos_detail_bare_rows.golden.json",
      },
      {
        src: "test_pisos_detail_holdout2.py",
        dest: "apps/scraper/tests/test_pisos_detail_holdout2.py",
      },
    ],
    allowlist: [
      "apps/scraper/src/chezy_scraper/adapters/pisos.py",
      "apps/scraper/src/chezy_scraper/adapters/base.py",
      "apps/scraper/src/chezy_scraper/models.py",
      "apps/scraper/src/chezy_scraper/__main__.py",
    ],
    allowlistPrefixes: [],
    forbidden: [...DETAIL_FORBIDDEN, ...LIST_FORBIDDEN],
    buildPrompt: buildDetailPrompt,
    branchSlug: "pisos-detail",
    feedbackHint:
      "The parser must handle both rent and sale detail pages generally (a sale page has a total price with no /mes, may lack rows such as Planta, and its phone number may carry the 34 country prefix).",
  },
};

TASKS["pisos"] = TASKS["list"] as ForgeTask;
