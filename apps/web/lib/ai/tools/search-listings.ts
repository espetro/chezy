import { valibotSchema } from "@ai-sdk/valibot";
import { tool } from "ai";
import * as v from "valibot";

import { searchListings } from "@/lib/listings";

export const searchListingsTool = tool({
  description:
    "Search Barcelona rental and sale listings. Use it whenever the user describes what home they want (area, budget, rooms, rent vs buy). Returns up to 10 listings.",
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
