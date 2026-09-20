import { BookingResultSchema, type BookingResult } from "@chezy/contract";
import * as v from "valibot";

export type BookingState =
  | { status: "idle" | "booking" }
  | { status: "booked"; result: BookingResult }
  | { status: "failed"; detail: string };

const FALLBACK_DETAIL = "The calendar did not confirm the visit. Try again.";

export function resolveBookingResponse(body: unknown, ok: boolean): BookingState {
  const parsed = v.safeParse(BookingResultSchema, body);
  if (!parsed.success) return { status: "failed", detail: FALLBACK_DETAIL };
  const result = parsed.output;
  if (result.status === "failed" || !ok) {
    return { status: "failed", detail: result.detail ?? FALLBACK_DETAIL };
  }
  return { status: "booked", result };
}

export function createBookingController(
  propertyRef: string,
  storage: {
    getItem: (key: string) => string | undefined;
    setItem: (key: string, value: string) => void;
  },
  fetcher: typeof fetch = fetch,
) {
  const key = `chezy:booking:${propertyRef}`;
  let state: BookingState = { status: "idle" };
  let inFlight: Promise<BookingState> | undefined;

  function restore(): BookingState {
    try {
      const saved = storage.getItem(key);
      if (!saved) return state;
      const outcome = resolveBookingResponse(JSON.parse(saved), true);
      if (outcome.status === "booked") state = outcome;
    } catch {
      state = { status: "idle" };
    }
    return state;
  }

  async function send(slotIso: string): Promise<BookingState> {
    try {
      const response = await fetcher("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyRef, slotIso }),
      });
      const body: unknown = await response.json();
      const outcome = resolveBookingResponse(body, response.ok);
      return outcome.status === "booked" ? remember(outcome.result) : outcome;
    } catch {
      return { status: "failed", detail: FALLBACK_DETAIL };
    }
  }

  // A booking confirmed out of band (the voice agent's book_viewing webhook)
  // is recorded the same way as one this client requested.
  function remember(result: BookingResult): BookingState {
    state = { status: "booked", result };
    try {
      storage.setItem(key, JSON.stringify(result));
    } catch {
      // The in-memory outcome still renders; only the reload receipt is lost.
    }
    return state;
  }

  function book(slotIso: string): Promise<BookingState> {
    if (inFlight) return inFlight;
    if (state.status === "booked") return Promise.resolve(state);
    state = { status: "booking" };
    inFlight = send(slotIso).then((outcome) => {
      state = outcome;
      inFlight = undefined;
      return state;
    });
    return inFlight;
  }

  return { restore, book, remember };
}
