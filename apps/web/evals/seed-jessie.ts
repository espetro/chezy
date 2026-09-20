// Seeds the demo persona "jessie" with a fully onboarded profile so evals and
// red-teaming exercise the saved-profile path. Idempotent: upserts the user and
// merges the fixture profile.
//
//   mise run eval:seed
import { createNamedUser, getUserByUsername, updateUserProfile } from "~/lib/db/queries";
import { mergeUserProfile, missingProfileFields } from "~/lib/user-profile";

import { jessie } from "./fixtures/jessie";

async function main() {
  const existing = await getUserByUsername("jessie");
  const user = existing ?? (await createNamedUser("jessie"));

  const merged = mergeUserProfile(existing?.profile ?? {}, jessie);
  // mergeUserProfile deliberately drops onboardedAt; restore it so the profile
  // counts as fully onboarded.
  merged.onboardedAt = jessie.onboardedAt;
  await updateUserProfile({ userId: user.id, profile: merged });

  const missing = missingProfileFields(merged);
  if (missing.length > 0) {
    throw new Error(`jessie profile incomplete after seed: ${missing.join(", ")}`);
  }
  console.log(`jessie seeded: id=${user.id} onboardedAt=${merged.onboardedAt}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
