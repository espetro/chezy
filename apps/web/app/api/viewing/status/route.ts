import { auth } from "~/app/(auth)/auth";
import { getLatestViewing } from "~/lib/db/queries";
import { env } from "~/lib/env";

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
