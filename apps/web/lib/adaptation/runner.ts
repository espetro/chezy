import {
  AdaptationJobSchema,
  comparisonPanelJsonSchema,
  type AdaptationJob,
  type FeedbackEvent,
} from "@chezy/contract";
import { getLogger } from "@chezy/observability";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import * as v from "valibot";

import { ADAPTATION_ERRORS, nextStep, type AdaptationStepInput } from "~/lib/adaptation/machine";
import { buildAdaptationPrompt, sanitizeCandidate } from "~/lib/adaptation/prompt";
import type { ValidationContext } from "~/lib/adaptation/validate";
import { ADAPTATION_CANDIDATE_LIMIT, ADAPTATION_DEADLINE_MS } from "~/lib/constants";
import { db } from "~/lib/db/client";
import {
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
const logProviderFailure = (op: "create" | "poll", jobId: string, error: unknown) => {
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

// Applies a machine step: the patch is written with a conditional UPDATE on
// the status the step started from, so concurrent ticks cannot double-apply.
const applyStep = async (
  row: AdaptationJobRow,
  input: AdaptationStepInput,
): Promise<AdaptationJob> => {
  const { patch } = nextStep(row, input);
  if (Object.keys(patch).length === 0) return toAdaptationJob(row);
  const [updated] = await db
    .update(adaptationJob)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(adaptationJob.id, row.id), eq(adaptationJob.status, row.status)))
    .returning();
  return toAdaptationJob(updated ?? (await fetchRow(row.id)) ?? row);
};

export const startAdaptation = async (userId: string, eventId: string): Promise<AdaptationJob> => {
  const event = await getFeedbackEvent(userId, eventId);
  if (!event) throw new AdaptationError("Feedback not found", 404);
  if (event.undoneAt !== null) throw new AdaptationError("Feedback was undone", 409);
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
      status: "queued",
      provider: env.ADAPTATION_MODE === "devin" ? "devin" : "mock",
      deadlineAt: new Date(Date.now() + ADAPTATION_DEADLINE_MS),
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
    return applyStep(claimed, {
      kind: "provider_error",
      message: ADAPTATION_ERRORS.notConfigured,
    });
  }

  const feedback = await listActiveFeedback(row.userId);
  const feed = await buildFeed(profile, undefined, undefined, feedback);
  const candidates = feed.items
    .map((item) => item.listing)
    .filter((item) => item.id !== event.listingId)
    .slice(0, ADAPTATION_CANDIDATE_LIMIT)
    .map(sanitizeCandidate);
  const rejectedRow = await getListingRowById(event.listingId);
  if (!rejectedRow) {
    return applyStep(claimed, {
      kind: "provider_error",
      message: ADAPTATION_ERRORS.provider,
    });
  }

  const client =
    claimed.provider === "devin"
      ? createDevinClient({
          apiKey: env.DEVIN_API_KEY ?? "",
          baseUrl: env.DEVIN_API_BASE_URL,
        })
      : createMockDevinClient({ candidates, event });

  let snapshot: DevinSessionSnapshot;
  try {
    snapshot = await client.createSession({
      title: `Comparison panel ${event.eventId}`,
      prompt: buildAdaptationPrompt({
        event,
        rejected: sanitizeCandidate(rejectedRow),
        candidates,
        schema: comparisonPanelJsonSchema,
        attempt: claimed.attempt,
      }),
      schema: comparisonPanelJsonSchema,
    });
  } catch (error) {
    logProviderFailure("create", claimed.id, error);
    return applyStep(claimed, {
      kind: "provider_error",
      message: providerFailureMessage(error),
    });
  }

  const [updated] = await db
    .update(adaptationJob)
    .set({
      providerSessionId: snapshot.sessionId,
      // oxlint-disable-next-line unicorn/no-null
      providerSessionUrl: snapshot.url ?? null,
      sourceListingIds: candidates.map((candidate) => candidate.id),
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
const pollJob = async (row: AdaptationJobRow, event: FeedbackEvent): Promise<AdaptationJob> => {
  if (!row.providerSessionId) {
    return toAdaptationJob(row);
  }
  const client =
    row.provider === "devin"
      ? devinClient()
      : // The mock keeps its context in a process-global store keyed by
        // session id, so polls do not need the candidates again.
        createMockDevinClient({ candidates: [], event });
  if (!client) {
    return applyStep(row, {
      kind: "provider_error",
      message: ADAPTATION_ERRORS.notConfigured,
    });
  }
  let snapshot: DevinSessionSnapshot;
  try {
    snapshot = await client.getSession(row.providerSessionId);
  } catch (error) {
    logProviderFailure("poll", row.id, error);
    return applyStep(row, { kind: "provider_error", message: providerFailureMessage(error) });
  }
  const ctx: ValidationContext = {
    feedbackEventId: row.feedbackEventId,
    profileVersion: row.profileVersion,
    focus: event.reason,
    sourceListingIds: row.sourceListingIds,
    expectedAttempt: row.attempt,
  };
  return applyStep(row, { kind: "snapshot", snapshot, ctx });
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
    !profile ||
    getProfileVersion(profile) !== row.profileVersion
  ) {
    return applyStep(row, { kind: "stale" });
  }
  if (Date.now() > row.deadlineAt.getTime()) {
    return applyStep(row, { kind: "timeout" });
  }
  if (row.status === "queued") return claimJob(row, event, profile);
  if (row.status === "running") return pollJob(row, event);
  return toAdaptationJob(row);
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

// Newest non-terminal job for an active event; used to resume after reload.
export const getActiveJob = async (userId: string): Promise<AdaptationJob | undefined> => {
  const [row] = await db
    .select({ job: adaptationJob })
    .from(adaptationJob)
    .innerJoin(listingFeedback, activeEventJoin)
    .where(
      and(
        eq(adaptationJob.userId, userId),
        inArray(adaptationJob.status, ["queued", "running", "validating"]),
      ),
    )
    .orderBy(desc(adaptationJob.createdAt))
    .limit(1);
  return row ? toAdaptationJob(row.job) : undefined;
};

export const clearUserAdaptations: DemoUserCleanup = async (transaction, userId) => {
  await transaction.delete(adaptationJob).where(eq(adaptationJob.userId, userId));
};
