// Write-through from the chat scratchpad (User.profile) to SearchProfile, the
// matching store the scorer and JES-8 feedback read. Server-only: imports db
// code via lib/profile.
import type { UserProfile } from "@chezy/contract";

import type { SearchProfile } from "~/lib/db/schema";
import { upsertProfile } from "~/lib/profile";
import { missingProfileFields, userProfileToSearchProfileInput } from "~/lib/user-profile";

// Returns undefined while onboarding is incomplete; otherwise upserts the
// SearchProfile row for this user. upsertProfile mirrors the coarse fields
// back into User.profile, which is idempotent.
export const syncSearchProfile = async (
  userId: string,
  profile: UserProfile,
): Promise<SearchProfile | undefined> => {
  if (missingProfileFields(profile).length > 0) {
    return undefined;
  }
  return upsertProfile(userId, userProfileToSearchProfileInput(profile));
};
