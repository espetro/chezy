import { buildDetailPrompt, buildOutdoorSpacePrompt, buildPrompt } from "./prompt.ts";

export interface ForgeTask {
  // Which gate set verify.ts runs; defaults to the scraper's Python gates.
  gates?: "python" | "web";
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

const OUTDOOR_FORBIDDEN = [
  "apps/web/lib/adaptation/outdoor-space.test.ts",
  "apps/web/lib/adaptation/outdoor-space.holdout.test.ts",
];

// Capability gap found by the product: users reject listings for a missing
// balcony, the media enrichment already labels outdoor space from photos, but
// the Listing table has no column for it and the panel shows "Not listed".
TASKS["outdoor-space"] = {
  gates: "web",
  visibleTests: [
    "apps/web/lib/adaptation/outdoor-space.test.ts",
    "apps/web/lib/adaptation/outdoor-space.holdout.test.ts",
  ],
  holdoutDir: "/tmp/chezy-forge/holdout-outdoor-space",
  holdoutFiles: [
    {
      src: "scripts/devin-forge/standards/outdoor-space.test.ts",
      dest: "apps/web/lib/adaptation/outdoor-space.test.ts",
    },
    {
      src: "outdoor-space.holdout.test.ts",
      dest: "apps/web/lib/adaptation/outdoor-space.holdout.test.ts",
    },
  ],
  allowlist: [
    "apps/web/lib/db/schema.ts",
    "apps/web/lib/listings.ts",
    "apps/web/lib/adaptation/facts.ts",
    "apps/web/lib/adaptation/types.ts",
    "apps/web/lib/adaptation/prompt.ts",
    "apps/web/lib/adaptation/resolve.ts",
    "apps/web/lib/adaptation/resolve.test.ts",
    "apps/web/lib/adaptation/prompt.test.ts",
    "apps/web/lib/devin/client.ts",
    "apps/web/scripts/seed-listings.ts",
  ],
  allowlistPrefixes: ["apps/web/lib/db/migrations/", "packages/contract/src/"],
  forbidden: OUTDOOR_FORBIDDEN,
  buildPrompt: buildOutdoorSpacePrompt,
  branchSlug: "outdoor-space",
  feedbackHint:
    "The column is nullable and absence stays unknown: only a photo label of balcony or terrace counts as outdoor space, never the lack of one. Generate the migration with drizzle-kit, do not hand-write it.",
};

TASKS["pisos"] = TASKS["list"] as ForgeTask;
