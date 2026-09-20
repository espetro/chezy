import { SavedInputSchema } from "@chezy/contract";
import * as v from "valibot";
import { auth } from "~/app/(auth)/auth";
import { isSameOrigin } from "~/lib/request-origin";
import { listSavedListingIds, SavedError, setSaved } from "~/lib/saved";

export const GET = async () => {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(
    { listingIds: await listSavedListingIds(session.user.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
};

export const PUT = async (request: Request) => {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) {
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
  const parsed = v.safeParse(SavedInputSchema, body);
  if (!parsed.success) return Response.json({ error: "invalid save" }, { status: 400 });
  try {
    const { listingId, saved } = parsed.output;
    return Response.json({ listingId, saved: await setSaved(session.user.id, listingId, saved) });
  } catch (error) {
    if (error instanceof SavedError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Couldn't save the listing. Please retry." }, { status: 500 });
  }
};
