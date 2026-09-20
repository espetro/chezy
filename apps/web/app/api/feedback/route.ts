import { FeedbackInputSchema, FeedbackUndoInputSchema } from "@chezy/contract";
import * as v from "valibot";
import { auth } from "~/app/(auth)/auth";
import { FeedbackError, listActiveFeedback, recordFeedback, undoFeedback } from "~/lib/feedback";

export const GET = async () => {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(
    { events: await listActiveFeedback(session.user.id) },
    {
      headers: { "Cache-Control": "private, no-store" },
    },
  );
};

const mutate = async (request: Request, undo: boolean) => {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "invalid origin" }, { status: 403 });
  }
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return Response.json({ error: "expected application/json" }, { status: 415 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  try {
    if (undo) {
      const parsed = v.safeParse(FeedbackUndoInputSchema, body);
      if (!parsed.success) return Response.json({ error: "invalid feedback" }, { status: 400 });
      return Response.json({ event: await undoFeedback(session.user.id, parsed.output.eventId) });
    }
    const parsed = v.safeParse(FeedbackInputSchema, body);
    if (!parsed.success) return Response.json({ error: "invalid feedback" }, { status: 400 });
    return Response.json({ event: await recordFeedback(session.user.id, parsed.output) });
  } catch (error) {
    if (error instanceof FeedbackError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Couldn't save feedback. Please retry." }, { status: 500 });
  }
};

export const POST = (request: Request) => mutate(request, false);
export const DELETE = (request: Request) => mutate(request, true);
