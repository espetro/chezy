import Link from "next/link";
import { FlowPill } from "@/components/flow/ui/Pill";
import { FlowScoreBadge } from "@/components/flow/ui/ScoreBadge";
import type { FlowListing } from "@/lib/flow/types";

interface CandidateCardProps {
  listing: FlowListing;
}

export const CandidateCard = ({ listing }: CandidateCardProps) => (
  <Link
    href={`/flow/explore/${encodeURIComponent(listing.id)}`}
    className="group flex flex-col overflow-hidden rounded-cards bg-snow shadow-sm transition-shadow hover:shadow-md"
  >
    <div className="relative h-48 w-full">
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
      <FlowScoreBadge score={listing.matchScore} className="absolute left-4 top-4 shadow-[0_1px_8px_rgba(0,0,0,0.18)]" />
    </div>

    <div className="flex flex-1 flex-col gap-3 p-7">
      <div>
        <h3 className="text-subheading font-semibold text-obsidian">
          {listing.title}
        </h3>
        <p className="mt-1 text-[14px] text-fog">
          {listing.neighborhood}, {listing.city} · {listing.sizeM2} m² ·{" "}
          {listing.rooms} bd
        </p>
      </div>

      <p className="text-[20px] font-semibold text-obsidian">
        €{listing.price} <span className="text-[13px] font-normal text-fog">/month</span>
      </p>

      {listing.matchReasons[0] ? (
        <p className="rounded-[14px] bg-card-subtle px-3 py-2 text-[13px] text-iron">
          {listing.matchReasons[0].label}
        </p>
      ) : undefined}

      <div className="flex flex-wrap gap-2">
        {listing.tags.map((tag) => (
          <FlowPill key={tag}>{tag}</FlowPill>
        ))}
      </div>
    </div>
  </Link>
);
