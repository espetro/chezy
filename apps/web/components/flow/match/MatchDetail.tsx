import Image from "next/image";
import Link from "next/link";
import { AgentCallGate } from "@/components/flow/match/AgentCallGate";
import { NeighborhoodProfile } from "@/components/flow/match/NeighborhoodProfile";
import { FlowCard } from "@/components/flow/ui/Card";
import { FlowPill } from "@/components/flow/ui/Pill";
import { FlowScoreBadge } from "@/components/flow/ui/ScoreBadge";
import type { Listing } from "@/lib/flow/types";

interface MatchDetailProps {
  listing: Listing;
}

export const MatchDetail = ({ listing }: MatchDetailProps) => {
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-8 px-6 py-10 md:px-8">
      <Link href="/flow/explore" className="text-[13px] text-fog hover:text-graphite">
        ← Back to candidates
      </Link>

      <div className="relative h-80 w-full overflow-hidden rounded-cards md:h-96">
        <Image
          src={listing.imageUrl}
          alt={listing.title}
          fill
          sizes="(min-width: 768px) 1000px, 100vw"
          className="object-cover"
          priority
        />
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-heading-sm font-semibold text-obsidian">
            {listing.title}
          </h1>
          <p className="mt-1 text-[15px] text-fog">
            {listing.neighborhood}, {listing.city} · {listing.sizeM2} m² ·{" "}
            {listing.rooms} bd · available {listing.availableFrom}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {listing.tags.map((tag) => (
              <FlowPill key={tag}>{tag}</FlowPill>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <FlowScoreBadge score={listing.matchScore} />
          <p className="text-heading-sm font-semibold text-obsidian">
            €{listing.price} <span className="text-[14px] font-normal text-fog">/month</span>
          </p>
        </div>
      </div>

      <FlowCard>
        <h2 className="text-subheading font-semibold text-obsidian">
          Why it's a match
        </h2>
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
        <h2 className="text-subheading font-semibold text-obsidian">
          Neighborhood profile
        </h2>
        <div className="mt-4">
          <NeighborhoodProfile profile={listing.neighborhoodProfile} />
        </div>
      </FlowCard>

      <AgentCallGate listing={listing} />
    </div>
  );
};
