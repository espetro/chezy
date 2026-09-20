/**
 * Chezy Forge entrypoint: `tsx scripts/devin-forge/forge.ts pisos
 * [--base <branch>] [--max-attempts 3] [--dry-run-verify <sha>]
 * [--smoke] [--resume <sessionId> --run-id <id>]`.
 *
 * Creates a Devin cloud session that writes the pisos.com adapter,
 * verifies the resulting PR (allowlist + pytest + hold-out + ruff +
 * basedpyright), sends failures back and retries, then squash-merges.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { env } from "../../packages/config/src/index.ts";
import { createSession, getSession, listSessions, sendMessage } from "./devin.ts";
import { STRUCTURED_OUTPUT_SCHEMA } from "./prompt.ts";
import { TASKS } from "./tasks.ts";
import { prHeadSha, verify, verifyLocal, type Verdict } from "./verify.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const RUNS_DIR = path.join(import.meta.dirname, "runs");

const DEFAULT_BASE = "feat/chezy-forge/pisos-standard";
const DEFAULT_REPO = "espetro/chezy";
const POLL_MS = 15_000;
const ATTEMPT_CAP_MS = 25 * 60 * 1000;

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function runIdNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function logEvent(runId: string, event: Record<string, unknown>): void {
  mkdirSync(RUNS_DIR, { recursive: true });
  appendFileSync(
    path.join(RUNS_DIR, `${runId}.jsonl`),
    `${JSON.stringify({ ...event, ts: new Date().toISOString() })}\n`,
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForSession(
  opts: { pat: string; orgId: string },
  sessionId: string,
  deadline: number,
): Promise<{
  done: boolean;
  timedOut: boolean;
  detail: string;
  session: Awaited<ReturnType<typeof getSession>>;
}> {
  let last = "";
  let session = await getSession(opts, sessionId);
  for (;;) {
    const label = `${session.status}/${session.status_detail ?? ""}`;
    if (label !== last) {
      console.log(`[poll] ${label}`);
      last = label;
    }
    const detail = session.status_detail ?? "";
    if (["finished", "waiting_for_user"].includes(detail)) {
      return { done: true, timedOut: false, detail, session };
    }
    if (["exit", "error", "suspended"].includes(session.status)) {
      return { done: true, timedOut: false, detail, session };
    }
    if (Date.now() > deadline) {
      return { done: false, timedOut: true, detail, session };
    }
    await sleep(POLL_MS);
    session = await getSession(opts, sessionId);
  }
}

const RESUME_CAP_MS = 3 * 60 * 1000;

// After feedback is sent the session still reports its old status_detail and
// the PR still points at the old head; wait until Devin picks the message up
// (status_detail "working") or the PR head moves, whichever comes first.
async function waitForResume(
  opts: { pat: string; orgId: string },
  sessionId: string,
  prUrl: string | undefined,
  previousSha: string | undefined,
): Promise<boolean> {
  const cap = Date.now() + RESUME_CAP_MS;
  while (Date.now() < cap) {
    const session = await getSession(opts, sessionId);
    if (session.status_detail === "working") return true;
    if (["error", "exit"].includes(session.status)) return true;
    if (prUrl && previousSha) {
      const head = prHeadSha(prUrl, REPO_ROOT);
      if (head && head !== previousSha) return true;
    }
    await sleep(POLL_MS);
  }
  return false;
}

async function main(): Promise<number> {
  const taskName = process.argv[2] ?? "";
  const task = TASKS[taskName];
  if (!task) {
    console.error(
      `usage: forge.ts <${Object.keys(TASKS).join("|")}> [--base <branch>] [--max-attempts 3] [--dry-run-verify <sha>] [--smoke] [--devin-mode <mode>] [--resume <sessionId> --run-id <id>]`,
    );
    return 2;
  }
  const base = arg("--base") ?? DEFAULT_BASE;
  const maxAttempts = Number(arg("--max-attempts") ?? "3");
  const repo = env.FORGE_REPO ?? DEFAULT_REPO;
  const holdoutDir = env.FORGE_HOLDOUT_DIR ?? task.holdoutDir;
  const resumeId = arg("--resume");
  const runId = arg("--run-id") ?? runIdNow();

  if (!env.DEVIN_PAT) {
    console.error("DEVIN_PAT is not set (root .env)");
    return 2;
  }
  if (!env.DEVIN_ORG_ID) {
    console.error("DEVIN_ORG_ID is not set (root .env)");
    return 2;
  }
  const client = { pat: env.DEVIN_PAT, orgId: env.DEVIN_ORG_ID };

  if (process.argv.includes("--smoke")) {
    const items = await listSessions(client);
    console.log(`sessions: ${items.length}`);
    return 0;
  }

  const drySha = arg("--dry-run-verify");
  if (drySha) {
    const verdict = await verifyLocal(
      {
        sha: drySha,
        baseBranch: base,
        runId,
        attempt: 1,
        repoRoot: REPO_ROOT,
        holdoutDir,
      },
      task,
    );
    console.log(JSON.stringify(verdict, undefined, 2));
    return verdict.kind === "pass" ? 0 : 1;
  }

  const devinMode = arg("--devin-mode");
  const session = resumeId
    ? await getSession(client, resumeId)
    : await createSession(client, {
        prompt: task.buildPrompt(runId, base),
        repos: [repo],
        title: `forge:${taskName} ${runId}`,
        tags: ["forge", taskName, runId],
        structured_output_schema: STRUCTURED_OUTPUT_SCHEMA,
        structured_output_required: true,
        max_acu_limit: 8,
        resumable: true,
        ...(devinMode ? { devin_mode: devinMode } : {}),
      });
  console.log(`session: ${session.url}`);
  logEvent(runId, {
    event: resumeId ? "session_resumed" : "session_created",
    runId,
    sessionId: session.session_id,
    url: session.url,
  });
  console.log(`run log: ${path.join(RUNS_DIR, `${runId}.jsonl`)}`);

  const fatalStatus = (
    s: Awaited<ReturnType<typeof getSession>>,
    detail: string,
  ): string | undefined => {
    if (s.status === "error") return `error: ${s.status_detail ?? ""}`;
    if (s.status === "suspended" && detail !== "inactivity") return `suspended: ${detail}`;
    return undefined;
  };

  const sessionPrUrl = (s: Awaited<ReturnType<typeof getSession>>) => {
    const prs = s.pull_requests ?? [];
    const open = [...prs].reverse().find((p) => p.pr_state === "open");
    return (
      open?.pr_url ?? prs.at(-1)?.pr_url ?? (s.structured_output?.["pr_url"] as string | undefined)
    );
  };

  let lastVerifiedSha: string | undefined;
  const seedSha = arg("--seed-failure");
  if (seedSha) {
    const seedVerdict = await verifyLocal(
      {
        sha: seedSha,
        baseBranch: base,
        runId,
        attempt: 0,
        repoRoot: REPO_ROOT,
        holdoutDir,
      },
      task,
    );
    logEvent(runId, {
      event: "verdict",
      attempt: 0,
      kind: seedVerdict.kind,
      ...(seedVerdict.kind === "fail"
        ? { gate: seedVerdict.gate, failingTests: seedVerdict.failingTests }
        : {}),
      ...(seedVerdict.kind === "refused" ? { paths: seedVerdict.paths } : {}),
      sha: seedVerdict.sha,
      seed: true,
    });
    if (seedVerdict.kind === "pass") {
      console.log("seed sha passes; nothing to feed back");
      return 0;
    }
    lastVerifiedSha = seedSha;
    const seedMsg =
      seedVerdict.kind === "refused"
        ? `Rejected by the verifier: your PR changes files outside the allowlist: ${seedVerdict.paths.join(", ")}. Allowlist: ${task.allowlist.join(", ")}. Do not edit tests or fixtures.`
        : `New verifier evidence against the merged head ${seedSha}: your parser crashes on a live pisos.com page it had not seen. The branch of PR #70 is merged and deleted; create a NEW branch \`feat/chezy-forge/${task.branchSlug}-${runId}-fix\` from \`${base}\`, fix it there, open a NEW PR against \`${base}\`, and provide structured output again.

Gate: ${seedVerdict.gate}. Failing tests: ${seedVerdict.failingTests.join(", ") || "none"}.

Output (tail):
${seedVerdict.output}

${task.feedbackHint}${task.feedbackHint.includes("Do not edit tests") ? "" : " Do not edit tests or fixtures."}`;
    await sendMessage(client, session.session_id, seedMsg);
    if (!(await waitForResume(client, session.session_id, undefined, undefined))) {
      logEvent(runId, { event: "resume_timeout", attempt: 0 });
    }
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const deadline = Date.now() + ATTEMPT_CAP_MS;
    let waited = await waitForSession(client, session.session_id, deadline);
    let fatal = fatalStatus(waited.session, waited.detail);
    if (fatal) {
      console.error(`session ${fatal}`);
      logEvent(runId, { event: "session_fatal", attempt, detail: fatal });
      return 2;
    }

    let verdict: Verdict;
    let prUrl = sessionPrUrl(waited.session);

    if (waited.timedOut) {
      verdict = {
        kind: "fail",
        gate: "timeout",
        output: "verifier wait cap 25min",
        failingTests: [],
      };
      await sendMessage(
        client,
        session.session_id,
        "The verifier timed out waiting; please finish, push, open the PR and provide structured output.",
      );
    } else if (!prUrl) {
      verdict = { kind: "fail", gate: "no_pr", output: "no PR found on session", failingTests: [] };
      await sendMessage(
        client,
        session.session_id,
        `No PR found. Push your branch and open the PR against ${base}, then provide structured output.`,
      );
    } else {
      // The session keeps its old status_detail after feedback; never
      // re-verify an unchanged head SHA — nudge and wait for real movement.
      let head = prHeadSha(prUrl, REPO_ROOT);
      while (head && head === lastVerifiedSha && Date.now() < deadline) {
        await sendMessage(
          client,
          session.session_id,
          "Your PR head has not changed since the last verifier run; push your fix and provide structured output again.",
        );
        if (!(await waitForResume(client, session.session_id, prUrl, lastVerifiedSha))) {
          logEvent(runId, { event: "resume_timeout", attempt });
        }
        waited = await waitForSession(client, session.session_id, deadline);
        fatal = fatalStatus(waited.session, waited.detail);
        if (fatal) {
          console.error(`session ${fatal}`);
          logEvent(runId, { event: "session_fatal", attempt, detail: fatal });
          return 2;
        }
        prUrl = sessionPrUrl(waited.session) ?? prUrl;
        head = prUrl ? prHeadSha(prUrl, REPO_ROOT) : undefined;
      }
      if (waited.timedOut || !head || head === lastVerifiedSha) {
        verdict = {
          kind: "fail",
          gate: "timeout",
          output: "no new commit on the PR within the attempt cap",
          failingTests: [],
          sha: lastVerifiedSha,
        };
        await sendMessage(
          client,
          session.session_id,
          "The verifier timed out waiting; please finish, push, open the PR and provide structured output.",
        );
      } else {
        verdict = await verify(
          {
            prUrl,
            baseBranch: base,
            runId,
            attempt,
            repoRoot: REPO_ROOT,
            holdoutDir,
          },
          task,
        );
      }
    }
    lastVerifiedSha = verdict.sha ?? lastVerifiedSha;

    logEvent(runId, {
      event: "verdict",
      attempt,
      kind: verdict.kind,
      ...(verdict.kind === "fail"
        ? { gate: verdict.gate, failingTests: verdict.failingTests }
        : {}),
      ...(verdict.kind === "refused" ? { paths: verdict.paths } : {}),
      sha: verdict.sha,
      prUrl,
      acus_consumed: waited.session.acus_consumed,
    });

    if (verdict.kind === "pass") {
      const { spawnSync } = await import("node:child_process");
      const merge = spawnSync("gh", ["pr", "merge", prUrl ?? "", "--squash", "--delete-branch"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      });
      logEvent(runId, { event: "merged", prUrl, mergeStatus: merge.status });
      console.log(`merged ${prUrl} (gh exit ${merge.status})`);
      return merge.status === 0 ? 0 : 1;
    }
    if (verdict.kind === "refused") {
      await sendMessage(
        client,
        session.session_id,
        `Rejected by the verifier: your PR changes files outside the allowlist: ${verdict.paths.join(", ")}. Revert those files (git checkout origin/${base} -- <path>) and push again. Allowlist: ${[...["apps/scraper/src/chezy_scraper/adapters/pisos.py", "apps/scraper/src/chezy_scraper/models.py", "apps/scraper/src/chezy_scraper/__main__.py", "apps/scraper/src/chezy_scraper/sinks/postgres.py", "packages/contract/src/**"]].join(", ")}. Do not edit tests or fixtures.`,
      );
    } else {
      const names = verdict.failingTests.length > 0 ? verdict.failingTests.join(", ") : "none";
      await sendMessage(
        client,
        session.session_id,
        `Verifier rejected attempt ${attempt}. Gate: ${verdict.gate}. Failing tests: ${names}.\n\nOutput (tail):\n${verdict.output}\n\n${task.feedbackHint}${task.feedbackHint.includes("Do not edit tests") ? "" : " Do not edit tests or fixtures."} Fix on the same branch, push, then provide structured output again.`,
      );
    }
    if (!(await waitForResume(client, session.session_id, prUrl, lastVerifiedSha))) {
      logEvent(runId, { event: "resume_timeout", attempt });
    }
  }

  logEvent(runId, { event: "escalated" });
  console.error(
    `escalated after ${maxAttempts} attempts; log: ${path.join(RUNS_DIR, `${runId}.jsonl`)}`,
  );
  return 1;
}

process.exit(await main());
