import Link from "next/link";
import { FlowButton } from "@/components/flow/ui/Button";
import { FlowPill } from "@/components/flow/ui/Pill";

const painPoints = [
  "No more endless scrolling on listing sites — the agent filters for you",
  "Once a match clears 95%, the agent calls the agency on its own",
  "You're always one click from calling sooner, or discarding a candidate",
];

const FlowLandingPage = () => (
  <main className="mx-auto flex min-h-screen w-full max-w-[1200px] flex-col gap-20 px-6 py-16 md:px-8">
    <header className="flex items-center justify-between">
      <span className="text-[15px] font-semibold">Chezy</span>
      <div className="flex items-center gap-2">
        <Link href="/chat">
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
        <h1 className="text-heading-lg font-semibold tracking-tight text-obsidian">
          Find your next home without chasing it yourself
        </h1>
        <p className="text-body-lg text-fog">
          Describe what you're looking for once. Chezy tracks inventory
          from partner agencies, scores every listing against your profile,
          and calls the agency itself the moment a match is strong enough.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/onboarding">
            <FlowButton>Find my home</FlowButton>
          </Link>
          <Link href="/explore">
            <FlowButton variant="secondary">See an example match</FlowButton>
          </Link>
        </div>
      </div>

      <div className="rounded-cards border border-cloud bg-slate p-7 text-snow">
        <p className="text-[13px] uppercase tracking-wide text-mist">
          Without an agent
        </p>
        <ul className="mt-4 flex flex-col gap-4">
          {painPoints.map((point) => (
            <li key={point} className="flex items-start gap-3 text-[16px]">
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
