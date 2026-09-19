"use client";

import {
  ArrowUpDown,
  BadgeCheck,
  Ban,
  BedDouble,
  BellRing,
  Briefcase,
  Calendar,
  Check,
  Navigation,
  PawPrint,
  Scaling,
  Shield,
  Snowflake,
  Sofa,
  Sun,
  TriangleAlert,
  Umbrella,
  UserX,
  Wallet,
} from "lucide-react";
import { FlowBadge } from "~/components/flow/ui/Badge";
import { FlowCheckboxRow } from "~/components/flow/ui/CheckboxRow";
import { FlowDateChips } from "~/components/flow/ui/DateChips";
import { FlowRangeSlider } from "~/components/flow/ui/RangeSlider";
import { FlowSectionCard } from "~/components/flow/ui/SectionCard";
import { FlowSegmentedSelector } from "~/components/flow/ui/SegmentedSelector";
import { FlowSelectableTile } from "~/components/flow/ui/SelectableTile";
import { FlowStatTile } from "~/components/flow/ui/StatTile";
import { FlowSwitch } from "~/components/flow/ui/Switch";
import { FlowTextField } from "~/components/flow/ui/TextField";
import { FlowToggleChipGroup } from "~/components/flow/ui/ToggleChip";
import {
  BUDGET,
  autonomyOptions,
  commuteOptions,
  dealBreakerOptions,
  mustHaveOptions,
  roomOptions,
  sizeOptions,
  zoneOptions,
  zoneLabel,
  type DealBreakerIcon,
  type MustHaveIcon,
} from "~/lib/flow/onboarding-steps";
import type { UserPreferences } from "~/lib/flow/types";
import { cn } from "~/lib/utils";

export interface StepProps {
  prefs: UserPreferences;
  onChange: (patch: Partial<UserPreferences>) => void;
}

export const formatEur = (value: number) =>
  `€${value.toLocaleString("en-US")}${value >= BUDGET.max ? "+" : ""}`;

const mustHaveIcons: Record<MustHaveIcon, React.ReactNode> = {
  sun: <Sun size={18} aria-hidden />,
  umbrella: <Umbrella size={18} aria-hidden />,
  elevator: <ArrowUpDown size={18} aria-hidden />,
  snowflake: <Snowflake size={18} aria-hidden />,
  sofa: <Sofa size={18} aria-hidden />,
  paw: <PawPrint size={18} aria-hidden />,
};

const dealBreakerIcons: Record<DealBreakerIcon, React.ReactNode> = {
  ban: <Ban size={18} aria-hidden />,
  warning: <TriangleAlert size={18} aria-hidden />,
  "user-x": <UserX size={18} aria-hidden />,
};

const toggleId = (list: string[], id: string) =>
  list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

export const RoutineStep = ({ prefs, onChange }: StepProps) => {
  const commute = commuteOptions.find((option) => option.value === prefs.commuteMaxMin);

  return (
    <FlowSectionCard
      title="4. Routine & area"
      icon={<Navigation size={16} aria-hidden />}
      aside={<FlowBadge variant="muted">Fine-tuning</FlowBadge>}
    >
      <FlowToggleChipGroup
        label="Target neighborhoods"
        options={zoneOptions}
        selected={prefs.zones}
        onChange={(zones) => onChange({ zones })}
      />
      <FlowSegmentedSelector
        label="Max commute time"
        valueLabel={commute?.description}
        options={commuteOptions}
        value={prefs.commuteMaxMin}
        onChange={(commuteMaxMin) => onChange({ commuteMaxMin })}
      />
      <FlowTextField
        label="Work or study address you commute to (optional)"
        icon={<Briefcase size={18} aria-hidden />}
        placeholder="Diagonal 405 (Passeig de Gràcia), BCN"
        value={prefs.workAddress}
        onChange={(event) => onChange({ workAddress: event.target.value })}
        autoComplete="street-address"
      />
    </FlowSectionCard>
  );
};

export const BudgetStep = ({ prefs, onChange }: StepProps) => (
  <FlowSectionCard
    title="1. Budget & space"
    icon={<Wallet size={16} aria-hidden />}
    aside={<FlowBadge variant="steel">No hidden fees</FlowBadge>}
  >
    <FlowRangeSlider
      label="Monthly range"
      min={BUDGET.min}
      max={BUDGET.max}
      step={BUDGET.step}
      value={[prefs.budgetMin, prefs.budgetMax]}
      onChange={([budgetMin, budgetMax]) => onChange({ budgetMin, budgetMax })}
      format={formatEur}
      scaleLabels={[
        formatEur(BUDGET.min),
        `Area average: ${formatEur(BUDGET.areaAverage)}`,
        formatEur(BUDGET.max),
      ]}
    />
    <div className="flex flex-col gap-2">
      <span className="text-label-sm text-steel">Property setup</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FlowStatTile
          label="Bedrooms"
          icon={<BedDouble size={20} aria-hidden />}
          options={roomOptions}
          value={prefs.rooms as (typeof roomOptions)[number]}
          onChange={(rooms) => onChange({ rooms })}
          format={(rooms) =>
            rooms >= 3 ? "3+ bedrooms" : `${rooms} ${rooms === 1 ? "bedroom" : "bedrooms"}`
          }
        />
        <FlowStatTile
          label="Min. size"
          icon={<Scaling size={20} aria-hidden />}
          options={sizeOptions}
          value={prefs.sizeMin as (typeof sizeOptions)[number]}
          onChange={(sizeMin) => onChange({ sizeMin })}
          format={(size) => `${size >= 80 ? "80+" : `+${size}`} m²`}
        />
      </div>
    </div>
  </FlowSectionCard>
);

export const MoveInStep = ({ prefs, onChange }: StepProps) => (
  <FlowSectionCard title="2. When are you moving?" icon={<Calendar size={16} aria-hidden />}>
    <FlowDateChips value={prefs.moveIn} onChange={(moveIn) => onChange({ moveIn })} />
  </FlowSectionCard>
);

export const MustHavesStep = ({ prefs, onChange }: StepProps) => (
  <FlowSectionCard
    title="3. Must-haves"
    icon={<BadgeCheck size={16} aria-hidden />}
    aside={<FlowBadge variant="muted">Strict filters</FlowBadge>}
  >
    <div role="group" aria-label="Must-haves" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {mustHaveOptions.map((option) => (
        <FlowSelectableTile
          key={option.id}
          label={option.label}
          icon={mustHaveIcons[option.icon]}
          selected={prefs.mustHaves.includes(option.id)}
          onToggle={() => onChange({ mustHaves: toggleId(prefs.mustHaves, option.id) })}
        />
      ))}
    </div>
  </FlowSectionCard>
);

export const DealBreakersStep = ({ prefs, onChange }: StepProps) => (
  <FlowSectionCard
    title="5. Dealbreakers"
    icon={<Shield size={16} aria-hidden />}
    iconTone="deep"
    aside={<FlowBadge variant="deep">Auto-discard</FlowBadge>}
    description="Chezy automatically discards any listing with these conditions:"
  >
    <div className="flex flex-col gap-2">
      {dealBreakerOptions.map((option) => (
        <FlowCheckboxRow
          key={option.id}
          label={option.label}
          icon={dealBreakerIcons[option.icon]}
          checked={prefs.dealBreakers.includes(option.id)}
          onChange={() => onChange({ dealBreakers: toggleId(prefs.dealBreakers, option.id) })}
        />
      ))}
    </div>
  </FlowSectionCard>
);

export const AutonomyStep = ({ prefs, onChange }: StepProps) => (
  <FlowSectionCard
    title="6. Agent autonomy"
    icon={<Shield size={16} aria-hidden />}
    aside={<FlowBadge variant="accent">Key decision</FlowBadge>}
  >
    <div role="radiogroup" aria-label="Agent autonomy" className="flex flex-col gap-2">
      {autonomyOptions.map((option) => {
        const isSelected = prefs.autonomy === option.level;
        return (
          <button
            key={option.level}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange({ autonomy: option.level })}
            className={cn(
              "flex min-h-11 items-start justify-between gap-3 rounded-[18px] p-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-obsidian",
              isSelected ? "bg-obsidian text-snow" : "bg-paper text-graphite hover:text-obsidian",
            )}
          >
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body-medium font-semibold">{option.title}</span>
              <span
                className={cn("text-label-md font-normal", isSelected ? "text-mist" : "text-fog")}
              >
                {option.description}
              </span>
            </div>
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                isSelected ? "bg-snow text-obsidian" : "bg-cloud text-transparent",
              )}
            >
              <Check size={12} />
            </span>
          </button>
        );
      })}
    </div>
  </FlowSectionCard>
);

export const SummaryStep = ({ prefs, onChange }: StepProps) => {
  const autonomyLabel = autonomyOptions.find((o) => o.level === prefs.autonomy)?.title ?? "—";
  const commuteLabel =
    commuteOptions.find((o) => o.value === prefs.commuteMaxMin)?.description ?? "—";
  const moveInLabel =
    prefs.moveIn?.mode === "flexible"
      ? "Flexible (±15 days)"
      : prefs.moveIn?.mode === "date" && prefs.moveIn.date
        ? prefs.moveIn.date
        : "—";
  const mustHaveLabels = mustHaveOptions
    .filter((o) => prefs.mustHaves.includes(o.id))
    .map((o) => o.label);
  const dealBreakerLabels = dealBreakerOptions
    .filter((o) => prefs.dealBreakers.includes(o.id))
    .map((o) => o.label);

  const rows: Array<[string, string]> = [
    ["Monthly range", `${formatEur(prefs.budgetMin)} — ${formatEur(prefs.budgetMax)}`],
    [
      "Space",
      `${prefs.rooms >= 3 ? "3+" : prefs.rooms} bd · ${prefs.sizeMin >= 80 ? "80+" : `+${prefs.sizeMin}`} m²`,
    ],
    ["Move-in", moveInLabel],
    ["Must-haves", mustHaveLabels.length > 0 ? mustHaveLabels.join(", ") : "—"],
    [
      "Neighborhoods",
      prefs.zones.length > 0 ? prefs.zones.map(zoneLabel).join(", ") : "Anywhere in Barcelona",
    ],
    ["Commute", commuteLabel],
    ["Work address", prefs.workAddress || "—"],
    [
      "Dealbreakers",
      dealBreakerLabels.length > 0
        ? `${dealBreakerLabels.length} of ${dealBreakerOptions.length} on`
        : "None",
    ],
    ["Agent autonomy", autonomyLabel],
  ];

  return (
    <div className="flex flex-col gap-3">
      <dl className="divide-y divide-cloud overflow-hidden rounded-[24px] bg-snow shadow-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 px-5 py-3">
            <dt className="shrink-0 text-label-sm font-normal text-fog">{label}</dt>
            <dd className="text-right text-body-medium text-graphite">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center justify-between gap-3 rounded-[28px] bg-paper p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-snow text-obsidian">
            <BellRing size={20} aria-hidden />
          </div>
          <div className="flex flex-col">
            <span className="text-body-medium font-semibold text-obsidian">Real-time alerts</span>
            <span className="text-label-sm font-normal text-fog">
              Chezy will notify you via push & WhatsApp
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {prefs.alerts ? <FlowBadge variant="accent">Active</FlowBadge> : undefined}
          <FlowSwitch
            label="Real-time alerts"
            checked={prefs.alerts}
            onChange={(alerts) => onChange({ alerts })}
          />
        </div>
      </div>
    </div>
  );
};
