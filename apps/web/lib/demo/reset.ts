import { eq } from "drizzle-orm";

import { db } from "~/lib/db/client";
import { user } from "~/lib/db/schema";
import { DEMO_PERSONA } from "~/lib/demo/persona";
import { geocodeWorkAddress } from "~/lib/geocode";
import { resetProfile, upsertProfile } from "~/lib/profile";

export type DemoResetTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DemoUserCleanup = (transaction: DemoResetTransaction, userId: string) => Promise<void>;

export const demoUserCleanups: readonly DemoUserCleanup[] = [];

export const resetDemo = async (
  userId: string,
  loadPersona: boolean,
  cleanups: readonly DemoUserCleanup[] = demoUserCleanups,
) =>
  db.transaction(async (transaction) => {
    const [identity] = await transaction
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    if (!identity) throw new Error("Demo identity no longer exists");

    for (const cleanup of cleanups) await cleanup(transaction, userId);
    await resetProfile(userId, transaction);

    if (!loadPersona) return {};
    const { point } = geocodeWorkAddress(DEMO_PERSONA.workAddress);
    const profile = await upsertProfile(
      userId,
      { ...DEMO_PERSONA, workLat: point.lat, workLon: point.lon },
      transaction,
    );
    return { profile };
  });
