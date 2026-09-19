import Link from "next/link";
import { FlowButton } from "@/components/flow/ui/Button";
import { FlowPill } from "@/components/flow/ui/Pill";

const painPoints = [
  "No more endless scrolling on listing sites — the agent filters for you",
  "Once a match clears 95%, the agent calls the agency on its own",
  "You're always one click from calling sooner, or discarding a candidate",
];

const FlowLandingPage = () => (
  <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col gap-12 px-4 py-8 sm:px-6 sm:py-12 md:max-w-[1200px] md:gap-20 md:py-16">
    <header className="flex items-center justify-between">
      <span className="text-[15px] font-semibold">Chezy</span>
      <div className="flex items-center gap-2">
        <Link className="hidden sm:inline-flex" href="/chat">
          <FlowButton variant="ghost" size="sm">Talk to your agent</FlowButton>
        </Link>
        <Link href="/onboarding">
          <FlowButton size="sm">Get started</FlowButton>
        </Link>
      </div>
    </header>

    <section className="grid gap-10 md:grid-cols-2 md:items-center">
      <div className="flex flex-col gap-6">
        <FlowPill variant="accent" className="w-fit">
          Rental agent
        </FlowPill>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-obsidian sm:text-4xl lg:text-5xl">
          Find your next home without chasing it yourself
        </h1>
        <p className="text-sm leading-relaxed text-fog sm:text-base">
          Describe what you're looking for once. Chezy tracks inventory
          from partner agencies, scores every listing against your profile,
          and calls the agency itself the moment a match is strong enough.
        </p>
        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
          <Link className="w-full sm:w-auto" href="/onboarding">
            <FlowButton className="w-full sm:w-auto">Find my home</FlowButton>
          </Link>
          <Link className="w-full sm:w-auto" href="/explore">
            <FlowButton className="w-full sm:w-auto" variant="secondary">
              See an example match
            </FlowButton>
          </Link>
        </div>
      </div>

      <div className="rounded-cards border border-cloud bg-slate p-5 text-snow sm:p-7">
        <p className="text-[13px] uppercase tracking-wide text-mist">
          Without an agent
        </p>
        <ul className="mt-4 flex flex-col gap-4">
          {painPoints.map((point) => (
            <li key={point} className="flex items-start gap-3 text-[15px] sm:text-[16px]">
              <span className="mt-1 text-ember">→</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  </main>
);

export default FlowLandingPage;
