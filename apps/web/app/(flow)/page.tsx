import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { FlowButton } from "~/components/flow/ui/Button";
import { FlowPill } from "~/components/flow/ui/Pill";

const highlights = [
  "No more endless scrolling — Chezy filters partner listings for you",
  "Once a match clears 95%, Chezy calls the agency automatically",
  "Want it sooner? Call now with one tap — or discard a candidate just as easily",
];

const FlowLandingPage = () => (
  <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-12 px-4 py-8 sm:px-6 sm:py-12 md:max-w-[1200px] md:gap-20 md:py-16">
    <header className="flex items-center justify-between">
      <span className="text-[15px] font-semibold">Chezy</span>
      <div className="flex items-center gap-2">
        <Link className="hidden sm:inline-flex" href="/chat">
          <FlowButton variant="ghost" size="sm">
            Talk to your agent
          </FlowButton>
        </Link>
        <Link href="/onboarding">
          <FlowButton size="sm">Get started</FlowButton>
        </Link>
      </div>
    </header>

    <section className="grid gap-10 md:grid-cols-2 md:items-center">
      <div className="flex flex-col gap-6">
        <FlowPill variant="accent" className="w-fit rounded-full px-3">
          AI rental agent
        </FlowPill>
        <h1 className="font-heading text-3xl leading-tight font-extrabold tracking-tight text-obsidian sm:text-4xl lg:text-5xl">
          Find your next home without chasing it yourself
        </h1>
        <p className="text-sm leading-relaxed text-fog sm:text-base">
          Describe what you're looking for once. Chezy tracks inventory from partner agencies,
          scores every listing against your profile, and calls the agency itself the moment a match
          is strong enough.
        </p>
        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
          <Link className="w-full sm:w-auto" href="/onboarding">
            <FlowButton className="w-full sm:w-auto">Find my home</FlowButton>
          </Link>
          <Link className="w-full sm:w-auto" href="/explore">
            <FlowButton className="w-full sm:w-auto" variant="secondary">
              See a match in action
            </FlowButton>
          </Link>
        </div>
        <p className="text-sm text-fog">About 1 minute to set up · you&apos;re always in control</p>
      </div>

      <div className="rounded-cards border border-cloud bg-slate p-5 text-snow sm:p-7">
        <p className="text-[13px] tracking-wide text-mist uppercase">How Chezy works</p>
        <ul className="mt-4 flex flex-col gap-4">
          {highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-3 text-[15px] sm:text-[16px]">
              <CircleCheck size={18} aria-hidden className="mt-1 shrink-0 text-ember" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  </main>
);

export default FlowLandingPage;
