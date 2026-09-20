import * as v from "valibot";
import { auth } from "~/app/(auth)/auth";
import { AdaptationError, advanceAdaptation } from "~/lib/adaptation/runner";

const JobIdSchema = v.pipe(v.string(), v.uuid());

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) => {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { jobId } = await params;
  if (!v.is(JobIdSchema, jobId)) {
    return Response.json({ error: "job not found" }, { status: 404 });
  }
  try {
    const job = await advanceAdaptation(session.user.id, jobId);
    if (!job) return Response.json({ error: "job not found" }, { status: 404 });
    return Response.json({ job }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AdaptationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Couldn't check the comparison." }, { status: 500 });
  }
};
