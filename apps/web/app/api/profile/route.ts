import { SearchProfileInputSchema, VerifyProfileInputSchema } from "@chezy/contract";
import * as v from "valibot";

import { auth } from "~/app/(auth)/auth";
import { geocodeWorkAddress } from "~/lib/geocode";
import { getProfile, markVerified, upsertProfile } from "~/lib/profile";

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const profile = await getProfile(session.user.id);
  if (!profile) {
    return Response.json({ error: "profile not found" }, { status: 404 });
  }
  return Response.json({ profile });
}

export async function PUT(request: Request): Promise<Response> {
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

  const parsed = v.safeParse(SearchProfileInputSchema, body);
  if (!parsed.success) {
    return Response.json({ error: "invalid profile", issues: parsed.issues }, { status: 400 });
  }
  const input = parsed.output;

  const geocode = geocodeWorkAddress(input.workAddress);
  const profile = await upsertProfile(session.user.id, {
    ...input,
    workLat: geocode.point.lat,
    workLon: geocode.point.lon,
  });
  return Response.json({
    profile,
    geocode: { label: geocode.label, approximate: geocode.approximate },
  });
}

export async function PATCH(request: Request): Promise<Response> {
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

  const parsed = v.safeParse(VerifyProfileInputSchema, body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid verification payload", issues: parsed.issues },
      { status: 400 },
    );
  }

  const profile = await getProfile(session.user.id);
  if (!profile) {
    return Response.json({ error: "profile not found" }, { status: 404 });
  }
  await markVerified(session.user.id);
  return Response.json({ verified: true });
}
