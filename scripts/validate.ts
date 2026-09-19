#!/usr/bin/env tsx
/**
 * Backpressure gate for the TS/JS workspace: typecheck + lint + format:check
 * + (full mode) vitest. Run via `mise run validate`.
 *
 * Self-skips before any toolchain step when no JS/TS-relevant files changed
 * vs origin/main, so Python-only worktrees/PRs don't pay the JS/TS cost.
 * Locally, when origin/main is unavailable this fails open (runs everything).
 * Under GitHub Actions a missing origin/main is instead a hard error: the
 * validate workflow sets fetch-depth: 0, so its absence means that
 * regressed, and silently running everything would mask it (and could later
 * degrade to a silent skip).
 *
 * `--quick` runs only typecheck + lint + format:check (no vitest). Mirrors
 * `mise run validate:quick`; the full gate still runs on every pre-push.
 *
 * Ported from `../brioso/scripts/validate.ts` (adapted for chezy's smaller
 * workspace shape — no turbo, just `pnpm -r`).
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

interface Step {
  readonly title: string;
  readonly cmd: string;
  readonly args: readonly string[];
}

const TS_PATHSPECS = [
  "*.ts",
  "*.tsx",
  "*.js",
  "*.jsx",
  "*.mjs",
  "*.cjs",
  "*.json",
  "*.css",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "package.json",
];

function changedFiles(): { files: string[] | null; base: string } {
  try {
    const rev = execFileSync("git", ["rev-parse", "--verify", "-q", "origin/main"], {
      cwd: REPO_ROOT,
    })
      .toString()
      .trim();
    if (!rev) return { files: null, base: "no origin/main" };
  } catch {
    return { files: null, base: "no origin/main" };
  }

  try {
    const diff = execFileSync(
      "git",
      ["diff", "--name-only", "origin/main...HEAD", "--", ...TS_PATHSPECS],
      { cwd: REPO_ROOT },
    ).toString();
    return {
      files: diff
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      base: "origin/main",
    };
  } catch {
    return { files: null, base: "git diff failed" };
  }
}

/**
 * Map a changed file path to the pnpm workspace package(s) it lives in.
 * Root-level files (scripts/, package.json, configs, docs) match "root" and
 * trigger the whole-workspace steps. App/package paths map to themselves.
 * Files outside any known workspace (vendor/, tests/e2e/) are skipped — they're
 * explicitly out of scope for the chezy lint/typecheck gate.
 */
function affectedPackages(files: readonly string[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const f of files) {
    if (f.startsWith("vendor/") || f.startsWith("apps/web/vendor/")) continue;
    if (f.startsWith("tests/e2e/")) continue;
    const m = /^(apps|packages)\/([^/]+)\//.exec(f);
    if (m) {
      out.add(`${m[1]}/${m[2]}`);
      continue;
    }
    // Root-level: scripts/, *.ts at root, root config files.
    out.add("root");
  }
  return out;
}

const { files: changed, base } = changedFiles();

if (changed === null) {
  if (process.env.GITHUB_ACTIONS === "true") {
    console.error(
      `FAIL ts: origin/main unavailable in CI (${base}) — the validate ` +
        "workflow sets fetch-depth: 0, so this means that regressed. Refusing to " +
        "silently run everything (which could later degrade to a silent skip).",
    );
    process.exit(1);
  }
  console.log(`ts: running all steps (${base})`);
} else if (changed.length === 0) {
  console.log(`SKIP ts: no javascript/typescript changes vs ${base}`);
  process.exit(0);
} else {
  const shown = changed.slice(0, 5).join(", ");
  const more = changed.length > 5 ? ` (+${changed.length - 5} more)` : "";
  console.log(`ts: ${changed.length} file(s) changed vs ${base}: ${shown}${more}`);
}

const quick = process.argv.includes("--quick");

// Scope each step to the packages that actually changed, so a PR that only
// touches apps/web/ does not pay the typecheck/lint cost of unrelated workspace
// packages (e.g. packages/observability where a half-finished LogTape v2
// migration sits on origin/main). Root-only changes (scripts/, pnpm-workspace.yaml,
// mise.toml) skip per-package steps because no workspace package source changed.
const affected = changed ? affectedPackages(changed) : new Set<string>(["root"]);
const packageOnly = [...affected].filter((p) => p !== "root");
const isRootOnly = packageOnly.length === 0;
const scopedPackages = isRootOnly ? [] : packageOnly;

const skippedNoScope = scopedPackages.length === 0;
if (skippedNoScope) {
  console.log(
    isRootOnly
      ? `ts: changes only in root-level paths (scripts/, configs); no workspace package source changed`
      : `ts: changes only in vendored/e2e-out-of-scope paths; no workspace package affected`,
  );
}

const appsWebOnly =
  !skippedNoScope && scopedPackages.length === 1 && scopedPackages[0] === "apps/web";
const scopedForFilter = appsWebOnly ? [] : scopedPackages.filter((p) => p !== "apps/web");
const filterArgs =
  skippedNoScope || scopedForFilter.length === 0 ? [] : ["-r", "--filter", ...scopedForFilter];
if (appsWebOnly) {
  console.log(
    "ts: only apps/web (verbatim template) changed; per-package steps skipped " +
      "because the template surface is intentionally out of the chezy gate " +
      "(see apps/web/AGENTS.md manual-review checklist).",
  );
}

const rootChanged = affected.has("root");

// Build a scoped format:check invocation: only the changed packages (and
// the root scripts/ when present). Running pnpm format:check from the root
// always scans the entire workspace, which means pre-existing format drift
// (packages/observability LogTape v2 migration, apps/web verbatim template
// which is intentionally not chezified) blocks unrelated PRs.
//
// apps/web is excluded entirely until the verbatim-template manual-review
// checklist in apps/web/AGENTS.md is applied. Until then, format drift in
// the template is expected and out of scope.
const formatGlobs: readonly string[] = (() => {
  if (skippedNoScope && !rootChanged) return [];
  const globs: string[] = [];
  if (rootChanged) globs.push("scripts/**/*.ts");
  for (const p of scopedForFilter) {
    if (p.startsWith("apps/")) {
      globs.push(`${p}/**/*.ts`, `${p}/**/*.tsx`, `${p}/*.ts`);
    } else {
      globs.push(`${p}/src/**/*.ts`, `${p}/src/**/*.tsx`, `${p}/*.ts`);
    }
  }
  return globs;
})();

const steps: readonly Step[] = (() => {
  const out: Step[] = [];
  if (scopedForFilter.length > 0) {
    out.push(
      { title: "typecheck", cmd: "pnpm", args: [...filterArgs, "typecheck"] },
      { title: "lint", cmd: "pnpm", args: [...filterArgs, "lint"] },
    );
    if (!quick) {
      out.push({ title: "test", cmd: "pnpm", args: [...filterArgs, "test"] });
    }
  }
  if (formatGlobs.length > 0) {
    out.push({
      title: "format:check",
      cmd: "pnpm",
      args: ["exec", "oxfmt", "--check", ...formatGlobs],
    });
  }
  if (rootChanged) {
    out.push({ title: "lint:scripts", cmd: "pnpm", args: ["exec", "oxlint", "scripts"] });
  }
  return out;
})();

interface StepResult {
  code: number;
  output: string;
}

function runStep(cmd: string, args: readonly string[]): Promise<StepResult> {
  return new Promise((resolveP) => {
    const child = spawn(cmd, [...args], {
      cwd: REPO_ROOT,
      shell: false,
      env: process.env,
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d.toString()));
    child.stderr.on("data", (d) => (output += d.toString()));
    child.on("close", (code) => resolveP({ code: code ?? 1, output }));
  });
}

const gateStart = Date.now();
const stepTimes = new Map<string, number>();
let failed = false;

for (const step of steps) {
  const start = Date.now();
  const { code, output } = await runStep(step.cmd, step.args);
  const secs = (Date.now() - start) / 1000;
  stepTimes.set(step.title, secs);
  if (code === 0) {
    console.log(`OK   ts: ${step.title} (${secs.toFixed(1)}s)`);
  } else {
    failed = true;
    console.log(`FAIL ts: ${step.title}`);
    console.log(`\n--- ts: ${step.title} output ---\n${output}\n`);
  }
}

const wallSecs = (Date.now() - gateStart) / 1000;
console.log(`total ${wallSecs.toFixed(1)}s`);

if (failed) process.exit(1);

// Local-only timing telemetry; never fails the gate. CI never writes here
// (the gate is non-flaky enough that telemetry is a dev-only signal).
if (process.env.GITHUB_ACTIONS !== "true") {
  try {
    const dir = `${process.env.HOME}/.local/share/chezy`;
    const file = `${dir}/gate-timings.json`;
    const entries = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as unknown[]) : [];
    entries.push({
      gate: quick ? "validate:quick:ts" : "validate:ts",
      secs: wallSecs,
      date: new Date().toISOString(),
    });
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(entries, undefined, 2));
  } catch {
    // ignore — telemetry is best-effort
  }
}
