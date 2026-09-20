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
    return localStorage.getItem(ACTIVITY_KEY) ?? "[]";
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

// Cross-surface AND cross-tab log: AgentCallGate (listing detail), AutoCallBanner (explore
// carousel), AgentActivityToast (any other page), and OnboardingFlow's chat thread all read
// this same store — localStorage, not sessionStorage, so a call placed in one tab (or one
// claimed by claimAutoCall's shared guard) is still visible from any other tab open on the
// same listing, instead of that tab seeing a guard it can't dial past and nothing to show.
export const appendActivity = (entry: AgentActivityEntry) => {
  try {
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify([...readActivity(), entry]));
  } catch {
    // Storage unavailable (private tab, quota) — this tick's entry just won't persist.
  }
  for (const notify of subscribers) notify();
};

const subscribe = (callback: () => void) => {
  subscribers.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ACTIVITY_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    subscribers.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
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
