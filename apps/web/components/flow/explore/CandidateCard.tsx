import Link from "next/link";
import { FlowPill } from "~/components/flow/ui/Pill";
import { FlowScoreBadge } from "~/components/flow/ui/ScoreBadge";
import type { FlowListing } from "~/lib/flow/types";

interface CandidateCardProps {
  listing: FlowListing;
}

const VISIBLE_TAGS = 4;

export const CandidateCard = ({ listing }: CandidateCardProps) => {
  const visibleTags = listing.tags.slice(0, VISIBLE_TAGS);
  const hiddenTags = listing.tags.length - visibleTags.length;

  return (
    <Link
      href={`/explore/${encodeURIComponent(listing.id)}`}
      className="group flex h-full w-full flex-col overflow-hidden rounded-cards bg-snow shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-obsidian"
    >
      <div className="relative h-48 w-full shrink-0 bg-mist">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-mist" />
        )}
        <FlowScoreBadge
          score={listing.matchScore}
          className="absolute top-4 left-4 shadow-[0_1px_8px_rgba(0,0,0,0.18)]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 sm:p-7">
        <div>
          <h3 className="text-subheading line-clamp-2 min-h-12 font-semibold text-obsidian">
            {listing.title}
          </h3>
          <p className="mt-1 line-clamp-1 text-[14px] text-fog">
            {listing.neighborhood}, {listing.city} · {listing.sizeM2} m² · {listing.rooms} bd
          </p>
        </div>

        <p className="text-[20px] font-semibold text-obsidian">
          €{listing.price} <span className="text-[13px] font-normal text-fog">/month</span>
        </p>

        <p className="line-clamp-2 min-h-14 rounded-[14px] bg-card-subtle px-3 py-2 text-[13px] text-iron">
          {listing.matchReasons[0]?.label ?? "Open this home to review known facts and unknowns."}
        </p>
        {listing.outdoorEvidence && (
          <p className="text-[13px] text-iron">{listing.outdoorEvidence}</p>
        )}

        <div className="mt-auto flex min-h-16 flex-wrap content-start gap-2">
          {visibleTags.map((tag) => (
            <FlowPill key={tag}>{tag}</FlowPill>
          ))}
          {hiddenTags > 0 ? <FlowPill>+{hiddenTags}</FlowPill> : undefined}
        </div>
      </div>
    </Link>
  );
};
