import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { desc, eq } from "drizzle-orm";

// Exports the newest adaptation job (any provider) with every judged candidate
// and its exact validator errors as JSON, for the run trace in docs/.
// Usage: node --env-file-if-exists=.env.local --import=tsx scripts/export-adaptation-run.ts <dir> [jobId]
const [, , outDir, jobIdArg] = process.argv;
if (!outDir) throw new Error("usage: export-adaptation-run.ts <out-dir> [jobId]");

const { client, db } = await import("~/lib/db/client");
const { adaptationCandidate, adaptationJob } = await import("~/lib/db/schema");

try {
  const [job] = jobIdArg
    ? await db.select().from(adaptationJob).where(eq(adaptationJob.id, jobIdArg))
    : await db.select().from(adaptationJob).orderBy(desc(adaptationJob.createdAt)).limit(1);
  if (!job) throw new Error("no adaptation job found");
  const candidates = await db
    .select()
    .from(adaptationCandidate)
    .where(eq(adaptationCandidate.jobId, job.id))
    .orderBy(adaptationCandidate.run, adaptationCandidate.attempt);
  mkdirSync(outDir, { recursive: true });
  // user_id is the only identifying column; everything else is the run itself.
  const { userId: _userId, ...exported } = job;
  writeFileSync(path.join(outDir, "job.json"), `${JSON.stringify(exported, undefined, 2)}\n`);
  writeFileSync(
    path.join(outDir, "candidates.json"),
    `${JSON.stringify(candidates, undefined, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      jobId: job.id,
      provider: job.provider,
      status: job.status,
      run: job.run,
      attempt: job.attempt,
      sessionId: job.providerSessionId,
      sessionUrl: job.providerSessionUrl,
      steps: job.trace.map((event) => `${event.at} ${event.step}`),
      candidates: candidates.map((candidate) => ({
        run: candidate.run,
        attempt: candidate.attempt,
        accepted: candidate.accepted,
        codes: candidate.errors.map((error) => error.code),
      })),
      outDir,
    }),
  );
} finally {
  await client.end();
}
