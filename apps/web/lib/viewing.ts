import { ViewingResultSchema, type ViewingResult } from "@chezy/contract";
import * as v from "valibot";

export type ViewingState =
  | { status: "idle" | "dispatching" }
  | { status: "simulated"; result: Extract<ViewingResult, { status: "mock" }> }
  | { status: "dispatched"; result: Extract<ViewingResult, { status: "dispatched" }> }
  | { status: "failed"; detail: string; retryable: boolean };

const ReceiptSchema = v.object({
  requestId: v.pipe(v.string(), v.uuid()),
  result: v.optional(ViewingResultSchema),
  retry: v.optional(v.boolean(), true),
});

export function resolveViewingResponse(body: unknown, ok: boolean): ViewingState {
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

  function restore(): ViewingState {
    try {
      const saved = storage.getItem(key);
      if (!saved) return state;
      const receipt = v.parse(ReceiptSchema, JSON.parse(saved));
      requestId = receipt.requestId;
      attempted = receipt.retry;
      liveRequested = true;
      state = receipt.result
        ? resolveViewingResponse(receipt.result, true)
        : {
            status: "failed",
            detail: "Call response unavailable. Retry the same request to retrieve its outcome.",
            retryable: true,
          };
    } catch {
      state = {
        status: "failed",
        detail: "Call history unavailable. Check the provider before making another live call.",
        retryable: false,
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
        return {
          status: "failed",
          detail: "Browser storage is required for safe live-call retries.",
          retryable: true,
        };
      }
    }
    try {
      attempted ||= liveRequested;
      const response = await fetcher("/api/viewing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyRef, live: liveRequested, requestId, retry }),
      });
      const body: unknown = await response.json();
      const outcome = resolveViewingResponse(body, response.ok);
      const parsed = v.safeParse(ViewingResultSchema, body);
      if (liveRequested && parsed.success && (response.ok || parsed.output.status === "failed")) {
        if (
          parsed.output.status === "failed" &&
          parsed.output.retryable &&
          [400, 401, 403, 503].includes(response.status)
        ) {
          attempted = false;
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
      return outcome;
    } catch {
      return {
        status: "failed",
        detail: "Network error or unreadable response. Retry uses the same call request.",
        retryable: true,
      };
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

  return { restore, start };
}
