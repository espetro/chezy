import { getLogger } from "@chezy/observability";

import { auth } from "~/app/(auth)/auth";
import { LIVE_CALL_END_GRACE_MS } from "~/lib/constants";
import { getLatestViewing, updateViewingStatus } from "~/lib/db/queries";
import { env } from "~/lib/env";
import { getSlngCall } from "~/lib/slng";
import type { SlngTranscriptLine } from "~/lib/slng";

const logger = getLogger(["chezy", "viewing"]);

// Polled by the flow gate while a live call is in progress. The row is
// inserted by POST /api/viewing on dispatch and marked booked when the SLNG
// book_viewing tool hits /api/calendar; those are the only two live signals.
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const propertyRef = new URL(request.url).searchParams.get("propertyRef");
  if (!propertyRef) {
    return Response.json({ error: "propertyRef is required" }, { status: 400 });
  }
  const row = await getLatestViewing({ userId: session.user.id, listingId: propertyRef });
  if (
    row?.status === "dispatched" &&
    row.channel === "slng" &&
    row.callId &&
    env.SLNG_API_KEY &&
    env.SLNG_AGENT_ID
  ) {
    const call = await getSlngCall(row.callId).catch(() => undefined);
    if (call) {
      const stage = call.toolNames.length > 0 ? 3 : call.answered ? 2 : call.startedAt ? 1 : 0;
      const transcript: SlngTranscriptLine[] = call.transcript;
      const endedAt = call.endedAt ? Date.parse(call.endedAt) : Number.NaN;
      const endTimestamp = Number.isFinite(endedAt) ? endedAt : Date.now();
      if (call.status !== "in_progress" && Date.now() - endTimestamp > LIVE_CALL_END_GRACE_MS) {
        const failed = await updateViewingStatus({ id: row.id, status: "failed" });
        logger.info("SLNG call ended without booking for {propertyRef}: {endReason}", {
          propertyRef,
          endReason: call.endReason,
        });
        return Response.json(
          {
            status: "failed",
            calendarChannel: env.CALENDAR_MODE,
            updatedAt: failed.updatedAt.toISOString(),
            detail:
              call.status === "failed"
                ? "The agency call could not be completed."
                : "The agency call ended without a booking.",
            ...(transcript.length > 0 ? { transcript } : {}),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      return Response.json(
        {
          status: row.status,
          slotIso: row.slotIso ?? undefined,
          calendarChannel: env.CALENDAR_MODE,
          updatedAt: row.updatedAt.toISOString(),
          stage,
          ...(transcript.length > 0 ? { transcript } : {}),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  return Response.json(
    row
      ? {
          status: row.status,
          slotIso: row.slotIso ?? undefined,
          calendarChannel: env.CALENDAR_MODE,
          updatedAt: row.updatedAt.toISOString(),
        }
      : { status: "none" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
