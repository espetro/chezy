import { appendActivity } from "~/lib/flow/agent-activity";
import type { FlowListing } from "~/lib/flow/types";
import { createViewingController } from "~/lib/viewing";

const slotFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

const storage = {
  getItem: (key: string) => localStorage.getItem(key) ?? undefined,
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};

// The auto-call path for a ≥95% match — always simulated, matching AgentCallGate's own
// manual "Simulate viewing call" button. A real call still requires the explicit live
// opt-in checkbox on the listing's own detail card. Shared by AutoCallBanner (the explore
// carousel) and AgentCallGate (the detail page) so whichever surface the user reaches
// first places the call, and both — plus AgentActivityToast and OnboardingFlow — read the
// same activity log afterward.
export const placeAgentCall = async (
  listing: Pick<FlowListing, "id" | "agency" | "title">,
): Promise<void> => {
  const base = { listingId: listing.id, agency: listing.agency, listingTitle: listing.title };
  appendActivity({
    ...base,
    id: crypto.randomUUID(),
    kind: "calling",
    createdAt: new Date().toISOString(),
  });

  const state = await createViewingController(listing.id, storage).start(false);

  if (state.status === "simulated") {
    appendActivity({
      ...base,
      id: crypto.randomUUID(),
      kind: "simulated",
      createdAt: new Date().toISOString(),
      visit: {
        slotIso: state.result.slotIso,
        label: slotFormatter.format(new Date(state.result.slotIso)),
        durationMinutes: 30,
      },
    });
  } else if (state.status === "dispatched") {
    appendActivity({
      ...base,
      id: crypto.randomUUID(),
      kind: "dispatched",
      createdAt: new Date().toISOString(),
    });
  } else if (state.status === "failed") {
    appendActivity({
      ...base,
      id: crypto.randomUUID(),
      kind: "failed",
      createdAt: new Date().toISOString(),
      error: state.detail,
    });
  }
};

export const autoCallKey = (listingId: string) => `chezy:autocall:${listingId}`;

// Claims the auto-call guard for a listing exactly once — across every mount, tab reload,
// and whichever surface (carousel banner or detail page) reaches it first.
export const claimAutoCall = (listingId: string): boolean => {
  try {
    if (localStorage.getItem(autoCallKey(listingId))) return false;
    localStorage.setItem(autoCallKey(listingId), new Date().toISOString());
    return true;
  } catch {
    return true;
  }
};
