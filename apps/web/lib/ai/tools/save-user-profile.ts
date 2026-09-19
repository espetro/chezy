import { saveUserProfileInputSchema } from "@chezy/contract";
import { tool } from "ai";
import { valibotSchema } from "@/lib/ai/valibot-schema";
import {
  createNamedUser,
  getUserByUsername,
  updateUserProfile,
} from "@/lib/db/queries";
import {
  mergeUserProfile,
  missingProfileFields,
  normalizeUsername,
} from "@/lib/user-profile";

export const saveUserProfile = tool({
  description:
    "Save onboarding answers to the user's profile. Call this as soon as the user answers an onboarding question — the patch only needs the fields the user just provided (e.g. { budgetMaxEur: 1500 }). freeformRequirements accumulate across calls. Do not set onboardedAt; it is set automatically once the profile is complete.",
  execute: async (input) => {
    const username = normalizeUsername(input.username);

    if (!username) {
      return {
        error:
          "The provided name could not be normalized into a valid username. Please ask the user for a simpler name (letters, numbers, dots, dashes).",
      };
    }

    const existingUser = await getUserByUsername(username);
    const userId = existingUser
      ? existingUser.id
      : (await createNamedUser(username)).id;

    const merged = mergeUserProfile(existingUser?.profile ?? {}, input.patch);

    const missingFields = missingProfileFields(merged);

    if (missingFields.length === 0 && !merged.onboardedAt) {
      merged.onboardedAt = new Date().toISOString();
    }

    await updateUserProfile({ userId, profile: merged });

    return {
      userId,
      username,
      profile: merged,
      missingFields,
    };
  },
  inputSchema: valibotSchema(saveUserProfileInputSchema),
});
