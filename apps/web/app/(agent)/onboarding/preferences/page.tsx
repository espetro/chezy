import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/app/(auth)/auth";
import { PreferencesForm } from "@/components/agent/preferences-form";
import { DISTRICT_CHIPS } from "@/lib/neighbourhoods";
import { countRentCandidates } from "@/lib/listings";
import type { SearchProfileInput } from "@chezy/contract";
import { getProfile } from "@/lib/profile";

const DEFAULTS: SearchProfileInput = {
  workAddress: "Diagonal 405 (Paseo de Gràcia), BCN",
  maxCommuteMin: 25,
  neighbourhoods: ["Eixample", "Gràcia"],
  minPriceEur: 1200,
  maxPriceEur: 2500,
  minRooms: 2,
  minM2: 50,
  moveDate: null,
  flexibleDays: 0,
  mustHaves: ["exterior", "balcony_or_terrace", "elevator"],
  redLines: ["no_interior", "no_high_deposit", "no_flatmates"],
  alertsEnabled: true,
};

export default function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ barrio?: string }>;
}) {
  return (
    <Suspense>
      <Preferences searchParams={searchParams} />
    </Suspense>
  );
}

async function Preferences({
  searchParams,
}: {
  searchParams: Promise<{ barrio?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/guest?redirectUrl=/onboarding/preferences");
  }

  const { barrio } = await searchParams;
  const profile = await getProfile(session.user.id);

  const initial: SearchProfileInput = profile
    ? {
        workAddress: profile.workAddress,
        maxCommuteMin: profile.maxCommuteMin,
        neighbourhoods: profile.neighbourhoods,
        minPriceEur: profile.minPriceEur,
        maxPriceEur: profile.maxPriceEur,
        minRooms: profile.minRooms,
        minM2: profile.minM2,
        moveDate: profile.moveDate,
        flexibleDays: profile.flexibleDays,
        mustHaves: profile.mustHaves as SearchProfileInput["mustHaves"],
        redLines: profile.redLines as SearchProfileInput["redLines"],
        alertsEnabled: profile.alertsEnabled,
      }
    : { ...DEFAULTS, neighbourhoods: [...DEFAULTS.neighbourhoods] };

  // The landing CTA forwards its input as ?barrio=: preselect it when it
  // names a district chip (or any plausible place name, but never an email).
  if (barrio && !barrio.includes("@")) {
    const match = DISTRICT_CHIPS.find(
      (c) =>
        c.label.toLowerCase() === barrio.toLowerCase() ||
        c.value.toLowerCase() === barrio.toLowerCase(),
    );
    const value = match?.value ?? barrio;
    if (!initial.neighbourhoods.includes(value)) {
      initial.neighbourhoods = [...initial.neighbourhoods, value];
    }
  }

  const initialCount = await countRentCandidates({
    neighbourhoods: initial.neighbourhoods,
    maxPriceEur: initial.maxPriceEur,
    minRooms: initial.minRooms,
    minM2: initial.minM2,
  });

  return (
    <PreferencesForm initial={initial} initialCount={initialCount} />
  );
}
