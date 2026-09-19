import { Bot, LayoutList, Map as MapIcon, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/app/(auth)/auth";
import { BottomNav } from "@/components/agent/bottom-nav";
import { ListingCard } from "@/components/agent/listing-card";
import { eur } from "@/lib/format";
import { buildFeed } from "@/lib/feed";
import { getProfile } from "@/lib/profile";

export default function FeedPage() {
  return (
    <Suspense>
      <Feed />
    </Suspense>
  );
}

async function Feed() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/guest?redirectUrl=/feed");
  }
  const profile = await getProfile(session.user.id);
  if (!profile) {
    redirect("/onboarding/preferences");
  }

  const feed = await buildFeed(profile);
  const zone =
    profile.neighbourhoods.length > 0
      ? profile.neighbourhoods.slice(0, 2).join(" & ")
      : "Toda Barcelona";

  return (
    <>
      <header className="fixed top-0 z-50 w-full max-w-[480px] bg-paper/85 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-obsidian text-snow">
              <Bot className="h-4 w-4" />
            </div>
            <span className="font-semibold text-base text-obsidian tracking-tight">
              Chezy
            </span>
            <span className="mx-0.5 h-4 w-px bg-cloud" />
            <span className="text-fog text-sm tracking-tight">Descubrir</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-cloud bg-snow px-2.5 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ember" />
            <span className="text-iron text-xs uppercase tracking-wider">
              IA Activa
            </span>
          </div>
        </div>
      </header>

      <main className="relative flex w-full flex-1 flex-col bg-paper pt-16 pb-28">
        <div className="flex w-full flex-col gap-4 px-4">
          <div className="flex items-center justify-between pt-2">
            <div className="inline-flex rounded-full bg-cloud p-1">
              <span className="flex items-center gap-1.5 rounded-full bg-snow px-3.5 py-1.5 text-obsidian shadow-sm">
                <LayoutList className="h-4.5 w-4.5" />
                <span className="text-xs tracking-tight">Feed</span>
              </span>
              <span
                className="flex cursor-not-allowed items-center gap-1.5 rounded-full px-3.5 py-1.5 text-fog"
                title="pronto"
              >
                <MapIcon className="h-4.5 w-4.5" />
                <span className="text-xs tracking-tight">Mapa</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-cloud bg-snow px-3 py-1.5">
              <Sparkles className="h-4 w-4 text-ember" />
              <span className="text-iron text-xs">
                {feed.items.length} candidatos
              </span>
            </div>
          </div>

          <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 py-0.5">
            <Link
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cloud bg-snow px-3 py-1.5"
              href="/onboarding/preferences"
            >
              <span className="text-obsidian text-xs">Filtros</span>
            </Link>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cloud bg-snow px-3 py-1.5">
              <span className="text-iron text-xs">{zone}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cloud bg-snow px-3 py-1.5">
              <span className="text-iron text-xs">
                &lt; {eur.format(profile.maxPriceEur)}
              </span>
            </span>
            {profile.mustHaves.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cloud bg-snow px-3 py-1.5">
                <span className="text-iron text-xs">
                  {profile.mustHaves.length} imprescindibles
                </span>
              </span>
            )}
          </div>

          {feed.note && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-amber-800 text-xs leading-relaxed">
                {feed.note}
              </p>
            </div>
          )}

          {feed.items.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-[28px] border border-cloud bg-snow p-8 text-center">
              <p className="text-obsidian text-sm">
                Ningún piso encaja ahora mismo, ni siquiera ampliando filtros.
              </p>
              <Link
                className="rounded-full bg-obsidian px-4 py-2 text-snow text-xs"
                href="/onboarding/preferences"
              >
                Ajustar preferencias
              </Link>
            </div>
          )}

          {feed.items.map(({ listing, match }, i) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              match={match}
              reasonsOpen={i === 0}
            />
          ))}
        </div>
      </main>

      <BottomNav />
    </>
  );
}
