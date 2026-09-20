import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { FlowScoreBadge } from "~/components/flow/ui/ScoreBadge";
import type { ListingSummary } from "~/lib/listings";

interface ListingMiniBarProps {
  listing: ListingSummary;
  score?: number;
  // "Top match of 6" style caption above the row.
  caption?: string;
}

const priceFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

// Compact, image-less row for a listing surfaced by a chat tool inside the flow
// chat sheet: price, size, rooms and match, opening the usual listing page.
export const ListingMiniBar = ({ listing, score, caption }: ListingMiniBarProps) => {
  const price =
    listing.priceEur != undefined && listing.priceEur > 0
      ? `€${priceFormatter.format(listing.priceEur)}`
      : "Price unknown";
  const facts = [
    listing.neighbourhood ?? listing.district,
    listing.builtM2 != undefined && listing.builtM2 > 0 ? `${listing.builtM2} m²` : undefined,
    listing.rooms != undefined && listing.rooms > 0 ? `${listing.rooms} bd` : undefined,
  ].filter(Boolean);

  return (
    <div data-testid="listing-mini-bar" className="flex flex-col gap-1.5 font-flow">
      {caption ? <p className="text-[12px] text-fog">{caption}</p> : undefined}
      <Link
        href={`/explore/${encodeURIComponent(listing.id)}`}
        className="flex items-center gap-3 rounded-[20px] border border-cloud bg-snow px-4 py-3 text-obsidian shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-obsidian"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">{listing.title}</p>
          <p className="truncate text-[13px] text-fog">{facts.join(" · ")}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {score != undefined ? <FlowScoreBadge score={Math.round(score)} /> : undefined}
          <p className="text-[14px] font-semibold whitespace-nowrap">
            {price}
            {listing.priceEur != undefined &&
            listing.priceEur > 0 &&
            listing.operation === "rent" ? (
              <span className="text-[12px] font-normal text-fog"> /month</span>
            ) : undefined}
          </p>
        </div>
        <ChevronRight size={18} aria-hidden className="shrink-0 text-fog" />
      </Link>
    </div>
  );
};
