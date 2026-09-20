import { ViewingResultSchema, type ViewingResult } from "@chezy/contract";
import * as v from "valibot";

export type ViewingState =
  | { status: "idle" | "dispatching" }
  | { status: "simulated"; result: Extract<ViewingResult, { status: "mock" }> }
  | { status: "dispatched"; result: Extract<ViewingResult, { status: "dispatched" }> }
  // `live` records whether a live attempt is on record for this listing. A
  // rejected live opt-in (config statuses below) clears it, unlocking the
  // simulation controls again.
  | { status: "failed"; detail: string; retryable: boolean; live: boolean };

export type ViewingOutcome =
  | Exclude<ViewingState, { status: "failed" }>
  | Omit<Extract<ViewingState, { status: "failed" }>, "live">;

// Statuses that mean the request was rejected before any provider attempt, so
// the user is not committed to the live path.
const CONFIG_REJECTION_STATUSES = [400, 401, 403, 503];

const ReceiptSchema = v.object({
  requestId: v.pipe(v.string(), v.uuid()),
  result: v.optional(ViewingResultSchema),
  retry: v.optional(v.boolean(), true),
});

export function resolveViewingResponse(body: unknown, ok: boolean): ViewingOutcome {
  const parsed = v.safeParse(ViewingResultSchema, body);
  if (!parsed.success) {
    return {
      status: "failed",
      detail: "Invalid call response. Retry with the same request ID to retrieve the outcome.",
      retryable: true,
    };
  }
  const result = parsed.output;
  if (result.status === "failed") {
    return { status: "failed", detail: result.detail, retryable: result.retryable };
  }
  if (!ok) {
    return { status: "failed", detail: "Call request was not accepted.", retryable: true };
  }
  return result.status === "mock"
    ? { status: "simulated", result }
    : { status: "dispatched", result };
}

export function createViewingController(
  propertyRef: string,
  storage: {
    getItem: (key: string) => string | undefined;
    setItem: (key: string, value: string) => void;
  },
  fetcher: typeof fetch = fetch,
) {
  const key = `chezy:viewing:${propertyRef}`;
  let state: ViewingState = { status: "idle" };
  let inFlight: Promise<ViewingState> | undefined;
  let liveRequested = false;
  let requestId: string | undefined;
  let attempted = false;

  const withMode = (outcome: ViewingOutcome): ViewingState =>
    outcome.status === "failed" ? { ...outcome, live: liveRequested } : outcome;

  function restore(): ViewingState {
    try {
      const saved = storage.getItem(key);
      if (!saved) return state;
      const receipt = v.parse(ReceiptSchema, JSON.parse(saved));
      requestId = receipt.requestId;
      attempted = receipt.retry;
      liveRequested = receipt.retry;
      state = receipt.result
        ? withMode(resolveViewingResponse(receipt.result, true))
        : {
            status: "failed",
            detail: "Call response unavailable. Retry the same request to retrieve its outcome.",
            retryable: true,
            live: liveRequested,
          };
    } catch {
      state = {
        status: "failed",
        detail: "Call history unavailable. Check the provider before making another live call.",
        retryable: false,
        live: true,
      };
    }
    return state;
  }

  async function send(): Promise<ViewingState> {
    const retry = liveRequested && attempted;
    if (liveRequested) {
      try {
        requestId ??= crypto.randomUUID();
        storage.setItem(key, JSON.stringify({ requestId, retry: true }));
      } catch {
        return withMode({
          status: "failed",
          detail: "Browser storage is required for safe live-call retries.",
          retryable: true,
        });
      }
    }
    try {
      attempted ||= liveRequested;
      const response = await fetcher("/api/viewing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyRef,
          live: liveRequested,
          requestId: liveRequested ? requestId : undefined,
          retry,
        }),
      });
      const body: unknown = await response.json();
      const outcome = resolveViewingResponse(body, response.ok);
      const parsed = v.safeParse(ViewingResultSchema, body);
      if (liveRequested && parsed.success && (response.ok || parsed.output.status === "failed")) {
        if (
          parsed.output.status === "failed" &&
          parsed.output.retryable &&
          CONFIG_REJECTION_STATUSES.includes(response.status)
        ) {
          attempted = false;
          liveRequested = false;
        }
        try {
          storage.setItem(
            key,
            JSON.stringify({ requestId, result: parsed.output, retry: attempted }),
          );
        } catch {
          // Keep the in-memory outcome and the previously persisted request ID.
        }
      }
      return withMode(outcome);
    } catch {
      return withMode({
        status: "failed",
        detail: "Network error or unreadable response. Retry uses the same call request.",
        retryable: true,
      });
    }
  }

  function start(live = false): Promise<ViewingState> {
    if (inFlight) return inFlight;
    if (live && !liveRequested) restore();
    if (
      state.status === "dispatched" ||
      (state.status === "simulated" && !live) ||
      (state.status === "failed" && !state.retryable)
    ) {
      return Promise.resolve(state);
    }
    liveRequested ||= live;
    state = { status: "dispatching" };
    inFlight = send().then((outcome) => {
      state = outcome;
      inFlight = undefined;
      return state;
    });
    return inFlight;
  }

  function abandon(detail: string): ViewingState {
    state = { status: "failed", detail, retryable: true, live: true };
    requestId = undefined;
    attempted = false;
    inFlight = undefined;
    try {
      storage.setItem(
        key,
        JSON.stringify({
          requestId: crypto.randomUUID(),
          result: { status: "failed", channel: "slng", retryable: true, detail },
          retry: false,
        }),
      );
    } catch {
      // Keep the in-memory outcome when browser storage is unavailable.
    }
    return state;
  }

  return { restore, start, abandon };
}
