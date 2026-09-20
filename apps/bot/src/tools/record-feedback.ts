// `recordListingFeedback` — no apps/web counterpart exists, so this Mastra
// tool records the verdict in `bot.listing_feedback` and folds the signal into
// the user's freeformRequirements so later searches stay honest.
import { createTool } from "@mastra/core/tools";
import { toStandardJsonSchema } from "@valibot/to-json-schema";
import * as v from "valibot";

import { client } from "~/lib/db/client";
import { getUserByUsername, updateUserProfile } from "~/lib/db/queries";
import { mergeUserProfile } from "~/lib/user-profile";

import { usernameFromContext } from "./adapt";

export const recordListingFeedbackInput = v.object({
  listingId: v.pipe(v.string(), v.minLength(1)),
  verdict: v.picklist(["like", "dislike", "maybe"]),
  note: v.optional(v.string()),
});

export const recordListingFeedback = createTool({
  id: "recordListingFeedback",
  description:
    "Record the user's reaction to a listing (like, dislike or maybe) with an optional reason. Call it whenever the user reacts to a specific listing so their profile learns what to look for.",
  inputSchema: toStandardJsonSchema(recordListingFeedbackInput),
  execute: async (input, ctx) => {
    const username = usernameFromContext(ctx.requestContext);

    await client.unsafe(
      `INSERT INTO bot.listing_feedback (username, listing_id, verdict, note)
       VALUES ($1, $2, $3, $4)`,
      [username, input.listingId, input.verdict, input.note ?? null],
    );

    const user = await getUserByUsername(username);
    if (user) {
      const reaction = `feedback:${input.verdict}:${input.listingId}${input.note ? ` — ${input.note}` : ""}`;
      const merged = mergeUserProfile(user.profile ?? {}, {
        freeformRequirements: [reaction],
      });
      await updateUserProfile({ userId: user.id, profile: merged });
    }

    return { recorded: true, listingId: input.listingId, verdict: input.verdict };
  },
});
