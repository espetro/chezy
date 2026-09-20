import { PhoneCall, SlidersHorizontal, Sparkles, type LucideIcon } from "lucide-react";
import { FlowCard } from "~/components/flow/ui/Card";
import { HomeSignalMark } from "~/components/flow/ui/HomeSignalMark";
import { FlowPill } from "~/components/flow/ui/Pill";

// A preview of the agent feed for the landing hero. Every row describes something the
// product actually does (filter → score → simulated viewing) and the card is labelled
// "Example" with a footer disclosure, so it cannot be read as live activity — same
// truthful-state rule the viewing flow follows.
interface ActivityRow {
  icon: LucideIcon;
  title: string;
  detail: string;
  meta: string;
  accent?: boolean;
}

const rows: ActivityRow[] = [
  {
    icon: SlidersHorizontal,
    title: "14 listings filtered",
    detail: "Gràcia · under 1.400 € · 2 bedrooms",
    meta: "12m",
  },
  {
    icon: Sparkles,
    title: "Match 96%",
    detail: "Carrer de Verdi · 78 m² · balcony, lift",
    meta: "Calling",
    accent: true,
  },
  {
    icon: PhoneCall,
    title: "Viewing simulated",
    detail: "No call placed and nothing booked",
    meta: "1h",
  },
];

export const AgentActivityCard = () => (
  <FlowCard padded={false} className="border border-cloud p-5 sm:p-6">
    <div className="flex items-center gap-3">
      <HomeSignalMark className="size-10 rounded-[12px]" />
      <div className="min-w-0 flex-1">
        <p className="text-body-medium text-obsidian">Chezy agent</p>
        <p className="text-caption text-fog">Watching partner listings for you</p>
      </div>
      <FlowPill>Example</FlowPill>
    </div>

    <ul className="mt-4 flex flex-col gap-2">
      {rows.map(({ icon: Icon, title, detail, meta, accent }) => (
        <li key={title} className="flex items-center gap-3 rounded-[14px] bg-paper px-3 py-3">
          <span
            className={
              accent
                ? "flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-ember-soft text-ember-deep"
                : "flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-cloud text-steel"
            }
          >
            <Icon size={15} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-medium text-obsidian">{title}</p>
            <p className="text-caption truncate text-fog">{detail}</p>
          </div>
          <span
            className={
              accent ? "shrink-0 text-label-md text-ember-deep" : "shrink-0 text-label-md text-ash"
            }
          >
            {meta}
          </span>
        </li>
      ))}
    </ul>

    <p className="text-caption mt-4 text-fog">
      Example of the agent feed. Chezy never calls an agency or books a viewing without your
      approval.
    </p>
  </FlowCard>
);
