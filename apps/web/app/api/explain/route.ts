import * as v from "valibot";

import { auth } from "~/app/(auth)/auth";
import { explainMatch } from "~/lib/ai/explain";
import { GroundedExplanationSchema } from "~/lib/ai/explanation-contract";
import { getProfile } from "~/lib/profile";

const RequestSchema = v.strictObject({
  listingId: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
});

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = v.safeParse(RequestSchema, body);
  if (!parsed.success) {
    return Response.json({ error: "invalid explanation request" }, { status: 400 });
  }
  try {
    const profile = await getProfile(session.user.id);
    const explanation = await explainMatch(parsed.output.listingId, profile);
    if (!explanation) {
      return Response.json({ error: "listing not found" }, { status: 404 });
    }
    return Response.json(v.parse(GroundedExplanationSchema, explanation), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json({ error: "explanation unavailable" }, { status: 503 });
  }
}
