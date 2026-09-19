import { valibotSchema } from "@ai-sdk/valibot";
import { tool } from "ai";
import * as v from "valibot";

import { searchListings } from "@/lib/listings";

export const searchListingsTool = tool({
  description:
    "Search Barcelona rental and sale listings (all listings are in Barcelona). Call it once per user request with structured filters (operation, maxPriceEur, minRooms). `query` is a substring match against Spanish/Catalan title, district, neighbourhood and description — use it only for a specific neighbourhood/district name (e.g. 'Gràcia', 'Eixample') or a Spanish feature word (e.g. 'terraza', 'ascensor'); never pass city names or English words. Returns up to 10 listings.",
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
  execute: searchListings,
});
