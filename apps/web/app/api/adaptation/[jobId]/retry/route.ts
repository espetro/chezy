import * as v from "valibot";
import { auth } from "~/app/(auth)/auth";
import { AdaptationError, retryAdaptation } from "~/lib/adaptation/runner";

const JobIdSchema = v.pipe(v.string(), v.uuid());

// A deliberate new attempt after a terminal failure. Refreshing the page never
// reaches this route; only the "Try again" control does.
export const POST = async (
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) => {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "invalid origin" }, { status: 403 });
  }
  const { jobId } = await params;
  if (!v.is(JobIdSchema, jobId)) {
    return Response.json({ error: "job not found" }, { status: 404 });
  }
  try {
    const job = await retryAdaptation(session.user.id, jobId);
    return Response.json(
      { job },
      { status: 202, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof AdaptationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Couldn't retry the comparison." }, { status: 500 });
  }
};
