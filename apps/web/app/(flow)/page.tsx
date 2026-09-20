import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { flowButtonClass } from "~/components/flow/ui/Button";
import { FlowCard } from "~/components/flow/ui/Card";
import { FlowPill } from "~/components/flow/ui/Pill";

const highlights = [
  "No more endless scrolling — Chezy filters partner listings for you",
  "Once a match clears 95%, Chezy calls the agency automatically",
  "Want it sooner? Call now with one tap — or discard a candidate just as easily",
];

// Hero entrance is the `fade-up` CSS keyframe, not Motion: Motion renders `initial`
// into the server HTML and leaves the hero blank until hydration. The reduced-motion
// block in globals.css turns it off.
const heroDelay = (step: number) => ({ animationDelay: `${step * 70}ms` });

const FlowLandingPage = () => (
  <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 sm:max-w-xl sm:px-6">
    <header className="flex items-center py-5">
      <span className="text-[15px] font-semibold">Chezy</span>
    </header>

    <div className="flex flex-1 flex-col gap-8 py-4 sm:gap-10 sm:py-6">
      <section className="flex flex-col gap-6">
        <FlowPill
          variant="accent"
          className="w-fit animate-fade-up px-3 py-1 text-[13px]"
          style={heroDelay(0)}
        >
          AI rental agent
        </FlowPill>
        <h1
          className="animate-fade-up font-heading text-3xl leading-tight font-extrabold tracking-tight text-obsidian sm:text-4xl lg:text-5xl"
          style={heroDelay(1)}
        >
          Find your next home without chasing it yourself
        </h1>
        <p
          className="animate-fade-up text-sm leading-relaxed text-fog sm:text-base"
          style={heroDelay(2)}
        >
          Tell Chezy what you want once — it finds the match and books the visit.
        </p>
      </section>

      <FlowCard
        padded={false}
        className="flex animate-fade-up flex-col gap-4 p-5 sm:p-7"
        style={heroDelay(3)}
      >
        <h2 className="text-subheading font-semibold text-obsidian">How Chezy works</h2>
        <ul className="flex flex-col gap-4">
          {highlights.map((highlight) => (
            <li
              key={highlight}
              className="flex items-start gap-3 text-[15px] text-graphite sm:text-[16px]"
            >
              <CircleCheck size={18} aria-hidden className="mt-1 shrink-0 text-obsidian" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      </FlowCard>
    </div>

    <div
      className="sticky bottom-0 z-10 -mx-4 flex animate-fade-up flex-col gap-3 bg-paper/90 p-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6"
      style={heroDelay(4)}
    >
      <Link className={flowButtonClass({ className: "w-full" })} href="/onboarding">
        Find my home
      </Link>
      <p className="text-center text-sm text-fog">
        About 1 minute to set up · you&apos;re always in control
      </p>
    </div>
  </main>
);

export default FlowLandingPage;
