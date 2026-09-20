import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { generateText } from "ai";
import * as v from "valibot";
import { systemPrompt } from "~/lib/ai/prompts";
import { getLanguageModel } from "~/lib/ai/providers";
import { DEFAULT_CHAT_MODEL_ID, isTestEnvironment } from "~/lib/constants";
import { env } from "~/lib/env";
import { cases } from "./cases";
import {
  assertComparable,
  datasetCsv,
  datasetInput,
  hash,
  RunSchema,
  signals,
  suiteHash,
} from "./evaluation";

const { values } = parseArgs({
  options: {
    mode: { type: "string", default: "snapshot" },
    phase: { type: "string", default: "before" },
    out: { type: "string" },
    before: { type: "string" },
    after: { type: "string" },
  },
});
const mode = v.parse(v.picklist(["snapshot", "run", "compare"]), values.mode);
const phase = v.parse(v.picklist(["before", "after"]), values.phase);
const root = path.resolve(import.meta.dirname, "../../../..");
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

if (mode === "compare") {
  if (!values.before || !values.after) throw new Error("Supply --before and --after report paths.");
  const before = v.parse(RunSchema, JSON.parse(readFileSync(values.before, "utf8")));
  const after = v.parse(RunSchema, JSON.parse(readFileSync(values.after, "utf8")));
  assertComparable(before, after);
  const changed = git("diff", "--name-only", before.revision, after.revision).split("\n");
  if (changed.length !== 1 || changed[0] !== "apps/web/lib/ai/prompts.ts") {
    throw new Error("Before/after revisions must differ only in apps/web/lib/ai/prompts.ts.");
  }
  console.log(
    JSON.stringify(
      {
        comparable: true,
        denominator: cases.length,
        beforeRunId: before.runId,
        afterRunId: after.runId,
        grading: "pending Galtea or human review; comparability is not a passing score",
      },
      undefined,
      2,
    ),
  );
} else {
  if (!values.out)
    throw new Error("Supply --out pointing to a new evidence directory outside the repo.");
  const out = path.resolve(values.out);
  if (out === root || out.startsWith(`${root}${path.sep}`)) {
    throw new Error("Evidence must be stored outside the repository.");
  }
  if (git("status", "--porcelain")) throw new Error("Commit changes before freezing evidence.");
  const config = {
    target: "concierge-text-synthesis-with-fixture-history",
    baseURL: "https://api.studio.nebius.com/v1",
    model: env.CHEZY_MODEL_ID ?? DEFAULT_CHAT_MODEL_ID,
    temperature: 0,
    maxOutputTokens: 700,
    supportsToolsPrompt: true,
    executableTools: false,
    memory: "none",
  } as const;
  if (
    mode === "run" &&
    (!env.OPENAI_COMPATIBLE_API_KEY?.trim() ||
      env.OPENAI_COMPATIBLE_BASE_URL?.replace(/\/$/, "") !== config.baseURL ||
      isTestEnvironment)
  ) {
    throw new Error(
      "Live run requires a Nebius API key, the explicit Nebius base URL, and no Playwright mock flags.",
    );
  }
  const instructions = systemPrompt({
    requestHints: { city: "Barcelona", country: "ES", latitude: "41.39", longitude: "2.17" },
    supportsTools: true,
  });
  const report = {
    schemaVersion: 1,
    phase,
    runId: randomUUID(),
    revision: git("rev-parse", "HEAD"),
    suiteHash: suiteHash(),
    adapterHash: hash(
      ["run.ts", "evaluation.ts"]
        .map((file) => readFileSync(path.join(import.meta.dirname, file), "utf8"))
        .join("\n"),
    ),
    promptHash: hash(instructions),
    config,
    startedAt: new Date().toISOString(),
    provenance: "manually authored synthetic fixtures; NOT Galtea-generated",
    liveEvaluation: mode === "run" ? "attempted" : "unexecuted",
    grading: "ungraded; deterministic signals are not semantic pass/fail",
    galtea: "not submitted",
    survey: "pending official survey URL and human feedback confirmation",
    denominator: cases.length,
    instructions,
    cases,
    results: [] as Array<{
      caseId: string;
      input: string;
      expectedOutput: string;
      status: "completed" | "error";
      output: string;
      finishReason: string;
      responseId?: string;
      errorName?: string;
      usage?: unknown;
      signals?: ReturnType<typeof signals>;
    }>,
  };
  mkdirSync(out, { recursive: false });
  const save = () =>
    writeFileSync(path.join(out, "report.json"), JSON.stringify(report, undefined, 2));
  writeFileSync(path.join(out, "dataset.csv"), datasetCsv(), { flag: "wx" });
  save();
  if (mode === "run") {
    for (const testCase of cases) {
      const result = {
        caseId: testCase.id,
        input: datasetInput(testCase),
        expectedOutput: testCase.expectedOutput,
      };
      try {
        const response = await generateText({
          model: getLanguageModel(config.model),
          instructions,
          messages: testCase.messages,
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(60_000),
        });
        report.results.push({
          ...result,
          status: "completed",
          output: response.text,
          finishReason: response.finishReason,
          responseId: response.response.id,
          usage: response.usage,
          signals: signals(testCase.id, response.text),
        });
      } catch (error) {
        report.results.push({
          ...result,
          status: "error",
          output: "",
          finishReason: "error",
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
      }
      save();
    }
    const complete = report.results.filter(
      (result) =>
        result.status === "completed" && result.finishReason === "stop" && result.output.trim(),
    ).length;
    console.log(`Completed ${complete}/${cases.length}; semantic grades pending.`);
    if (complete !== cases.length) process.exitCode = 1;
  } else {
    console.log(`Frozen ${cases.length} cases; live evaluation unexecuted.`);
  }
}
