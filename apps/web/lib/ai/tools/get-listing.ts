import { valibotSchema } from "@ai-sdk/valibot";
import { tool } from "ai";
import * as v from "valibot";

import { ensureListingInsights } from "~/lib/insights";
import { getListingById } from "~/lib/listings";

export const getListingTool = tool({
  description:
    "Fetch one listing by id (format platform:platform_id) to show details or before booking a viewing. Returns photo-derived insights (condition, flooring, light, windows, outdoor, trust flags) when available.",
  inputSchema: valibotSchema(v.object({ id: v.string() })),
  execute: async ({ id }) => {
    const summary = await getListingById(id);
    if (!summary) {
      return { error: "not found" };
    }
    const insights = await ensureListingInsights(id).catch(() => undefined);
    return { ...summary, insights };
  },
});
