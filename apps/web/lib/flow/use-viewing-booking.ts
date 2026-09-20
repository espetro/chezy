import type { BookingResult } from "@chezy/contract";
import { useRef, useState } from "react";
import * as v from "valibot";
import { createBookingController, type BookingState } from "~/lib/booking";
import {
  CONFIRM_HOLD_MS,
  LIVE_CALL_TIMEOUT_MS,
  LIVE_POLL_MS,
  LIVE_STAGE_AT_MS,
  MOCK_STAGE_MS,
} from "~/lib/flow/constants";
import { createViewingController, type ViewingState } from "~/lib/viewing";

export type ViewingPhase = "idle" | "calling" | "booking" | "booked" | "failed";

// Transcript stages shown while calling: 0 calling, 1 asking about the
// listing, 2 proposing a slot, 3 confirming the visit.
export const CALL_STAGES = 4;
const LAST_STAGE = CALL_STAGES - 1;

const StatusSchema = v.object({
  status: v.string(),
  slotIso: v.optional(v.string()),
  calendarChannel: v.optional(v.picklist(["mock", "google"])),
});

const browserStorage = {
  getItem: (key: string) => localStorage.getItem(key) ?? undefined,
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function derivePhase(call: ViewingState, booking: BookingState): ViewingPhase {
  if (booking.status === "booked") return "booked";
  if (booking.status === "booking") return "booking";
  if (booking.status === "failed") return "failed";
  switch (call.status) {
    case "dispatching":
    case "dispatched":
    case "simulated":
      return "calling";
    case "failed":
      return "failed";
    default:
      return "idle";
  }
}

const liveStage = (elapsedMs: number) =>
  LIVE_STAGE_AT_MS.filter((at) => elapsedMs >= at).length - 1;

// One state machine for the detail gate and the card action: the viewing call
// (lib/viewing owns the live-call safety rules) followed by the calendar
// booking. Every request asks for a live call; the server degrades to a
// simulated slot in mock mode, which the client then books itself. A live
// dispatch is booked by the voice agent's webhook, so the client polls for it.
export function useViewingBooking(listingId: string) {
  const [call, setCall] = useState<ViewingState>({ status: "idle" });
  const [booking, setBooking] = useState<BookingState>({ status: "idle" });
  const [stage, setStage] = useState(0);
  const viewing = useRef<ReturnType<typeof createViewingController> | undefined>(undefined);
  const calendar = useRef<ReturnType<typeof createBookingController> | undefined>(undefined);
  const polling = useRef(false);

  const controllers = () => {
    viewing.current ??= createViewingController(listingId, browserStorage);
    calendar.current ??= createBookingController(listingId, browserStorage);
    return { viewing: viewing.current, calendar: calendar.current };
  };

  const confirm = async (result: BookingResult) => {
    setStage(LAST_STAGE);
    await wait(CONFIRM_HOLD_MS);
    setBooking(controllers().calendar.remember(result));
  };

  const bookSimulated = async (slotIso: string) => {
    for (let next = 1; next <= LAST_STAGE; next++) {
      await wait(MOCK_STAGE_MS);
      setStage(next);
    }
    await wait(CONFIRM_HOLD_MS);
    setBooking({ status: "booking" });
    setBooking(await controllers().calendar.book(slotIso));
  };

  const followLiveCall = async () => {
    if (polling.current) return;
    polling.current = true;
    const startedAt = Date.now();
    try {
      for (;;) {
        await wait(LIVE_POLL_MS);
        const elapsed = Date.now() - startedAt;
        setStage((current) => Math.max(current, liveStage(elapsed)));
        const response = await fetch(
          `/api/viewing/status?propertyRef=${encodeURIComponent(listingId)}`,
        ).catch(() => undefined);
        const parsed = response?.ok
          ? v.safeParse(StatusSchema, await response.json().catch(() => undefined))
          : undefined;
        const status = parsed?.success ? parsed.output : undefined;
        if (status?.status === "booked" && status.slotIso) {
          await confirm({
            status: "booked",
            channel: status.calendarChannel ?? "mock",
            slotIso: status.slotIso,
          });
          return;
        }
        if (status?.status === "failed") {
          setCall({
            status: "failed",
            detail: "The agency call ended without a booking.",
            retryable: true,
            live: true,
          });
          return;
        }
        if (elapsed > LIVE_CALL_TIMEOUT_MS) {
          setCall({
            status: "failed",
            detail: "No booking came back from the call. Try again.",
            retryable: true,
            live: true,
          });
          return;
        }
      }
    } finally {
      polling.current = false;
    }
  };

  const restore = () => {
    const { viewing, calendar } = controllers();
    const restored = { call: viewing.restore(), booking: calendar.restore() };
    setCall(restored.call);
    setBooking(restored.booking);
    if (restored.booking.status === "idle") {
      if (restored.call.status === "dispatched") void followLiveCall();
      if (restored.call.status === "simulated") {
        setStage(LAST_STAGE);
        setBooking({ status: "booking" });
        void calendar.book(restored.call.result.slotIso).then(setBooking);
      }
    }
    return restored;
  };

  const start = async () => {
    const { viewing } = controllers();
    setStage(0);
    setCall({ status: "dispatching" });
    const outcome = await viewing.start(true);
    setCall(outcome);
    if (outcome.status === "simulated") await bookSimulated(outcome.result.slotIso);
    else if (outcome.status === "dispatched") await followLiveCall();
  };

  const retryBooking = async () => {
    if (call.status !== "simulated") return;
    setBooking({ status: "booking" });
    setBooking(await controllers().calendar.book(call.result.slotIso));
  };

  const slotIso =
    call.status === "simulated"
      ? call.result.slotIso
      : booking.status === "booked"
        ? booking.result.slotIso
        : undefined;

  return {
    call,
    booking,
    stage,
    slotIso,
    phase: derivePhase(call, booking),
    start,
    restore,
    retryBooking,
  };
}
