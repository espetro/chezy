import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { auth } from "@/app/(auth)/auth";
import { VerifyForm } from "@/components/agent/verify-form";
import { getProfile } from "@/lib/profile";

export default function VerifyPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}

async function Verify() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/guest?redirectUrl=/onboarding/verify");
  }

  const profile = await getProfile(session.user.id);
  if (!profile) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-obsidian text-sm">
          Aún no has definido tus preferencias de búsqueda.
        </p>
        <Link
          className="rounded-[14px] bg-obsidian px-5 py-3 font-medium text-sm text-snow"
          href="/onboarding/preferences"
        >
          Configurar mi búsqueda →
        </Link>
      </main>
    );
  }

  return <VerifyForm alreadyVerified={profile.verified} />;
}
