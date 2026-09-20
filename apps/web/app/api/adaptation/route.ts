import { AdaptationInputSchema } from "@chezy/contract";
import * as v from "valibot";
import { auth } from "~/app/(auth)/auth";
import { AdaptationError, startAdaptation } from "~/lib/adaptation/runner";

export const POST = async (request: Request) => {
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
  const parsed = v.safeParse(AdaptationInputSchema, body);
  if (!parsed.success) return Response.json({ error: "invalid adaptation" }, { status: 400 });
  try {
    const job = await startAdaptation(session.user.id, parsed.output.eventId);
    return Response.json({ job }, { status: 202 });
  } catch (error) {
    if (error instanceof AdaptationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json(
      { error: "Couldn't start the comparison. Please retry." },
      { status: 500 },
    );
  }
};
