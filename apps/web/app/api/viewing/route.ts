import { createHash } from "node:crypto";
import { ViewingRequestSchema, ViewingResultSchema, type ViewingResult } from "@chezy/contract";
import { getLogger } from "@chezy/observability";
import * as v from "valibot";

import { auth } from "~/app/(auth)/auth";
import { nextSlotIso } from "~/lib/calendar";
import { env } from "~/lib/env";
import { getListingInsights, insightsToCallVariables } from "~/lib/insights";
import { getListingById, listingToCallVariables } from "~/lib/listings";
import { dispatchSlngCall } from "~/lib/slng";
import { CallDispatchError, createDispatchReceipts } from "~/lib/viewing-dispatch";
import { placeVonageCall } from "~/lib/vonage";

const dispatchOnce = createDispatchReceipts();
const logger = getLogger(["chezy", "viewing"]);
const PhoneSchema = v.pipe(v.string(), v.regex(/^\+[1-9]\d{5,14}$/));

function respond(result: ViewingResult, status = 200): Response {
  return Response.json(v.parse(ViewingResultSchema, result), {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function fail(detail: string, status: number): Response {
  return respond({ status: "failed", channel: env.VIEWING_MODE, retryable: true, detail }, status);
}

export async function POST(request: Request): Promise<Response> {
  const started = performance.now();
  const requestedAt = new Date().toISOString();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body.", 400);
  }

  const parsed = v.safeParse(ViewingRequestSchema, body);
  if (!parsed.success) {
    return fail("Invalid viewing request.", 400);
  }
  const input = parsed.output;
  if (!input.live) {
    return respond({
      status: "mock",
      channel: "mock",
      slotIso: nextSlotIso(input.slotHint),
      detail: "Simulated viewing only. No phone call or calendar booking was made.",
    });
  }
  const channel = env.VIEWING_MODE;
  if (channel === "mock" || env.VIEWING_LIVE_ENABLED !== "true") {
    return fail("Live calls are disabled. Use the simulation or contact the demo operator.", 403);
  }
  const to = v.safeParse(PhoneSchema, env.DEMO_AGENCY_PHONE);
  if (!to.success || (input.agencyPhone && input.agencyPhone !== to.output)) {
    return fail(
      "Live calls require the configured team test target; other targets are blocked.",
      400,
    );
  }
  if (!input.requestId) {
    return fail("Live calls require a request ID for safe retries.", 400);
  }
  const session = await auth();
  if (!session?.user?.id) {
    return fail("Sign in before requesting a live demo call.", 401);
  }
  if (channel === "slng" && (!env.SLNG_API_KEY || !env.SLNG_AGENT_ID)) {
    return fail("SLNG credentials are not configured.", 503);
  }
  if (
    channel === "vonage" &&
    (!env.VONAGE_APPLICATION_ID ||
      !env.VONAGE_FROM_NUMBER ||
      !(env.VONAGE_PRIVATE_KEY || env.VONAGE_PRIVATE_KEY_PATH))
  ) {
    return fail("Vonage credentials are not configured.", 503);
  }

  const result = await dispatchOnce(
    `${session.user.id}:${input.requestId}`,
    JSON.stringify([channel, input.propertyRef, to.output]),
    channel,
    async () => {
      try {
        let callId: string;
        if (channel === "slng") {
          const context = await Promise.all([
            getListingById(input.propertyRef),
            getListingInsights(input.propertyRef),
          ]).catch(() => {
            throw new CallDispatchError("Listing context unavailable", true);
          });
          const [summary, insights] = context;
          const dispatched = await dispatchSlngCall({
            to: to.output,
            variables: summary
              ? {
                  ...listingToCallVariables(summary),
                  ...(insights ? insightsToCallVariables(insights) : {}),
                }
              : { property_ref: input.propertyRef },
          });
          callId = dispatched.callId;
        } else {
          const dispatched = await placeVonageCall({
            to: to.output,
            ncco: [
              {
                action: "talk",
                text: "Hola, llamo por el piso. Quisiera reservar una visita.",
                language: "es-ES",
              },
            ],
          });
          callId = dispatched.uuid;
        }
        if (typeof callId !== "string" || callId.trim().length === 0) {
          throw new CallDispatchError("Provider returned no call ID", false);
        }
        return v.parse(ViewingResultSchema, {
          status: "dispatched",
          channel,
          callId: `redacted:${createHash("sha256").update(callId).digest("hex").slice(0, 12)}`,
          requestedAt,
          dispatchedAt: new Date().toISOString(),
          latencyMs: Math.round(performance.now() - started),
          detail: "Call requested / awaiting agency confirmation.",
        });
      } catch (error) {
        logger.error("viewing dispatch failed ({channel}) for {propertyRef}: {detail}", {
          channel,
          propertyRef: input.propertyRef,
          requestId: input.requestId,
          retryable: error instanceof CallDispatchError && error.retryable,
          detail: (error instanceof Error ? error.message : String(error)).replaceAll(
            to.output,
            "[redacted]",
          ),
        });
        throw error;
      }
    },
    input.retry,
  );
  return respond(result, result.status === "failed" ? 502 : 200);
}
