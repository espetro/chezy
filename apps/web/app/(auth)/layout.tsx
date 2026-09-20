import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { HomeSignalMark } from "~/components/flow/ui/HomeSignalMark";
import { SignalField } from "~/components/flow/ui/SignalField";

// Sign in / sign up sit on the flow surface, not the chat template's shadcn one: the
// demo is driven from a phone and this is the first screen a judge taps into.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-paper font-flow text-obsidian">
      <SignalField />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-4 sm:px-6 sm:py-8">
        <Link
          className="inline-flex min-h-11 w-fit items-center gap-1.5 text-label-md text-fog transition-colors hover:text-obsidian"
          href="/"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden />
          Back
        </Link>

        <div className="flex flex-1 flex-col justify-center gap-5 py-6">
          <div className="rounded-cards border border-cloud bg-snow p-6 shadow-sm sm:p-8">
            <HomeSignalMark />
            <div className="mt-6 flex flex-col gap-6">{children}</div>
          </div>

          <p className="text-center text-label-md text-fog">
            {"Just looking? "}
            <Link
              className="text-obsidian underline underline-offset-4 hover:text-ember-deep"
              href="/onboarding"
            >
              Explore as a guest
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
