import { valibotSchema } from "@ai-sdk/valibot";
import { tool } from "ai";
import * as v from "valibot";

import { searchListings } from "~/lib/listings";

export const searchListingsTool = tool({
  description:
    "Search Barcelona rental and sale listings (all listings are in Barcelona). Call it ONCE per user request with structured filters (operation, maxPriceEur, minRooms) and optionally `query` for a specific neighbourhood/district name in Spanish/Catalan (e.g. 'Gràcia', 'Eixample') or a Spanish feature word ('terraza', 'ascensor') — never city names or English words. If nothing matches exactly, the tool automatically relaxes price, then rooms, then area, and reports what it relaxed in `relaxed` and `note`, so never retry yourself. Returns { listings, total, relaxed, note }.",
  inputSchema: valibotSchema(
    v.object({
      operation: v.optional(v.picklist(["rent", "sale"])),
      query: v.optional(v.string()),
      minPriceEur: v.optional(v.number()),
      maxPriceEur: v.optional(v.number()),
      minRooms: v.optional(v.number()),
      limit: v.optional(v.number()),
    })
  ),
  execute: (input) => searchListings(input),
});
