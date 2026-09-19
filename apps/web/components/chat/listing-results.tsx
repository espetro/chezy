"use client";

import { HouseIcon } from "lucide-react";

import type { ListingSearchResult, ListingSummary } from "~/lib/listings";

const priceFormatter = new Intl.NumberFormat("es-ES", {
  currency: "EUR",
  maximumFractionDigits: 0,
  style: "currency",
  // es-ES sets minimumGroupingDigits=2; force grouping so 4187 reads "4.187 €".
  useGrouping: "always",
});

export function ListingCard({ listing }: { listing: ListingSummary }) {
  const price =
    listing.priceEur != null
      ? `${priceFormatter.format(listing.priceEur)}${listing.operation === "rent" ? "/mes" : ""}`
      : undefined;
  const headline = [
    listing.rooms != null ? `${listing.rooms} hab` : undefined,
    listing.builtM2 != null ? `${listing.builtM2} m²` : undefined,
    listing.bathrooms != null ? `${listing.bathrooms} baños` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");
  const location = [listing.neighbourhood, listing.district].filter(Boolean).join(", ");

  return (
    <article className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      {listing.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={listing.title}
          className="aspect-video w-full object-cover"
          src={listing.coverUrl}
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-muted">
          <HouseIcon className="size-8 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1 p-3">
        {price && <p className="text-base font-semibold">{price}</p>}
        {headline && <p className="text-sm font-medium">{headline}</p>}
        {location && <p className="text-xs text-muted-foreground">{location}</p>}
        <p className="line-clamp-2 text-xs text-muted-foreground">{listing.title}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="font-mono text-[10px] text-muted-foreground">{listing.id}</span>
          <a
            className="text-xs text-primary hover:underline"
            href={listing.url}
            rel="noreferrer"
            target="_blank"
          >
            Ver anuncio ↗
          </a>
        </div>
      </div>
    </article>
  );
}

export function ListingResults({ result }: { result: ListingSearchResult }) {
  const districts = new Set(result.listings.map((l) => l.district).filter(Boolean));
  const sharedDistrict = districts.size === 1 ? [...districts][0] : undefined;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {result.total} {result.total === 1 ? "anuncio" : "anuncios"}
        {sharedDistrict ? ` · ${sharedDistrict}` : " en Barcelona"}
      </p>
      {result.relaxed.length > 0 && (
        <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {result.note}
        </div>
      )}
      {result.listings.length === 0 ? (
        <div className="rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">
          No hay anuncios que encajen.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {result.listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
