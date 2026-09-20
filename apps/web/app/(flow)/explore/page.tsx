import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "~/app/(auth)/auth";
import { ExploreFeed } from "~/components/flow/explore/ExploreFeed";
import { getActiveJob, getLatestAcceptedPanel } from "~/lib/adaptation/runner";
import { resolvePanel } from "~/lib/adaptation/resolve";
import { buildFeed } from "~/lib/feed";
import { toFlowListing } from "~/lib/flow/adapters";
import { getProfile } from "~/lib/profile";
import { listActiveFeedback } from "~/lib/feedback";

export default function ExplorePage() {
  return (
    <Suspense>
      <Explore />
    </Suspense>
  );
}

async function Explore() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/guest?redirectUrl=/explore");
  }

  const profile = await getProfile(session.user.id);
  if (!profile) {
    redirect("/onboarding");
  }

  const [feedback, accepted, active] = await Promise.all([
    listActiveFeedback(session.user.id),
    getLatestAcceptedPanel(session.user.id),
    getActiveJob(session.user.id),
  ]);
  const feed = await buildFeed(profile, undefined, undefined, feedback);
  const listings = feed.items.map(({ listing, match }) => toFlowListing(listing, match, profile));

  return (
    <ExploreFeed
      key={session.user.id}
      listings={listings}
      note={feed.note}
      feedback={feedback}
      panel={
        accepted
          ? { panel: resolvePanel(accepted.spec, accepted.rows), job: accepted.job }
          : undefined
      }
      job={active}
    />
  );
}
