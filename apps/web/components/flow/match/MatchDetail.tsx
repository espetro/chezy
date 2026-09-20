import Link from "next/link";
import { AgentCallGate } from "~/components/flow/match/AgentCallGate";
import { NeighborhoodProfile } from "~/components/flow/match/NeighborhoodProfile";
import { FlowCard } from "~/components/flow/ui/Card";
import { FlowPill } from "~/components/flow/ui/Pill";
import { FlowScoreBadge } from "~/components/flow/ui/ScoreBadge";
import type { FlowListing } from "~/lib/flow/types";

interface MatchDetailProps {
  listing: FlowListing;
}

export const MatchDetail = ({ listing }: MatchDetailProps) => {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10 md:max-w-[1000px]">
      <Link
        href="/explore"
        className="inline-flex min-h-11 w-fit items-center text-[13px] text-fog hover:text-graphite"
      >
        ← Back to candidates
      </Link>

      <FlowCard padded={false} className="overflow-hidden">
        <div className="relative h-56 w-full sm:h-80 md:h-96">
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

        <div className="flex flex-col gap-4 p-5 sm:p-7 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight text-obsidian sm:text-3xl">
              {listing.title}
            </h1>
            <p className="mt-1 text-sm text-fog sm:text-[15px]">
              {listing.neighborhood}, {listing.city} · {listing.sizeM2} m² · {listing.rooms} bd ·
              available {listing.availableFrom}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {listing.tags.map((tag) => (
                <FlowPill key={tag}>{tag}</FlowPill>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <FlowScoreBadge score={listing.matchScore} />
            <p className="text-2xl font-semibold whitespace-nowrap text-obsidian sm:text-3xl">
              €{listing.price} <span className="text-[14px] font-normal text-fog">/month</span>
            </p>
          </div>
        </div>
      </FlowCard>

      <FlowCard>
        <h2 className="text-subheading font-semibold text-obsidian">Why it's a match</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {listing.matchReasons.map((reason) => (
            <li key={reason.label} className="flex items-start gap-3">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-ember" />
              <div>
                <p className="text-[14px] font-medium text-graphite">{reason.label}</p>
                <p className="text-[13px] text-fog">{reason.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </FlowCard>

      <FlowCard>
        <h2 className="text-subheading font-semibold text-obsidian">Neighborhood profile</h2>
        <div className="mt-4">
          <NeighborhoodProfile profile={listing.neighborhoodProfile} />
        </div>
      </FlowCard>

      <AgentCallGate listing={listing} />
    </div>
  );
};
