import { valibotSchema } from "@ai-sdk/valibot";
import { tool } from "ai";
import * as v from "valibot";

import { getListingById } from "@/lib/listings";

export const getListingTool = tool({
  description:
    "Fetch one listing by id (format platform:platform_id) to show details or before booking a viewing.",
  inputSchema: valibotSchema(v.object({ id: v.string() })),
  execute: async ({ id }) => (await getListingById(id)) ?? { error: "not found" },
});
