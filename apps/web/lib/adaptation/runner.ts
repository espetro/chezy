import {
  AdaptationJobSchema,
  comparisonPanelJsonSchema,
  isAdaptationFocus,
  type AdaptationFocus,
  type AdaptationJob,
  type FeedbackEvent,
  type TraceEvent,
} from "@chezy/contract";
import { getLogger } from "@chezy/observability";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import * as v from "valibot";

import {
  ADAPTATION_ERRORS,
  nextStep,
  type AdaptationEffect,
  type AdaptationStepInput,
} from "~/lib/adaptation/machine";
import {
  buildAdaptationPrompt,
  buildCorrectionPrompt,
  sanitizeCandidate,
} from "~/lib/adaptation/prompt";
import type { ValidationContext } from "~/lib/adaptation/validate";
import { ADAPTATION_CANDIDATE_LIMIT, ADAPTATION_DEADLINE_MS } from "~/lib/constants";
import { db } from "~/lib/db/client";
import {
  adaptationCandidate,
  adaptationJob,
  listing,
  listingFeedback,
  type AdaptationJobRow,
  type Listing,
  type SearchProfile,
} from "~/lib/db/schema";
import type { DemoUserCleanup } from "~/lib/demo/reset";
import {
  createDevinClient,
  createMockDevinClient,
  DevinClientError,
  type DevinClient,
  type DevinSessionSnapshot,
} from "~/lib/devin/client";
import { env } from "~/lib/env";
import { buildFeed } from "~/lib/feed";
import { getFeedbackEvent, listActiveFeedback } from "~/lib/feedback";
import { getListingRowById } from "~/lib/listings";
import { violatesRedLines } from "~/lib/match";
import { getProfile } from "~/lib/profile";
import { getProfileVersion } from "~/lib/profile-version";

export class AdaptationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const TERMINAL: ReadonlySet<string> = new Set(["ready", "failed", "stale"]);
const logger = getLogger(["chezy", "adaptation"]);

// Safe user-facing message for a provider failure; the classified code picks
// the honest variant, everything else stays generic.
export const providerFailureMessage = (error: unknown): string => {
  if (!(error instanceof DevinClientError)) return ADAPTATION_ERRORS.provider;
  if (error.code === "out_of_quota") return ADAPTATION_ERRORS.quota;
  if (error.code === "unauthorized") return ADAPTATION_ERRORS.unauthorized;
  return ADAPTATION_ERRORS.provider;
};

// Server log only: status, code and the API's own detail text. Never the
// prompt, never the key.
const logProviderFailure = (op: "create" | "poll" | "message", jobId: string, error: unknown) => {
  const known = error instanceof DevinClientError ? error : undefined;
  logger.error("devin session {op} failed for job {jobId}: {status} {code} {detail}", {
    op,
    jobId,
    status: known?.status,
    code: known?.code ?? "unknown",
    detail: known?.detail ?? (error instanceof Error ? error.message : String(error)),
  });
};

// Wire shape: candidate_spec, validation_errors, provider_session_id and
// source_listing_ids never leave the server.
export const toAdaptationJob = (row: AdaptationJobRow): AdaptationJob =>
  v.parse(AdaptationJobSchema, {
    jobId: row.id,
    feedbackEventId: row.feedbackEventId,
    status: row.status,
    provider: row.provider,
    attempt: row.attempt,
    run: row.run,
    trace: row.trace,
    sessionUrl: row.providerSessionUrl,
    // oxlint-disable-next-line unicorn/no-null
    panel: row.status === "ready" ? row.acceptedSpec : null,
    error: row.error,
    updatedAt: row.updatedAt.toISOString(),
  });

const devinClient = (): DevinClient | undefined =>
  env.DEVIN_API_KEY
    ? createDevinClient({ apiKey: env.DEVIN_API_KEY, baseUrl: env.DEVIN_API_BASE_URL })
    : undefined;

const fetchRow = async (id: string) =>
  (await db.select().from(adaptationJob).where(eq(adaptationJob.id, id)))[0];

const traceEvent = (
  step: TraceEvent["step"],
  rest: Omit<TraceEvent, "at" | "step"> = {},
): TraceEvent => ({ at: new Date().toISOString(), step, ...rest });

interface AppliedStep {
  job: AdaptationJob;
  // The row after this tick's UPDATE won; undefined when another tick got there first.
  applied?: AdaptationJobRow;
  effect: AdaptationEffect;
}

// Applies a machine step: the patch is written with a conditional UPDATE on
// the status the step started from, so concurrent ticks cannot double-apply.
// The judged candidate, if any, is stored in the same transaction, so a
// candidate row exists exactly when its patch landed.
const applyStep = async (
  row: AdaptationJobRow,
  input: AdaptationStepInput,
): Promise<AppliedStep> => {
  const { patch, effect, candidate } = nextStep(row, input);
  if (Object.keys(patch).length === 0) return { job: toAdaptationJob(row), effect };
  const updated = await db.transaction(async (transaction) => {
    const [next] = await transaction
      .update(adaptationJob)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(adaptationJob.id, row.id), eq(adaptationJob.status, row.status)))
      .returning();
    if (next && candidate) {
      await transaction.insert(adaptationCandidate).values({
        jobId: row.id,
        run: row.run,
        attempt: candidate.attempt,
        providerSessionId: row.providerSessionId,
        spec: candidate.spec,
        hash: candidate.hash,
        errors: candidate.errors,
        accepted: candidate.accepted,
      });
    }
    return next;
  });
  if (!updated) {
    return { job: toAdaptationJob((await fetchRow(row.id)) ?? row), effect: { kind: "none" } };
  }
  return { job: toAdaptationJob(updated), applied: updated, effect };
};

const failStep = async (row: AdaptationJobRow, message: string) =>
  (await applyStep(row, { kind: "provider_error", message })).job;

export const startAdaptation = async (userId: string, eventId: string): Promise<AdaptationJob> => {
  const event = await getFeedbackEvent(userId, eventId);
  if (!event) throw new AdaptationError("Feedback not found", 404);
  if (event.undoneAt !== null) throw new AdaptationError("Feedback was undone", 409);
  if (!isAdaptationFocus(event.reason)) {
    throw new AdaptationError("No comparison for this reason", 409);
  }
  const profile = await getProfile(userId);
  if (!profile) throw new AdaptationError("Set your preferences first", 409);

  // Dedupe on (user_id, feedback_event_id): a repeated submission returns the
  // same job. Inserts stay queued; the provider call happens on first poll.
  await db
    .insert(adaptationJob)
    .values({
      userId,
      feedbackEventId: eventId,
      profileVersion: getProfileVersion(profile),
      focus: event.reason,
      status: "queued",
      provider: env.ADAPTATION_MODE === "devin" ? "devin" : "mock",
      deadlineAt: new Date(Date.now() + ADAPTATION_DEADLINE_MS),
      trace: [traceEvent("triggered")],
    })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(adaptationJob)
    .where(and(eq(adaptationJob.userId, userId), eq(adaptationJob.feedbackEventId, eventId)));
  if (!row) throw new AdaptationError("Couldn't start the comparison", 500);
  return toAdaptationJob(row);
};

const claimJob = async (
  row: AdaptationJobRow,
  event: FeedbackEvent,
  focus: AdaptationFocus,
  profile: SearchProfile,
): Promise<AdaptationJob> => {
  // Two tabs can race the claim; only the winner creates the session. The
  // machine's claim patch sets status running and attempt 1.
  const { patch } = nextStep(row, { kind: "claim" });
  const [claimed] = await db
    .update(adaptationJob)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(adaptationJob.id, row.id), eq(adaptationJob.status, "queued")))
    .returning();
  if (!claimed) return toAdaptationJob((await fetchRow(row.id)) ?? row);

  if (claimed.provider === "devin" && !env.DEVIN_API_KEY) {
    return failStep(claimed, ADAPTATION_ERRORS.notConfigured);
  }

  const feedback = await listActiveFeedback(row.userId);
  const feed = await buildFeed(profile, undefined, undefined, feedback);
  const candidates = feed.items
    .map((item) => item.listing)
    .filter((item) => item.id !== event.listingId)
    .slice(0, ADAPTATION_CANDIDATE_LIMIT)
    .map(sanitizeCandidate);
  const rejectedRow = await getListingRowById(event.listingId);
  if (!rejectedRow) return failStep(claimed, ADAPTATION_ERRORS.provider);

  const client =
    claimed.provider === "devin"
      ? createDevinClient({
          apiKey: env.DEVIN_API_KEY ?? "",
          baseUrl: env.DEVIN_API_BASE_URL,
        })
      : createMockDevinClient({ candidates, event, focus }, env.ADAPTATION_MOCK_SCENARIO);

  let snapshot: DevinSessionSnapshot;
  try {
    snapshot = await client.createSession({
      title: `Comparison panel ${event.eventId}`,
      prompt: buildAdaptationPrompt({
        event,
        focus,
        rejected: sanitizeCandidate(rejectedRow),
        candidates,
        schema: comparisonPanelJsonSchema,
        attempt: claimed.attempt,
      }),
      schema: comparisonPanelJsonSchema,
    });
  } catch (error) {
    logProviderFailure("create", claimed.id, error);
    return failStep(claimed, providerFailureMessage(error));
  }

  const [updated] = await db
    .update(adaptationJob)
    .set({
      providerSessionId: snapshot.sessionId,
      // oxlint-disable-next-line unicorn/no-null
      providerSessionUrl: snapshot.url ?? null,
      sourceListingIds: candidates.map((candidate) => candidate.id),
      trace: [...claimed.trace, traceEvent("session_created", { sessionId: snapshot.sessionId })],
      updatedAt: new Date(),
    })
    .where(and(eq(adaptationJob.id, claimed.id), eq(adaptationJob.status, "running")))
    .returning();
  return toAdaptationJob(updated ?? claimed);
};

// A running row with no providerSessionId is the window between the claim
// UPDATE and the session-store UPDATE in claimJob: another tab's tick can land
// there. Keep polling instead of failing; the deadline covers a claimer that
// died mid-claim.
const pollJob = async (
  row: AdaptationJobRow,
  event: FeedbackEvent,
  focus: AdaptationFocus,
  profile: SearchProfile,
): Promise<AdaptationJob> => {
  if (!row.providerSessionId) {
    return toAdaptationJob(row);
  }
  const client =
    row.provider === "devin"
      ? devinClient()
      : // The mock keeps its context in a process-global store keyed by
        // session id, so polls do not need the candidates again.
        createMockDevinClient({ candidates: [], event, focus }, env.ADAPTATION_MOCK_SCENARIO);
  if (!client) return failStep(row, ADAPTATION_ERRORS.notConfigured);
  let snapshot: DevinSessionSnapshot;
  try {
    snapshot = await client.getSession(row.providerSessionId);
  } catch (error) {
    logProviderFailure("poll", row.id, error);
    return failStep(row, providerFailureMessage(error));
  }

  // Trusted facts are re-read on every tick: a listing rejected or a red line
  // hit after the session was briefed still disqualifies the candidate.
  const ids = [...new Set([...row.sourceListingIds, event.listingId])];
  const [rows, feedback, prior] = await Promise.all([
    db.select().from(listing).where(inArray(listing.id, ids)),
    listActiveFeedback(row.userId),
    db
      .select({ hash: adaptationCandidate.hash })
      .from(adaptationCandidate)
      .where(and(eq(adaptationCandidate.jobId, row.id), eq(adaptationCandidate.run, row.run))),
  ]);
  const facts = Object.fromEntries(rows.map((item) => [item.id, sanitizeCandidate(item)]));
  const ctx: ValidationContext = {
    feedbackEventId: row.feedbackEventId,
    profileVersion: row.profileVersion,
    focus,
    sourceListingIds: row.sourceListingIds,
    expectedAttempt: row.attempt,
    rejectedListingId: event.listingId,
    rejectedListingIds: feedback.map((item) => item.listingId),
    redLineListingIds: rows
      .filter((item) => violatesRedLines(profile, item))
      .map((item) => item.id),
    facts,
  };
  const step = await applyStep(row, {
    kind: "snapshot",
    snapshot,
    ctx,
    priorHashes: prior.map((item) => item.hash),
  });
  if (step.effect.kind !== "send_correction" || !step.applied) return step.job;

  // The status moved to correcting before the message goes out, so a racing
  // tick cannot send a second one; a failed send fails the job.
  try {
    await client.sendMessage(
      row.providerSessionId,
      buildCorrectionPrompt({
        event,
        focus,
        rejected: facts[event.listingId],
        candidates: row.sourceListingIds.flatMap((id) => facts[id] ?? []),
        schema: comparisonPanelJsonSchema,
        attempt: step.effect.attempt,
        errors: step.effect.errors,
      }),
    );
  } catch (error) {
    logProviderFailure("message", row.id, error);
    return failStep(step.applied, providerFailureMessage(error));
  }
  return step.job;
};

// One step per call. Order: terminal, stale (undone event or profile
// version drift), deadline timeout, then claim or poll by status.
export const advanceAdaptation = async (
  userId: string,
  jobId: string,
): Promise<AdaptationJob | undefined> => {
  const [row] = await db
    .select()
    .from(adaptationJob)
    .where(and(eq(adaptationJob.id, jobId), eq(adaptationJob.userId, userId)));
  if (!row) return undefined;
  if (TERMINAL.has(row.status)) return toAdaptationJob(row);

  const event = await getFeedbackEvent(userId, row.feedbackEventId);
  const profile = await getProfile(userId);
  if (
    !event ||
    event.undoneAt !== null ||
    event.reason !== row.focus ||
    !profile ||
    getProfileVersion(profile) !== row.profileVersion
  ) {
    return (await applyStep(row, { kind: "stale" })).job;
  }
  if (Date.now() > row.deadlineAt.getTime()) {
    return (await applyStep(row, { kind: "timeout" })).job;
  }
  if (row.status === "queued") return claimJob(row, event, row.focus, profile);
  if (row.status === "running" || row.status === "correcting") {
    return pollJob(row, event, row.focus, profile);
  }
  return toAdaptationJob(row);
};

// A deliberate new attempt after a terminal failure: same job, next run, fresh
// candidate budget and Devin session. Earlier runs' candidates stay. A stale
// job is not retried; a new rejection makes a new event and job.
export const retryAdaptation = async (userId: string, jobId: string): Promise<AdaptationJob> => {
  const [row] = await db
    .select()
    .from(adaptationJob)
    .where(and(eq(adaptationJob.id, jobId), eq(adaptationJob.userId, userId)));
  if (!row) throw new AdaptationError("Job not found", 404);
  if (row.status !== "failed") {
    throw new AdaptationError("Only a failed comparison can be retried", 409);
  }
  const event = await getFeedbackEvent(userId, row.feedbackEventId);
  const profile = await getProfile(userId);
  if (
    !event ||
    event.undoneAt !== null ||
    event.reason !== row.focus ||
    !profile ||
    getProfileVersion(profile) !== row.profileVersion
  ) {
    throw new AdaptationError("Your preferences changed; reject a listing again to compare", 409);
  }
  const [updated] = await db
    .update(adaptationJob)
    .set({
      status: "queued",
      attempt: 0,
      run: row.run + 1,
      // oxlint-disable-next-line unicorn/no-null
      error: null,
      // oxlint-disable-next-line unicorn/no-null
      candidateSpec: null,
      // oxlint-disable-next-line unicorn/no-null
      validationErrors: null,
      // oxlint-disable-next-line unicorn/no-null
      providerSessionId: null,
      // oxlint-disable-next-line unicorn/no-null
      providerSessionUrl: null,
      deadlineAt: new Date(Date.now() + ADAPTATION_DEADLINE_MS),
      trace: [...row.trace, traceEvent("retried", { run: row.run + 1 })],
      updatedAt: new Date(),
    })
    .where(and(eq(adaptationJob.id, row.id), eq(adaptationJob.status, "failed")))
    .returning();
  if (!updated) throw new AdaptationError("Only a failed comparison can be retried", 409);
  return toAdaptationJob(updated);
};

const activeEventJoin = and(
  eq(listingFeedback.eventId, adaptationJob.feedbackEventId),
  eq(listingFeedback.userId, adaptationJob.userId),
  isNull(listingFeedback.undoneAt),
);

// Newest ready job whose feedback event is still active, with the Listing
// rows for the accepted spec in listingIds order.
export const getLatestAcceptedPanel = async (userId: string) => {
  const [row] = await db
    .select({ job: adaptationJob })
    .from(adaptationJob)
    .innerJoin(listingFeedback, activeEventJoin)
    .where(and(eq(adaptationJob.userId, userId), eq(adaptationJob.status, "ready")))
    .orderBy(desc(adaptationJob.updatedAt))
    .limit(1);
  const spec = row?.job.acceptedSpec;
  if (!row || !spec) return undefined;
  const rows = await db.select().from(listing).where(inArray(listing.id, spec.listingIds));
  const byId = new Map(rows.map((item) => [item.id, item]));
  return {
    job: toAdaptationJob(row.job),
    spec,
    rows: spec.listingIds
      .map((id) => byId.get(id))
      .filter((item): item is Listing => item !== undefined),
  };
};

// Newest job for an active event that still needs the status line: in flight,
// or failed so the user can start a deliberate new attempt after a reload.
// Ready jobs render as the panel; stale ones are dropped.
export const getActiveJob = async (userId: string): Promise<AdaptationJob | undefined> => {
  const [row] = await db
    .select({ job: adaptationJob })
    .from(adaptationJob)
    .innerJoin(listingFeedback, activeEventJoin)
    .where(
      and(
        eq(adaptationJob.userId, userId),
        inArray(adaptationJob.status, ["queued", "running", "correcting", "validating", "failed"]),
      ),
    )
    .orderBy(desc(adaptationJob.createdAt))
    .limit(1);
  return row ? toAdaptationJob(row.job) : undefined;
};

export const clearUserAdaptations: DemoUserCleanup = async (transaction, userId) => {
  await transaction.delete(adaptationJob).where(eq(adaptationJob.userId, userId));
};
