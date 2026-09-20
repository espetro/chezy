import Link from "next/link";
import { AgentCallGate } from "~/components/flow/match/AgentCallGate";
import { InsightPanel } from "~/components/flow/match/InsightPanel";
import type { MatchExplanationProps } from "~/components/flow/match/MatchExplanation";
import { NeighborhoodProfile } from "~/components/flow/match/NeighborhoodProfile";
import { FlowCard } from "~/components/flow/ui/Card";
import { FlowReveal } from "~/components/flow/ui/FlowMotion";
import { FlowPill } from "~/components/flow/ui/Pill";
import { FlowScoreBadge } from "~/components/flow/ui/ScoreBadge";
import type { FlowListing } from "~/lib/flow/types";

interface MatchDetailProps {
  listing: FlowListing;
  explanation: MatchExplanationProps;
}

export const MatchDetail = ({ listing, explanation }: MatchDetailProps) => {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-4 px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:gap-5 sm:px-6 sm:pt-6 md:max-w-[960px] md:pb-10 lg:max-w-[1180px] lg:gap-4 lg:pt-5 lg:pb-6">
      <Link
        href="/explore"
        className="inline-flex min-h-10 w-fit items-center rounded-lg text-[13px] text-fog hover:text-graphite focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-obsidian"
      >
        ← Back to candidates
      </Link>

      <FlowReveal>
        <FlowCard padded={false} className="overflow-hidden lg:flex lg:items-stretch">
          <div className="relative h-52 w-full bg-mist sm:h-64 md:h-72 lg:h-auto lg:min-h-52 lg:w-[38%] lg:shrink-0">
            {listing.imageUrl ? (
              <img
                src={listing.imageUrl}
                alt={listing.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-mist" />
            )}
          </div>

          <div className="flex flex-col gap-3 p-4 sm:p-5 md:flex-row md:items-start md:justify-between md:gap-6 lg:min-w-0 lg:flex-1">
            <div className="min-w-0">
              <h1 className="font-heading text-xl leading-tight font-semibold tracking-tight text-obsidian sm:text-2xl">
                {listing.title}
              </h1>
              <p className="mt-1 text-[13px] text-fog sm:text-sm">
                {listing.neighborhood}, {listing.city} ·{" "}
                {listing.sizeM2 > 0 ? `${listing.sizeM2} m²` : "Area unknown"} ·{" "}
                {listing.rooms > 0 ? `${listing.rooms} bedrooms` : "Bedrooms unknown"}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {listing.tags.map((tag) => (
                  <FlowPill key={tag}>{tag}</FlowPill>
                ))}
              </div>
            </div>
            <div className="flex flex-row-reverse items-center justify-between gap-2 md:shrink-0 md:flex-col md:items-end md:justify-start">
              <FlowScoreBadge score={listing.matchScore} />
              <p className="text-xl font-semibold whitespace-nowrap text-obsidian sm:text-2xl">
                {listing.price > 0 ? `€${listing.price}` : "Price unknown"}{" "}
                {listing.price > 0 && (
                  <span className="text-[13px] font-normal text-fog">
                    {explanation.listing.pricePeriod === "month" ? "/month" : "· period unknown"}
                  </span>
                )}
              </p>
            </div>
          </div>
        </FlowCard>
      </FlowReveal>

      <div className="grid gap-4 sm:gap-5 md:grid-cols-[3fr_2fr] md:items-start lg:grid-cols-[5fr_3fr_4fr] lg:gap-4">
        <InsightPanel {...explanation} />

        <FlowCard className="p-5 sm:p-6">
          <h2 className="text-subheading font-semibold text-obsidian">Neighborhood profile</h2>
          <div className="mt-3">
            <NeighborhoodProfile profile={listing.neighborhoodProfile} />
          </div>
        </FlowCard>

        <section
          id="agency-actions"
          tabIndex={-1}
          aria-label="Viewing options"
          className="scroll-mt-6 rounded-cards focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-obsidian md:col-span-2 lg:col-span-1"
        >
          <AgentCallGate listing={listing} />
        </section>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-mist bg-snow/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <a
          href="#agency-actions"
          className="mx-auto flex min-h-12 max-w-md items-center justify-center rounded-buttons bg-obsidian px-4 text-sm font-medium text-snow focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-obsidian"
        >
          Review viewing options
        </a>
      </div>
    </div>
  );
};
