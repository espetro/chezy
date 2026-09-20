import Link from "next/link";
import { AgentCallGate } from "~/components/flow/match/AgentCallGate";
import { InsightPanel } from "~/components/flow/match/InsightPanel";
import type { MatchExplanationProps } from "~/components/flow/match/MatchExplanation";
import { NeighborhoodProfile } from "~/components/flow/match/NeighborhoodProfile";
import { FlowCard } from "~/components/flow/ui/Card";
import { FlowReveal } from "~/components/flow/ui/FlowMotion";
import { FlowPill } from "~/components/flow/ui/Pill";
import type { FlowListing } from "~/lib/flow/types";

interface MatchDetailProps {
  listing: FlowListing;
  explanation: MatchExplanationProps;
}

export const MatchDetail = ({ listing, explanation }: MatchDetailProps) => {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 px-4 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:gap-8 sm:px-6 sm:pt-10 md:max-w-[1000px] md:pb-10">
      <Link
        href="/explore"
        className="inline-flex min-h-11 w-fit items-center rounded-lg text-[13px] text-fog hover:text-graphite focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-obsidian"
      >
        ← Back to candidates
      </Link>

      <FlowCard padded={false} className="overflow-hidden">
        <FlowReveal className="relative h-56 w-full bg-mist sm:h-80 md:h-96">
          {listing.imageUrl ? (
            <img
              src={listing.imageUrl}
              alt={listing.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-mist" />
          )}
        </FlowReveal>

        <div className="flex flex-col gap-4 p-5 sm:p-7 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-3 text-3xl font-semibold text-obsidian">
              {listing.price > 0 ? `€${listing.price}` : "Price unknown"}{" "}
              {listing.price > 0 && (
                <span className="text-[14px] font-normal text-fog">
                  {explanation.listing.pricePeriod === "month" ? "/month" : "· period unknown"}
                </span>
              )}
            </p>
            <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-obsidian sm:text-3xl">
              {listing.title}
            </h1>
            <p className="mt-1 text-sm text-fog sm:text-[15px]">
              {listing.neighborhood}, {listing.city} ·{" "}
              {listing.sizeM2 > 0 ? `${listing.sizeM2} m²` : "Area unknown"} ·{" "}
              {listing.rooms > 0 ? `${listing.rooms} bedrooms` : "Bedrooms unknown"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {listing.tags.map((tag) => (
                <FlowPill key={tag}>{tag}</FlowPill>
              ))}
            </div>
          </div>
        </div>
      </FlowCard>

      <InsightPanel {...explanation} />

      <FlowCard>
        <h2 className="text-subheading font-semibold text-obsidian">Neighborhood profile</h2>
        <div className="mt-4">
          <NeighborhoodProfile profile={listing.neighborhoodProfile} />
        </div>
      </FlowCard>

      <section
        id="agency-actions"
        tabIndex={-1}
        aria-label="Viewing options"
        className="scroll-mt-6 rounded-cards focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-obsidian"
      >
        <AgentCallGate listing={listing} />
      </section>
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
