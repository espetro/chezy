"use client";

import { useMountEffect } from "@chezy/ui/hooks/useMountEffect";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ChatBubble } from "@/components/flow/onboarding/ChatBubble";
import {
  AutonomyStep,
  BudgetStep,
  DealBreakersStep,
  MoveInStep,
  MustHavesStep,
  RoutineStep,
  SummaryStep,
  formatEur,
} from "@/components/flow/onboarding/OnboardingSteps";
import { ThinkingBubble } from "@/components/flow/onboarding/ThinkingBubble";
import { FlowStepper } from "@/components/flow/ui/Stepper";
import { FlowStickyActionBar } from "@/components/flow/ui/StickyActionBar";
import { toSearchProfileInput } from "@/lib/flow/adapters";
import { AGENT_THINKING_DELAY_MS } from "@/lib/flow/constants";
import {
  autonomyOptions,
  commuteOptions,
  dealBreakerOptions,
  defaultPreferences,
  mustHaveOptions,
  onboardingSteps,
  progressStepCount,
  zoneLabel,
  type OnboardingStepId,
} from "@/lib/flow/onboarding-steps";
import type { UserPreferences } from "@/lib/flow/types";

interface HistoryEntry {
  agentMessage: string;
  userAnswer?: string;
}

const randomThinkingDelay = () =>
  AGENT_THINKING_DELAY_MS.min +
  Math.random() * (AGENT_THINKING_DELAY_MS.max - AGENT_THINKING_DELAY_MS.min);

// Module-level so its identity is stable: React then calls it only on mount/unmount of the
// element, not on every render (an inline arrow would re-scroll on each keystroke).
const scrollIntoViewOnMount = (element: HTMLDivElement | null) => {
  element?.scrollIntoView({ behavior: "smooth", block: "end" });
};

const canSubmit = (id: OnboardingStepId, prefs: UserPreferences) => {
  switch (id) {
    case "routine":
      return prefs.workAddress.trim().length > 0 && prefs.commuteMaxMin !== undefined && prefs.zones.length > 0;
    case "moveIn":
      return prefs.moveIn?.mode === "flexible" || (prefs.moveIn?.mode === "date" && prefs.moveIn.date !== "");
    default:
      return true;
  }
};

const answerSummary = (id: OnboardingStepId, prefs: UserPreferences): string | undefined => {
  switch (id) {
    case "welcome":
      return "Let's go";
    case "routine": {
      const commute = commuteOptions.find((o) => o.value === prefs.commuteMaxMin)?.label;
      return `${prefs.zones.map(zoneLabel).join(", ")} · max ${commute} from ${prefs.workAddress}`;
    }
    case "budget":
      return `${formatEur(prefs.budgetMin)} — ${formatEur(prefs.budgetMax)} · ${prefs.rooms >= 3 ? "3+" : prefs.rooms} bd · +${prefs.sizeMin} m²`;
    case "moveIn":
      return prefs.moveIn?.mode === "flexible" ? "Flexible (±15 days)" : prefs.moveIn?.date;
    case "mustHaves": {
      const labels = mustHaveOptions.filter((o) => prefs.mustHaves.includes(o.id)).map((o) => o.label);
      return labels.length > 0 ? labels.join(", ") : "Nothing specific";
    }
    case "dealBreakers": {
      const count = dealBreakerOptions.filter((o) => prefs.dealBreakers.includes(o.id)).length;
      return count > 0 ? `${count} of ${dealBreakerOptions.length} dealbreakers on` : "No dealbreakers";
    }
    case "autonomy":
      return autonomyOptions.find((o) => o.level === prefs.autonomy)?.title;
    default:
      return undefined;
  }
};

interface OnboardingFlowProps {
  initial?: UserPreferences;
  initialCount: number;
}

const countCandidates = async (prefs: UserPreferences): Promise<number | undefined> => {
  const params = new URLSearchParams({
    maxPriceEur: String(prefs.budgetMax),
    minRooms: String(prefs.rooms),
    minM2: String(prefs.sizeMin),
  });
  if (prefs.zones.length > 0) params.set("neighbourhoods", prefs.zones.join(","));
  try {
    const response = await fetch(`/api/profile/count?${params}`);
    if (!response.ok) return undefined;
    const data: { count?: unknown } = await response.json();
    return typeof data.count === "number" ? data.count : undefined;
  } catch {
    return undefined;
  }
};

export const OnboardingFlow = ({ initial, initialCount }: OnboardingFlowProps) => {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(initial ?? defaultPreferences);
  const [matchCount, setMatchCount] = useState(initialCount);
  const [isThinking, setIsThinking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const thinkingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const countTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const think = () => {
    clearTimeout(thinkingTimer.current);
    setIsThinking(true);
    thinkingTimer.current = setTimeout(function revealAgentMessage() {
      setIsThinking(false);
    }, randomThinkingDelay());
  };

  useMountEffect(function startInitialThinking() {
    think();
    return function clearPendingThinking() {
      clearTimeout(thinkingTimer.current);
    };
  });

  const currentStep = onboardingSteps[stepIndex];
  if (!currentStep) return undefined;

  const updatePreferences = (patch: Partial<UserPreferences>) =>
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      clearTimeout(countTimer.current);
      countTimer.current = setTimeout(async function refreshCount() {
        const count = await countCandidates(next);
        if (count !== undefined) setMatchCount(count);
      }, 300);
      return next;
    });

  const submitProfile = async () => {
    setSubmitting(true);
    setSubmitError(undefined);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSearchProfileInput(preferences)),
      });
      if (!response.ok) {
        setSubmitError("Couldn't save your search — please try again.");
        setSubmitting(false);
        return;
      }
      router.push("/explore");
    } catch {
      setSubmitError("Couldn't save your search — please try again.");
      setSubmitting(false);
    }
  };

  const submitStep = () => {
    if (currentStep.id === "summary") {
      void submitProfile();
      return;
    }
    setHistory((prev) => [
      ...prev,
      { agentMessage: currentStep.agentMessage, userAnswer: answerSummary(currentStep.id, preferences) },
    ]);
    setStepIndex((index) => index + 1);
    think();
  };

  const stepProps = { prefs: preferences, onChange: updatePreferences };

  const renderActiveStep = () => {
    switch (currentStep.id) {
      case "welcome":
        return undefined;
      case "routine":
        return <RoutineStep {...stepProps} />;
      case "budget":
        return <BudgetStep {...stepProps} />;
      case "moveIn":
        return <MoveInStep {...stepProps} />;
      case "mustHaves":
        return <MustHavesStep {...stepProps} />;
      case "dealBreakers":
        return <DealBreakersStep {...stepProps} />;
      case "autonomy":
        return <AutonomyStep {...stepProps} />;
      case "summary":
        return <SummaryStep {...stepProps} />;
      default:
        return undefined;
    }
  };

  const welcomeMeta =
    currentStep.id === "welcome" ? (
      <span className="rounded-full bg-paper px-2 py-0.5 text-label-sm font-normal text-fog">
        Estimated time: 1 min
      </span>
    ) : undefined;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4">
      <div className="sticky top-0 z-10 -mx-4 bg-paper/90 px-4 pt-3 pb-2 backdrop-blur-md">
        <FlowStepper step={stepIndex} total={progressStepCount} label={currentStep.sectionTitle} />
      </div>

      <div className="flex flex-1 flex-col gap-5 py-5">
        {history.map((entry, index) => (
          <div key={`${entry.agentMessage}-${index}`} className="flex flex-col gap-2">
            <ChatBubble from="agent">{entry.agentMessage}</ChatBubble>
            {entry.userAnswer ? (
              <div className="animate-fade-up">
                <ChatBubble from="user">{entry.userAnswer}</ChatBubble>
              </div>
            ) : undefined}
          </div>
        ))}

        {isThinking ? (
          <div ref={scrollIntoViewOnMount} className="animate-fade-up">
            <ThinkingBubble />
          </div>
        ) : (
          <div key={currentStep.id} ref={scrollIntoViewOnMount} className="flex flex-col gap-4">
            <div className="animate-fade-up">
              <ChatBubble from="agent" meta={welcomeMeta}>
                {currentStep.agentMessage}
              </ChatBubble>
            </div>
            {currentStep.id !== "welcome" ? (
              <div className="animate-fade-up [animation-delay:180ms]">{renderActiveStep()}</div>
            ) : undefined}
          </div>
        )}
      </div>

      <FlowStickyActionBar
        matchCount={matchCount}
        cta={currentStep.cta}
        disabled={isThinking || submitting || !canSubmit(currentStep.id, preferences)}
        error={submitError}
        onAction={submitStep}
      />
    </div>
  );
};
