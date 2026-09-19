import { valibotSchema } from "@ai-sdk/valibot";
import { tool } from "ai";
import { eq } from "drizzle-orm";
import * as v from "valibot";

import { db } from "~/lib/db/client";
import { listing } from "~/lib/db/schema";
import { getListingInsights, selectPhotos } from "~/lib/insights";

export const getListingInsightsTool = tool({
  description:
    "Fetch photo-derived insights for one listing by id (format platform:platform_id): condition, flooring, ceiling, windows, light, outdoor spaces, kitchen, furnishing, style and trust flags, plus the evidence photo urls.",
  inputSchema: valibotSchema(v.object({ id: v.string() })),
  execute: async ({ id }) => {
    const insights = await getListingInsights(id);
    if (!insights) {
      return { id, error: "no insights stored for this listing" };
    }
    const rows = await db.select().from(listing).where(eq(listing.id, id));
    const row = rows[0];
    const photos = row ? await selectPhotos(row) : [];
    const urls = (indexes: number[]) =>
      indexes.map((i) => photos[i]?.url).filter((u): u is string => Boolean(u));
    return {
      id,
      insights,
      evidencePhotos: {
        flooring: urls(insights.flooring.evidence),
        ceiling: urls(insights.ceiling.evidence),
        windows: urls(insights.windows.evidence),
      },
    };
  },
});
