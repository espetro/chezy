import * as v from "valibot";

import { auth } from "~/app/(auth)/auth";
import { isDemoRehearsalSafe, isDemoResetEnabled } from "~/lib/demo/access";
import { resetDemo } from "~/lib/demo/reset";

const ResetInput = v.strictObject({ loadPersona: v.boolean() });

export async function POST(request: Request): Promise<Response> {
  if (!isDemoResetEnabled()) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "invalid origin" }, { status: 403 });
  }
  if (!isDemoRehearsalSafe()) {
    return Response.json(
      { error: "Set VIEWING_MODE=mock and CALENDAR_MODE=mock before resetting the demo." },
      { status: 409 },
    );
  }
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return Response.json({ error: "expected application/json" }, { status: 415 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = v.safeParse(ResetInput, body);
  if (!parsed.success) {
    return Response.json({ error: "invalid reset request" }, { status: 400 });
  }

  try {
    const result = await resetDemo(session.user.id, parsed.output.loadPersona);
    return Response.json({ reset: true, ...result });
  } catch {
    return Response.json({ error: "Couldn't reset the demo. Please retry." }, { status: 500 });
  }
}
