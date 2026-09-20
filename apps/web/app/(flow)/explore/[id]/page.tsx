import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "~/app/(auth)/auth";
import { MatchDetail } from "~/components/flow/match/MatchDetail";
import { toFlowListing } from "~/lib/flow/adapters";
import { getListingRowById } from "~/lib/listings";
import { scoreListing } from "~/lib/match";
import { getProfile } from "~/lib/profile";
import { listActiveFeedback } from "~/lib/feedback";
import { getProfileVersion } from "~/lib/profile-version";

interface ExploreDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function ExploreDetailPage({ params }: ExploreDetailPageProps) {
  return (
    <Suspense>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: ExploreDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/guest?redirectUrl=/explore");
  }

  const { id } = await params;
  const row = await getListingRowById(decodeURIComponent(id));
  if (!row) notFound();

  const profile = await getProfile(session.user.id);
  const feedback = await listActiveFeedback(session.user.id);
  if (feedback.some((event) => event.listingId === row.id)) redirect("/explore");
  const match = profile ? scoreListing(profile, row) : { score: 0, reasons: [] };

  return (
    <MatchDetail
      listing={toFlowListing(row, match, profile)}
      explanation={{
        listing: {
          id: row.id,
          priceEur: row.priceEur,
          pricePeriod: row.pricePeriod,
          rooms: row.rooms,
          builtM2: row.builtM2,
          amenities: row.amenities,
        },
        matchScore: match.score,
        preferences: profile
          ? {
              maxPriceEur: profile.maxPriceEur,
              minRooms: profile.minRooms,
              minM2: profile.minM2,
            }
          : undefined,
        profileKey: `${session.user.id}:${profile ? getProfileVersion(profile) : "no-profile"}`,
      }}
    />
  );
}
