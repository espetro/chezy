import * as v from "valibot";

import { auth } from "@/app/(auth)/auth";
import { countRentCandidates } from "@/lib/listings";

const CountQuerySchema = v.object({
  maxPriceEur: v.optional(v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number))),
  minRooms: v.optional(v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number))),
  minM2: v.optional(v.pipe(v.string(), v.regex(/^\d+$/), v.transform(Number))),
  neighbourhoods: v.optional(v.string()),
});

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = v.safeParse(CountQuerySchema, params);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid count query", issues: parsed.issues },
      { status: 400 },
    );
  }
  const { neighbourhoods, ...ints } = parsed.output;
  const count = await countRentCandidates({
    ...ints,
    neighbourhoods: neighbourhoods
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });
  return Response.json({ count });
}
