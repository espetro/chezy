/**
 * Forge verifier: checks a PR head (or a local SHA, for dry runs) out
 * into a scratch worktree, enforces the path allowlist, injects the
 * hidden hold-out test and runs the pytest/ruff/basedpyright gates.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ForgeTask } from "./tasks.ts";

export type Verdict =
  | { kind: "pass"; sha?: string | undefined }
  | { kind: "fail"; gate: string; output: string; failingTests: string[]; sha?: string | undefined }
  | { kind: "refused"; paths: string[]; sha?: string | undefined };

export interface VerifyOpts {
  prUrl?: string | undefined;
  sha?: string | undefined;
  baseBranch: string;
  runId: string;
  attempt: number;
  repoRoot: string;
  holdoutDir: string;
}

function run(cmd: string, args: string[], cwd: string): { code: number; output: string } {
  const res = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    timeout: 10 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
  if (res.error) return { code: 1, output: `${output}\n${res.error.message}` };
  return { code: res.status ?? 1, output };
}

function tail(output: string, lines: number): string {
  const all = output.split("\n");
  return all.slice(-lines).join("\n");
}

function allowed(file: string, task: ForgeTask): boolean {
  if (task.forbidden.includes(file)) return false;
  if (task.allowlist.includes(file)) return true;
  return task.allowlistPrefixes.some((p) => file.startsWith(p));
}

async function verifySha(opts: VerifyOpts, sha: string, task: ForgeTask): Promise<Verdict> {
  const wt = path.join(
    os.homedir(),
    ".worktrees",
    "chezy-forge",
    `${opts.runId}-attempt-${opts.attempt}`,
  );
  const logsDir = path.resolve(opts.holdoutDir, "..", "logs");
  mkdirSync(logsDir, { recursive: true });
  const logPath = (gate: string) =>
    path.join(logsDir, `${opts.runId}-attempt-${opts.attempt}-${gate}.log`);

  if (existsSync(wt)) {
    run("git", ["worktree", "remove", "--force", wt], opts.repoRoot);
  }
  const add = run("git", ["worktree", "add", "--detach", wt, sha], opts.repoRoot);
  if (add.code !== 0) {
    return { kind: "fail", gate: "worktree", output: tail(add.output, 80), failingTests: [], sha };
  }

  const localRef = run("git", ["rev-parse", "--verify", "-q", opts.baseBranch], opts.repoRoot);
  const base =
    localRef.code === 0 && localRef.output.trim() ? opts.baseBranch : `origin/${opts.baseBranch}`;
  const diff = run("git", ["diff", "--name-only", `${base}...${sha}`], opts.repoRoot);
  if (diff.code !== 0) {
    return { kind: "fail", gate: "diff", output: tail(diff.output, 80), failingTests: [], sha };
  }
  const changed = diff.output
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const offending = changed.filter((f) => !allowed(f, task));
  if (offending.length > 0) {
    writeFileSync(logPath("allowlist"), changed.join("\n"));
    return { kind: "refused", paths: offending, sha };
  }

  for (const f of task.holdoutFiles) {
    const dest = path.join(wt, f.dest);
    mkdirSync(path.dirname(dest), { recursive: true });
    copyFileSync(path.join(opts.holdoutDir, f.src), dest);
  }

  const gates: { name: string; cmd: string; args: string[] }[] = [
    { name: "uv_sync", cmd: "uv", args: ["sync", "--all-packages"] },
    {
      name: "pytest",
      cmd: "uv",
      args: ["run", "pytest", ...task.visibleTests, "-q", "-p", "no:cacheprovider"],
    },
    { name: "ruff_check", cmd: "uv", args: ["run", "ruff", "check", "apps/scraper"] },
    {
      name: "ruff_format",
      cmd: "uv",
      args: ["run", "ruff", "format", "--check", "apps/scraper"],
    },
    {
      name: "basedpyright",
      cmd: "uv",
      args: ["run", "--all-packages", "basedpyright", "apps/scraper"],
    },
  ];

  for (const gate of gates) {
    const res = run(gate.cmd, gate.args, wt);
    writeFileSync(logPath(gate.name), res.output);
    if (res.code !== 0) {
      const failingTests =
        gate.name === "pytest"
          ? [...res.output.matchAll(/^FAILED (.+?)(?: - |$)/gm)].map((m) => m[1] ?? "")
          : [];
      return { kind: "fail", gate: gate.name, output: tail(res.output, 80), failingTests, sha };
    }
  }
  return { kind: "pass", sha };
}

export function prHeadSha(prUrl: string, repoRoot: string): string | undefined {
  const res = run("gh", ["pr", "view", prUrl, "--json", "headRefOid"], repoRoot);
  if (res.code !== 0) return undefined;
  try {
    return (JSON.parse(res.output) as { headRefOid: string }).headRefOid;
  } catch {
    return undefined;
  }
}

export async function verify(opts: VerifyOpts, task: ForgeTask): Promise<Verdict> {
  const pr = run(
    "gh",
    ["pr", "view", opts.prUrl ?? "", "--json", "number,headRefOid,headRefName,baseRefName"],
    opts.repoRoot,
  );
  if (pr.code !== 0) {
    return { kind: "fail", gate: "gh_pr_view", output: tail(pr.output, 80), failingTests: [] };
  }
  const info = JSON.parse(pr.output) as {
    number: number;
    headRefOid: string;
    headRefName: string;
    baseRefName: string;
  };
  if (info.baseRefName !== opts.baseBranch) {
    return {
      kind: "refused",
      paths: [`<pr base is ${info.baseRefName}, expected ${opts.baseBranch}>`],
      sha: info.headRefOid,
    };
  }
  const fetch = run("git", ["fetch", "origin", `pull/${info.number}/head`], opts.repoRoot);
  if (fetch.code !== 0) {
    return {
      kind: "fail",
      gate: "git_fetch",
      output: tail(fetch.output, 80),
      failingTests: [],
      sha: info.headRefOid,
    };
  }
  return verifySha(opts, info.headRefOid, task);
}

export async function verifyLocal(opts: VerifyOpts, task: ForgeTask): Promise<Verdict> {
  if (!opts.sha) {
    return {
      kind: "fail",
      gate: "args",
      output: "verifyLocal requires opts.sha",
      failingTests: [],
    };
  }
  return verifySha(opts, opts.sha, task);
}
