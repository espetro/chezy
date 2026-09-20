import { CapabilityJobSchema, type CapabilityJob, type TraceEvent } from "@chezy/contract";
import { getLogger } from "@chezy/observability";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import type { CapabilityGap } from "~/lib/adaptation/gap";
import { ADAPTATION_ERRORS } from "~/lib/adaptation/machine";
import { CAPABILITY_FORGE_BASE_BRANCH, CAPABILITY_FORGE_MAX_ACU } from "~/lib/constants";
import { db } from "~/lib/db/client";
import { adaptationJob, capabilityJob, type CapabilityJobRow } from "~/lib/db/schema";
import { createDevinClient } from "~/lib/devin/client";
import { logProviderFailure, providerFailureMessage } from "~/lib/devin/failure";
import { env } from "~/lib/env";
import { CAPABILITY_STRUCTURED_OUTPUT_SCHEMA, CAPABILITY_TASKS } from "~/lib/capability/prompt";

const logger = getLogger(["chezy", "capability"]);

export const toCapabilityJob = (row: CapabilityJobRow): CapabilityJob =>
  v.parse(CapabilityJobSchema, {
    jobId: row.id,
    capability: row.capability,
    status: row.status,
    provider: row.provider,
    coverage: row.coverage,
    // oxlint-disable-next-line unicorn/no-null
    sessionUrl: row.providerSessionUrl ?? null,
    // oxlint-disable-next-line unicorn/no-null
    prUrl: row.prUrl ?? null,
    // oxlint-disable-next-line unicorn/no-null
    error: row.error ?? null,
    updatedAt: row.updatedAt.toISOString(),
  });

const updateTrace = (trace: readonly TraceEvent[], capability: string): TraceEvent[] => [
  ...trace,
  { at: new Date().toISOString(), step: "capability_gap", message: capability },
];

export const launchCapabilityForge = async (input: {
  userId: string;
  adaptationJobId: string;
  trace: readonly TraceEvent[];
  gap: CapabilityGap;
}): Promise<CapabilityJob | undefined> => {
  if (env.FORGE_TRIGGER_MODE === "off") return undefined;
  try {
    const provider = env.FORGE_TRIGGER_MODE === "devin" ? "devin" : "mock";
    const [created] = await db
      .insert(capabilityJob)
      .values({
        userId: input.userId,
        capability: input.gap.capability,
        status: "queued",
        provider,
        coverage: input.gap.coverage,
      })
      .onConflictDoNothing()
      .returning();
    const row =
      created ??
      (
        await db
          .select()
          .from(capabilityJob)
          .where(eq(capabilityJob.capability, input.gap.capability))
      )[0];
    if (!row) return undefined;
    await db
      .update(adaptationJob)
      .set({
        capabilityJobId: row.id,
        trace: updateTrace(input.trace, input.gap.capability),
        updatedAt: new Date(),
      })
      .where(eq(adaptationJob.id, input.adaptationJobId));
    if (!created) return toCapabilityJob(row);

    if (!CAPABILITY_TASKS[row.capability]) {
      const [failed] = await db
        .update(capabilityJob)
        .set({ status: "failed", error: "Unknown capability.", updatedAt: new Date() })
        .where(eq(capabilityJob.id, row.id))
        .returning();
      return failed ? toCapabilityJob(failed) : undefined;
    }
    if (provider === "mock") {
      const [running] = await db
        .update(capabilityJob)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(capabilityJob.id, row.id))
        .returning();
      return running ? toCapabilityJob(running) : undefined;
    }
    if (!env.DEVIN_API_KEY) {
      const [failed] = await db
        .update(capabilityJob)
        .set({ status: "failed", error: ADAPTATION_ERRORS.notConfigured, updatedAt: new Date() })
        .where(eq(capabilityJob.id, row.id))
        .returning();
      return failed ? toCapabilityJob(failed) : undefined;
    }
    try {
      const task = CAPABILITY_TASKS[row.capability];
      const snapshot = await createDevinClient({
        apiKey: env.DEVIN_API_KEY,
        baseUrl: env.DEVIN_API_BASE_URL,
        orgId: env.DEVIN_ORG_ID,
      }).createSession({
        title: `Chezy capability forge: ${row.capability}`,
        tags: ["chezy", "forge", row.capability],
        prompt: task.buildPrompt(row.id.slice(0, 8), CAPABILITY_FORGE_BASE_BRANCH),
        schema: CAPABILITY_STRUCTURED_OUTPUT_SCHEMA,
        maxAcu: CAPABILITY_FORGE_MAX_ACU,
      });
      const [running] = await db
        .update(capabilityJob)
        .set({
          status: "running",
          providerSessionId: snapshot.sessionId,
          providerSessionUrl: snapshot.url,
          updatedAt: new Date(),
        })
        .where(eq(capabilityJob.id, row.id))
        .returning();
      return running ? toCapabilityJob(running) : undefined;
    } catch (error) {
      logProviderFailure("create", row.id, error);
      const [failed] = await db
        .update(capabilityJob)
        .set({ status: "failed", error: providerFailureMessage(error), updatedAt: new Date() })
        .where(eq(capabilityJob.id, row.id))
        .returning();
      return failed ? toCapabilityJob(failed) : undefined;
    }
  } catch (error) {
    logger.error("capability forge launch failed: {error}", {
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
};

export const refreshCapabilityJob = async (
  userId: string,
  jobId: string,
): Promise<CapabilityJob | undefined> => {
  const [row] = await db
    .select()
    .from(capabilityJob)
    .where(and(eq(capabilityJob.id, jobId), eq(capabilityJob.userId, userId)));
  if (!row) return undefined;
  if (row.provider !== "devin" || row.status !== "running" || !row.providerSessionId) {
    return toCapabilityJob(row);
  }
  if (!env.DEVIN_API_KEY) return toCapabilityJob(row);
  try {
    const snapshot = await createDevinClient({
      apiKey: env.DEVIN_API_KEY,
      baseUrl: env.DEVIN_API_BASE_URL,
      orgId: env.DEVIN_ORG_ID,
    }).getSession(row.providerSessionId);
    const patch = snapshot.pullRequestUrl
      ? { status: "pr_opened" as const, prUrl: snapshot.pullRequestUrl }
      : snapshot.phase === "ended" || snapshot.phase === "finished"
        ? { status: "failed" as const, error: "The session ended without opening a PR." }
        : undefined;
    if (!patch) return toCapabilityJob(row);
    const [updated] = await db
      .update(capabilityJob)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(capabilityJob.id, row.id), eq(capabilityJob.status, "running")))
      .returning();
    return toCapabilityJob(updated ?? row);
  } catch (error) {
    logProviderFailure("poll", row.id, error);
    return toCapabilityJob(row);
  }
};

export const getCapabilityForAdaptation = async (
  adaptationJobId: string,
): Promise<CapabilityJob | undefined> => {
  const [row] = await db
    .select({ capability: capabilityJob })
    .from(adaptationJob)
    .innerJoin(capabilityJob, eq(adaptationJob.capabilityJobId, capabilityJob.id))
    .where(eq(adaptationJob.id, adaptationJobId));
  return row ? toCapabilityJob(row.capability) : undefined;
};
