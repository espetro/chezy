// Simulated call/booking outcome for /flow's AgentCallGate. Deliberately not wired to the
// real `/api/viewing` + `/api/calendar` routes (see AgentCallGate.tsx and
// .agents/docs/screens/flow-match.md "Notes" for why): those sit behind apps/web/proxy.ts's
// "/api/:path*" auth matcher, and /flow is meant to render without a session. This mirrors
// the vocabulary of packages/contract's ViewingResult/BookingResult without importing them,
// so /flow stays free of that dependency.

export interface BookedVisit {
  slotIso: string;
  label: string;
  durationMinutes: 30;
}

const formatSlotLabel = (date: Date): string => {
  const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${dayLabel}, ${timeLabel}`;
};

// Next business day, rounded to the nearest half hour, between 10:00 and 19:00.
export const nextVisitSlot = (): BookedVisit => {
  const slot = new Date();
  slot.setDate(slot.getDate() + 1);
  if (slot.getDay() === 0) slot.setDate(slot.getDate() + 1);
  if (slot.getDay() === 6) slot.setDate(slot.getDate() + 2);

  const hour = Math.min(Math.max(slot.getHours(), 10), 18);
  slot.setHours(hour, slot.getMinutes() < 30 ? 30 : 0, 0, 0);
  if (slot.getMinutes() === 0) slot.setHours(slot.getHours() + 1);

  return {
    slotIso: slot.toISOString(),
    label: formatSlotLabel(slot),
    durationMinutes: 30,
  };
};
