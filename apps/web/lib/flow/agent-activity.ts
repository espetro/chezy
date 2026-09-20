import { useSyncExternalStore } from "react";

export interface AgentActivityVisit {
  slotIso: string;
  label: string;
  durationMinutes: number;
}

export interface AgentActivityEntry {
  id: string;
  kind: "calling" | "simulated" | "dispatched" | "failed";
  listingId: string;
  agency: string;
  listingTitle: string;
  createdAt: string;
  visit?: AgentActivityVisit;
  error?: string;
}

const ACTIVITY_KEY = "chezy-flow-agent-activity";

const readRaw = (): string => {
  try {
    return sessionStorage.getItem(ACTIVITY_KEY) ?? "[]";
  } catch {
    return "[]";
  }
};

const parseActivity = (raw: string): AgentActivityEntry[] => {
  try {
    return JSON.parse(raw) as AgentActivityEntry[];
  } catch {
    return [];
  }
};

export const readActivity = (): AgentActivityEntry[] => parseActivity(readRaw());

const subscribers = new Set<() => void>();

// Cross-surface log: AgentCallGate (listing detail), AutoCallBanner (explore carousel),
// AgentActivityToast (any other page), and OnboardingFlow's chat thread all read this same
// store, so wherever the user is when a ≥95% match calls, books, or fails, they see it.
export const appendActivity = (entry: AgentActivityEntry) => {
  try {
    sessionStorage.setItem(ACTIVITY_KEY, JSON.stringify([...readActivity(), entry]));
  } catch {
    // Storage unavailable (private tab, quota) — this tick's entry just won't persist.
  }
  for (const notify of subscribers) notify();
};

const subscribe = (callback: () => void) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};

const getServerSnapshot = () => "[]";

export const useAgentActivity = (): AgentActivityEntry[] => {
  const raw = useSyncExternalStore(subscribe, readRaw, getServerSnapshot);
  return parseActivity(raw);
};

export const useLatestCallActivity = (listingId: string): AgentActivityEntry | undefined => {
  const activity = useAgentActivity();
  for (let index = activity.length - 1; index >= 0; index -= 1) {
    const entry = activity[index];
    if (entry?.listingId === listingId) return entry;
  }
  return undefined;
};
