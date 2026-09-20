import { CapabilityOutputSchema } from "@chezy/contract";
import * as v from "valibot";
import { auth } from "~/app/(auth)/auth";
import { refreshCapabilityJob } from "~/lib/capability/jobs";

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
    const capability = await refreshCapabilityJob(session.user.id, jobId);
    if (!capability) return Response.json({ error: "job not found" }, { status: 404 });
    return Response.json(v.parse(CapabilityOutputSchema, { capability }), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json({ error: "Couldn't check the capability forge." }, { status: 500 });
  }
};
