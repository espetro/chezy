import type { AutonomyOption, CommuteMax, ListingTag, UserPreferences } from "~/lib/flow/types";
import { DISTRICT_CHIPS } from "~/lib/neighbourhoods";

// Stored zones are the ilike-compatible district values; labels are what the chips show.
export const zoneOptions = DISTRICT_CHIPS.map((chip) => ({
  label: chip.label,
  value: chip.value,
}));

export const zoneLabel = (value: string) =>
  DISTRICT_CHIPS.find((chip) => chip.value === value)?.label ?? value;

export interface CommuteOption {
  value: CommuteMax;
  label: string;
  description: string;
}

export const commuteOptions: CommuteOption[] = [
  { value: 15, label: "15 min", description: "Max 15 min by metro" },
  { value: 25, label: "25 min", description: "Max 25 min by metro" },
  { value: 40, label: "40 min", description: "Max 40 min by metro" },
];

export const BUDGET = { min: 600, max: 4000, step: 50, areaAverage: 1150 } as const;
export const roomOptions = [1, 2, 3] as const;
export const sizeOptions = [40, 60, 80] as const;

export type MustHaveIcon = "sun" | "umbrella" | "elevator" | "snowflake" | "sofa" | "paw";

export interface MustHaveOption {
  id: string;
  label: string;
  icon: MustHaveIcon;
  tag: ListingTag | undefined;
}

export const mustHaveOptions: MustHaveOption[] = [
  { id: "natural-light", label: "Natural light", icon: "sun", tag: "Exterior-facing" },
  { id: "balcony", label: "Balcony / terrace", icon: "umbrella", tag: "Terrace" },
  { id: "elevator", label: "Elevator", icon: "elevator", tag: "Elevator" },
  { id: "air-conditioning", label: "Air conditioning", icon: "snowflake", tag: undefined },
  { id: "furnished", label: "Furnished", icon: "sofa", tag: "Furnished" },
  { id: "pets", label: "Pets allowed", icon: "paw", tag: "Pets allowed" },
];

export type DealBreakerId = "no-dark-interior" | "no-excessive-deposit" | "no-unknown-flatmates";
export type DealBreakerIcon = "ban" | "warning" | "user-x";

export interface DealBreakerOption {
  id: DealBreakerId;
  label: string;
  icon: DealBreakerIcon;
}

export const dealBreakerOptions: DealBreakerOption[] = [
  { id: "no-dark-interior", label: "No dark ground floors or interior-facing units", icon: "ban" },
  {
    id: "no-excessive-deposit",
    label: "No agencies with excessive deposit (+2 months)",
    icon: "warning",
  },
  { id: "no-unknown-flatmates", label: "No unknown flatmates", icon: "user-x" },
];

export const autonomyOptions: AutonomyOption[] = [
  {
    level: "assist",
    title: "Just notify me",
    description:
      "The agent searches and scores, but you decide when to call the agency or book a visit.",
  },
  {
    level: "cowork",
    title: "Contact, I'll decide",
    description:
      "The agent searches, scores, and can call the agency for you whenever you ask. You stay in the loop.",
  },
  {
    level: "autopilot",
    title: "Autopilot",
    description:
      "The agent contacts, schedules, and negotiates within your limits. It only steps in when something irreversible needs a decision.",
  },
];

export type OnboardingStepId =
  | "welcome"
  | "routine"
  | "budget"
  | "moveIn"
  | "mustHaves"
  | "dealBreakers"
  | "autonomy"
  | "summary";

export interface OnboardingStep {
  id: OnboardingStepId;
  agentMessage: string;
  sectionTitle: string;
  cta: string;
}

export const onboardingSteps: OnboardingStep[] = [
  {
    id: "welcome",
    agentMessage:
      "Hi! To filter with precision across thousands of listings and agencies, let's define your must-haves.",
    sectionTitle: "Search parameters",
    cta: "Let's go",
  },
  {
    id: "routine",
    agentMessage: "Where do you spend your days, and how far are you willing to commute?",
    sectionTitle: "Routine & area",
    cta: "Continue",
  },
  {
    id: "budget",
    agentMessage: "What's your monthly range, and how much space do you need?",
    sectionTitle: "Budget & space",
    cta: "Continue",
  },
  {
    id: "moveIn",
    agentMessage: "When could you move in?",
    sectionTitle: "When are you moving?",
    cta: "Continue",
  },
  {
    id: "mustHaves",
    agentMessage: "What can't you live without? Select everything that applies.",
    sectionTitle: "Must-haves",
    cta: "Continue",
  },
  {
    id: "dealBreakers",
    agentMessage:
      "Now the opposite — what should I rule out entirely, no matter how good the rest looks?",
    sectionTitle: "Dealbreakers",
    cta: "Continue",
  },
  {
    id: "autonomy",
    agentMessage:
      "Last decision, the most important one: how much autonomy do you want to give me? You can change this anytime.",
    sectionTitle: "Agent autonomy",
    cta: "Confirm autonomy level",
  },
  {
    id: "summary",
    agentMessage: "Perfect — here's what I understood. Review it before I start searching.",
    sectionTitle: "Review",
    cta: "Start searching",
  },
];

// Steps that count toward the progress bar (welcome is step 0, summary is the last).
export const progressStepCount = onboardingSteps.length - 1;

// Data-driven defaults (median rent ≈ €3,250): shared by the onboarding UI and the
// server page's initial candidate count.
export const defaultPreferences: UserPreferences = {
  workAddress: "",
  commuteMaxMin: undefined,
  zones: [],
  budgetMin: 1200,
  budgetMax: 2500,
  rooms: 2,
  sizeMin: 50,
  moveIn: undefined,
  mustHaves: [],
  dealBreakers: dealBreakerOptions.map((option) => option.id),
  alerts: true,
  autonomy: "cowork",
};
