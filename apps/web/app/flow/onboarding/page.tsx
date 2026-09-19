import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/app/(auth)/auth";
import { OnboardingFlow } from "@/components/flow/onboarding/OnboardingFlow";
import { fromSearchProfile } from "@/lib/flow/adapters";
import { defaultPreferences } from "@/lib/flow/onboarding-steps";
import { countRentCandidates } from "@/lib/listings";
import { getProfile } from "@/lib/profile";

export default function OnboardingPage() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}

async function Onboarding() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/guest?redirectUrl=/flow/onboarding");
  }

  const profile = await getProfile(session.user.id);
  const initial = profile ? fromSearchProfile(profile) : undefined;
  const shown = initial ?? defaultPreferences;

  const initialCount = await countRentCandidates({
    neighbourhoods: shown.zones.length > 0 ? shown.zones : undefined,
    maxPriceEur: shown.budgetMax,
    minRooms: shown.rooms,
    minM2: shown.sizeMin,
  });

  return <OnboardingFlow initial={initial} initialCount={initialCount} />;
}
