"use client";

import type { Listing } from "@/lib/db/schema";
import type { MatchResult } from "@/lib/match";
import { eur } from "@/lib/format";
import { AMENITY_LABELS } from "@/lib/labels";
import { RequestViewingButton } from "@/components/agent/request-viewing-button";
import {
  BadgeCheck,
  CheckCircle2,
  Heart,
  House,
  MapPin,
  TrainFront,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function ListingCard({
  listing,
  match,
  reasonsOpen = false,
}: {
  listing: Listing;
  match: MatchResult;
  reasonsOpen?: boolean;
}) {
  const [hidden, setHidden] = useState(false);
  const [liked, setLiked] = useState(false);

  if (hidden) {
    return null;
  }

  const facts = [
    listing.rooms !== null ? `${listing.rooms} hab` : null,
    listing.builtM2 !== null ? `${Math.round(listing.builtM2)} m²` : null,
    listing.floor,
  ]
    .filter(Boolean)
    .join(" · ");

  const location = [listing.street, listing.neighbourhood, listing.municipality]
    .filter(Boolean)
    .join(", ");

  const tags = listing.amenities
    .map((a) => AMENITY_LABELS[a])
    .filter((l): l is string => Boolean(l))
    .slice(0, 3);

  return (
    <article
      className="relative flex w-full flex-col overflow-hidden rounded-[36px] border border-cloud bg-snow transition-transform duration-300"
      data-testid="listing-card"
    >
      <Link
        className="relative aspect-[4/3] w-full overflow-hidden bg-paper"
        href={`/listing/${encodeURIComponent(listing.id)}`}
      >
        {listing.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={listing.title}
            className="h-full w-full select-none object-cover"
            src={listing.coverUrl}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-fog">
            <House className="h-10 w-10" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-obsidian/40 via-transparent to-obsidian/30" />
        <div className="pointer-events-none absolute top-4 right-4 left-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-obsidian px-3 py-1.5 text-snow">
            <span className="h-2 w-2 animate-ping rounded-full bg-ember" />
            <span className="text-xs uppercase tracking-wider">
              {match.score}% Match IA
            </span>
          </div>
          {listing.publisherKind === "professional" && (
            <div className="inline-flex items-center gap-1 rounded-full bg-ember px-3 py-1.5 text-snow">
              <BadgeCheck className="h-3.5 w-3.5" />
              <span className="text-xs uppercase tracking-wider">
                Verificado Chezy
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="font-semibold text-2xl text-obsidian tracking-tight">
                {listing.priceEur !== null ? eur.format(listing.priceEur) : "—"}
              </span>
              <span className="text-fog text-sm">/mes</span>
            </div>
            <span className="rounded bg-cloud px-2 py-0.5 text-iron text-xs uppercase">
              Disponible ya
            </span>
          </div>
          <Link
            className="font-medium text-base text-obsidian leading-snug"
            href={`/listing/${encodeURIComponent(listing.id)}`}
          >
            {listing.title}
          </Link>
          {facts && <p className="text-steel text-sm">{facts}</p>}
        </div>

        {location && (
          <div className="flex items-center gap-1.5 text-obsidian">
            <MapPin className="h-4.5 w-4.5 shrink-0 text-ember" />
            <span className="truncate font-medium text-sm">{location}</span>
          </div>
        )}

        {match.commuteMin !== undefined && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-paper p-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-snow text-obsidian">
                <TrainFront className="h-4.5 w-4.5" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-fog text-xs uppercase tracking-wider">
                  Trayecto estimado
                </span>
                <span className="truncate font-medium text-obsidian text-sm">
                  A ~{match.commuteMin} min de tu trabajo
                </span>
              </div>
            </div>
            <Zap className="h-4.5 w-4.5 shrink-0 text-ember" />
          </div>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((tag) => (
              <span
                className="inline-flex items-center rounded-full bg-paper px-3 py-1 text-iron text-sm"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            aria-label="Descartar piso"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cloud bg-snow text-fog transition-all hover:bg-paper hover:text-red-600 active:scale-95"
            onClick={() => setHidden(true)}
            type="button"
          >
            <X className="h-6 w-6" />
          </button>
          <button
            aria-label="Guardar en favoritos"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cloud bg-snow transition-all hover:bg-paper active:scale-95 ${
              liked ? "text-ember" : "text-fog"
            }`}
            onClick={() => setLiked((v) => !v)}
            type="button"
          >
            <Heart className={`h-6 w-6 ${liked ? "fill-ember" : ""}`} />
          </button>
          <RequestViewingButton propertyRef={listing.id} />
        </div>
      </div>

      <details className="border-cloud border-t px-6 py-4" open={reasonsOpen}>
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-obsidian text-sm">
          <CheckCircle2 className="h-4 w-4 text-ember" />
          ¿Por qué este piso lidera tu ranking?
        </summary>
        <ul className="mt-2 flex flex-col gap-1">
          {match.reasons.map((reason) => (
            <li className="flex items-start gap-2 text-fog text-sm" key={reason}>
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ember" />
              <span>{reason}</span>
            </li>
          ))}
          {match.reasons.length === 0 && (
            <li className="text-fog text-sm">
              Encaja parcialmente con tus filtros de búsqueda.
            </li>
          )}
        </ul>
      </details>
    </article>
  );
}
