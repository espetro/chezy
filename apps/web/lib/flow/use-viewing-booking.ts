import { useRef, useState } from "react";
import { createBookingController, type BookingState } from "~/lib/booking";
import { CALL_SEQUENCE_MS } from "~/lib/flow/constants";
import { createViewingController, type ViewingState } from "~/lib/viewing";

export type ViewingPhase = "idle" | "calling" | "booking" | "booked" | "awaiting" | "failed";

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
      return "calling";
    case "dispatched":
      return "awaiting";
    case "failed":
      return "failed";
    case "simulated":
      return "booking";
    default:
      return "idle";
  }
}

// One state machine for the detail gate and the card action: the viewing call
// (lib/viewing owns the live-call safety rules) followed by the calendar booking.
// A simulated call books from the client; a live dispatch is booked by the
// provider webhook, so the client only waits.
export function useViewingBooking(listingId: string) {
  const [call, setCall] = useState<ViewingState>({ status: "idle" });
  const [booking, setBooking] = useState<BookingState>({ status: "idle" });
  const viewing = useRef<ReturnType<typeof createViewingController> | undefined>(undefined);
  const calendar = useRef<ReturnType<typeof createBookingController> | undefined>(undefined);

  const controllers = () => {
    viewing.current ??= createViewingController(listingId, browserStorage);
    calendar.current ??= createBookingController(listingId, browserStorage);
    return { viewing: viewing.current, calendar: calendar.current };
  };

  const restore = () => {
    const { viewing, calendar } = controllers();
    const restored = { call: viewing.restore(), booking: calendar.restore() };
    setCall(restored.call);
    setBooking(restored.booking);
    return restored;
  };

  const start = async (live = false) => {
    const { viewing, calendar } = controllers();
    setCall({ status: "dispatching" });
    const [outcome] = await Promise.all([viewing.start(live), wait(CALL_SEQUENCE_MS)]);
    setCall(outcome);
    if (outcome.status !== "simulated") return;
    setBooking({ status: "booking" });
    setBooking(await calendar.book(outcome.result.slotIso));
  };

  const retryBooking = async () => {
    if (call.status !== "simulated") return;
    setBooking({ status: "booking" });
    setBooking(await controllers().calendar.book(call.result.slotIso));
  };

  return { call, booking, phase: derivePhase(call, booking), start, restore, retryBooking };
}
