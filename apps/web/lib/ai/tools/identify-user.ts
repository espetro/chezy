import { identifyUserInputSchema } from "@chezy/contract";
import { tool } from "ai";
import { valibotSchema } from "@ai-sdk/valibot";
import { createNamedUser, getUserByUsername } from "@/lib/db/queries";
import { missingProfileFields, normalizeUsername } from "@/lib/user-profile";

export const identifyUser = tool({
  description:
    "Resolve the user's identity. You MUST call this immediately when the user names or identifies themselves (e.g. \"I'm user X\", \"I'm X\", \"my name is X\"), before doing anything else. Finds or creates the user and returns their saved profile plus which required fields are still missing.",
  execute: async (input) => {
    const username = normalizeUsername(input.username);

    if (!username) {
      return {
        error:
          "The provided name could not be normalized into a valid username. Please ask the user for a simpler name (letters, numbers, dots, dashes).",
      };
    }

    const existingUser = await getUserByUsername(username);

    if (existingUser) {
      return {
        userId: existingUser.id,
        username,
        profile: existingUser.profile,
        missingFields: missingProfileFields(existingUser.profile),
        isNewUser: false,
      };
    }

    const createdUser = await createNamedUser(username);

    return {
      userId: createdUser.id,
      username,
      profile: null,
      missingFields: missingProfileFields(null),
      isNewUser: true,
    };
  },
  inputSchema: valibotSchema(identifyUserInputSchema),
});
