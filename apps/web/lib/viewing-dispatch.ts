import type { ViewingResult } from "@chezy/contract";

export class CallDispatchError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "CallDispatchError";
  }
}

interface Receipt {
  fingerprint: string;
  result: Promise<ViewingResult>;
}

// Process-local receipts; keep uncertain outcomes until an operator checks the provider.
export function createDispatchReceipts() {
  const receipts = new Map<string, Receipt>();
  return async function dispatchOnce(
    key: string,
    fingerprint: string,
    channel: "slng" | "vonage",
    dispatch: () => Promise<ViewingResult>,
    retry = false,
  ): Promise<ViewingResult> {
    const existing = receipts.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        return {
          status: "failed",
          channel,
          retryable: false,
          detail: "This request ID belongs to another call.",
        };
      }
      const outcome = await existing.result;
      if (!(retry && outcome.status === "failed" && outcome.retryable)) return outcome;
      // Only one concurrent retry may replace a known rejected attempt.
      if (receipts.get(key) !== existing) return dispatchOnce(key, fingerprint, channel, dispatch);
    } else if (retry) {
      return {
        status: "failed",
        channel,
        retryable: false,
        detail: "Call receipt unavailable on this server. Check the provider before a new call.",
      };
    }
    if (!existing && receipts.size >= 1000) {
      return {
        status: "failed",
        channel,
        retryable: false,
        detail: "Call receipt capacity reached. Contact the demo operator.",
      };
    }
    const result = Promise.resolve()
      .then(dispatch)
      .catch(
        (error: unknown): ViewingResult => ({
          status: "failed",
          channel,
          retryable: error instanceof CallDispatchError && error.retryable,
          detail:
            error instanceof CallDispatchError && error.retryable
              ? "Call request rejected before acceptance. Check configuration and retry."
              : "Dispatch outcome is uncertain. Check the provider before requesting another call.",
        }),
      );
    receipts.set(key, { fingerprint, result });
    return result;
  };
}
