import {
  ArrowLeft,
  BadgeCheck,
  BedDouble,
  Bot,
  CheckCircle2,
  Dumbbell,
  Landmark,
  MessageSquare,
  MoveVertical,
  Pill,
  Ruler,
  Sparkles,
  Store,
  Sun,
  TrainFront,
  TreePine,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/app/(auth)/auth";
import { ListingGallery } from "@/components/agent/listing-gallery";
import { RequestViewingButton } from "@/components/agent/request-viewing-button";
import { eur } from "@/lib/format";
import { getListingRowById } from "@/lib/listings";
import { scoreListing } from "@/lib/match";
import { getDistrictProfile } from "@/lib/neighbourhoods";
import { getProfile } from "@/lib/profile";

const POI_ICONS = {
  market: Store,
  gym: Dumbbell,
  pharmacy: Pill,
  metro: TrainFront,
  park: TreePine,
} as const;

const noiseWidth: Record<string, string> = {
  Bajo: "20%",
  "Bajo / Medio": "35%",
  Medio: "60%",
  Alto: "90%",
};

const lifeWidth: Record<string, string> = {
  Media: "55%",
  Alta: "75%",
  "Muy Alta": "92%",
};

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense>
      <ListingDetail params={params} />
    </Suspense>
  );
}

async function ListingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/guest");
  }
  const { id } = await params;
  const row = await getListingRowById(decodeURIComponent(id));
  if (!row) {
    notFound();
  }

  const profile = await getProfile(session.user.id);
  const match = profile ? scoreListing(profile, row) : null;
  const district = getDistrictProfile(row.district);
  const photos = row.media
    .filter((m) => m.kind === "photo")
    .map((m) => m.url)
    .slice(0, 8);

  const location = [row.street, row.neighbourhood, row.municipality]
    .filter(Boolean)
    .join(", ");

  const facts = [
    {
      icon: BedDouble,
      label: "Dormitorios",
      value: row.rooms !== null ? `${row.rooms} habs` : "—",
    },
    {
      icon: Ruler,
      label: "Superficie",
      value: row.builtM2 !== null ? `${Math.round(row.builtM2)} m²` : "—",
    },
    ...(row.floor !== null
      ? [{ icon: MoveVertical, label: "Altura", value: row.floor }]
      : []),
    {
      icon: Sun,
      label: "Orientación",
      value: row.amenities.includes("exterior") ? "Exterior" : "Interior",
    },
  ];

  return (
    <>
      <header className="fixed top-0 z-50 w-full max-w-[480px] bg-paper/85 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link
              aria-label="Volver"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-cloud bg-snow text-obsidian"
              href="/feed"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-obsidian text-snow">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <h1 className="font-semibold text-base text-obsidian tracking-tight">
              Detalle del piso
            </h1>
          </div>
        </div>
      </header>

      <main className="relative flex w-full flex-1 flex-col bg-paper pt-16 pb-32">
        <ListingGallery photos={photos} title={row.title} />

        <div className="flex flex-col gap-6 px-4 pt-5">
          <div className="rounded-[36px] border border-cloud bg-snow p-6">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-3xl text-obsidian tracking-tight">
                    {row.priceEur !== null ? eur.format(row.priceEur) : "—"}
                  </span>
                  <span className="text-steel text-sm">/ mes</span>
                </div>
                {row.publisherKind === "professional" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ember px-3 py-1 text-snow text-xs">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verificado Chezy
                  </span>
                )}
              </div>
              {location && (
                <div className="mt-2 flex items-center gap-1.5 text-fog">
                  <Sparkles className="h-4.5 w-4.5 text-ember" />
                  <span className="font-medium text-graphite text-sm">
                    {location}
                  </span>
                </div>
              )}
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-paper p-3">
                <span className="h-2 w-2 animate-pulse rounded-full bg-ember" />
                <p className="text-iron text-xs">
                  Contrato de arrendamiento regulado · Fianza avalada legalmente
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {facts.map((fact) => (
              <div
                className="flex items-center gap-3.5 rounded-[20px] border border-cloud bg-snow p-4"
                key={fact.label}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-obsidian">
                  <fact.icon className="h-5.5 w-5.5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-fog text-xs uppercase tracking-wider">
                    {fact.label}
                  </span>
                  <span className="font-semibold text-base text-obsidian">
                    {fact.value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {match && (
            <div className="relative overflow-hidden rounded-[36px] border border-cloud bg-snow p-6">
              <div className="-top-10 -right-10 pointer-events-none absolute h-36 w-36 rounded-full bg-ember/20 blur-2xl" />
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-obsidian text-snow">
                    <Sparkles className="h-4 w-4 text-ember" />
                  </div>
                  <span className="font-semibold text-base text-obsidian">
                    Por qué encaja contigo
                  </span>
                </div>
                <span className="rounded-full bg-obsidian px-2.5 py-1 font-semibold text-snow text-xs uppercase tracking-wider">
                  {match.score}% Match
                </span>
              </div>
              <div className="mb-4 rounded-[24px] bg-paper p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cloud font-bold text-graphite text-xs">
                    CZ
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {match.reasons.map((reason) => (
                      <div
                        className="flex items-start gap-2 text-graphite"
                        key={reason}
                      >
                        <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-ember" />
                        <span className="text-sm">{reason}</span>
                      </div>
                    ))}
                    {match.reasons.length === 0 && (
                      <p className="text-fog text-sm">
                        Encaja parcialmente con tus filtros de búsqueda.
                      </p>
                    )}
                  </div>
                </div>
              </div>
              {match.commuteMin !== undefined && (
                <div className="rounded-[24px] bg-paper p-4">
                  <span className="mb-2 block text-fog text-xs uppercase tracking-wider">
                    Trayecto estimado a tu trabajo
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cloud text-obsidian">
                      <TrainFront className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-base text-obsidian">
                        ~{match.commuteMin} min
                      </span>
                      <span className="block text-fog text-sm">
                        estimación puerta a puerta
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {district && (
            <div className="flex flex-col gap-5 rounded-[36px] border border-cloud bg-snow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="block font-semibold text-base text-obsidian">
                    Perfil del Barrio
                  </span>
                  <span className="text-fog text-sm">{row.district}</span>
                </div>
                <span className="rounded-full bg-ember/15 px-3 py-1.5 font-semibold text-ember text-xs">
                  Datos ilustrativos
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 rounded-2xl bg-paper p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-fog text-sm">Seguridad</span>
                    <span className="font-semibold text-obsidian">
                      {district.safety}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-cloud">
                    <div
                      className="h-full rounded-full bg-obsidian"
                      style={{ width: `${district.safety * 10}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl bg-paper p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-fog text-sm">Comercios</span>
                    <span className="font-semibold text-obsidian">
                      {district.commerce}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-cloud">
                    <div
                      className="h-full rounded-full bg-obsidian"
                      style={{ width: `${district.commerce * 10}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl bg-paper p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-fog text-sm">Ruido nocturno</span>
                    <span className="font-semibold text-graphite text-sm">
                      {district.noise}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-cloud">
                    <div
                      className="h-full rounded-full bg-ember"
                      style={{ width: noiseWidth[district.noise] }}
                    />
                  </div>
                </div>
                <div className="space-y-2 rounded-2xl bg-paper p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-fog text-sm">Vida de barrio</span>
                    <span className="font-semibold text-obsidian text-sm">
                      {district.life}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-cloud">
                    <div
                      className="h-full rounded-full bg-obsidian"
                      style={{ width: lifeWidth[district.life] }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-1">
                <span className="block text-fog text-xs uppercase tracking-wider">
                  Puntos de interés a pie
                </span>
                <div className="flex flex-col gap-2">
                  {district.pois.map((poi) => {
                    const Icon = POI_ICONS[poi.kind] ?? Landmark;
                    return (
                      <div
                        className="flex items-center justify-between rounded-2xl bg-paper p-3"
                        key={poi.name}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-iron" />
                          <span className="font-medium text-graphite text-sm">
                            {poi.name}
                          </span>
                        </div>
                        <span className="font-semibold text-ember text-sm">
                          A {poi.minutes} min
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <div className="fixed right-0 bottom-0 left-0 z-50 mx-auto w-full max-w-[480px] bg-snow/90 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-cloud bg-snow px-4 font-semibold text-obsidian text-sm"
            href={`/chat?query=${encodeURIComponent(`Cuéntame más sobre el piso ${row.id}`)}`}
          >
            <MessageSquare className="h-4.5 w-4.5" />
            <span className="truncate">Chatear con Chezy</span>
          </Link>
          <RequestViewingButton className="flex-[1.2]" propertyRef={row.id} />
        </div>
      </div>
    </>
  );
}
