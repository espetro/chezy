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
    const rev = execFileSync(
      "git",
      ["rev-parse", "--verify", "-q", "origin/main"],
      { cwd: REPO_ROOT },
    )
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

const steps: readonly Step[] = [
  { title: "typecheck", cmd: "pnpm", args: ["-r", "--filter", "./apps/*", "--filter", "./packages/*", "typecheck"] },
  { title: "lint", cmd: "pnpm", args: ["-r", "--filter", "./apps/*", "--filter", "./packages/*", "lint"] },
  { title: "lint:scripts", cmd: "pnpm", args: ["exec", "oxlint", "scripts"] },
  { title: "format:check", cmd: "pnpm", args: ["format:check"] },
  ...(quick ? [] : [{ title: "test", cmd: "pnpm", args: ["-r", "--filter", "./apps/*", "--filter", "./packages/*", "test"] }]),
];

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
    const entries = existsSync(file)
      ? (JSON.parse(readFileSync(file, "utf8")) as unknown[])
      : [];
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
