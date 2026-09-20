import type { FeedbackEvent, FeedbackReason } from "@chezy/contract";
import type { Listing } from "~/lib/db/schema";

export const FEEDBACK_EXPLANATIONS: Record<FeedbackReason, string> = {
  missing_balcony:
    "Balcony moved up in your comparison. Only listing-reported outdoor space counts.",
  too_expensive: "Lower known rents moved up in your comparison. Your budget is unchanged.",
  wrong_area: "Homes outside the rejected neighborhood moved up in your comparison.",
  other: "Candidate hidden. No ranking change.",
};

export const describeFeedback = (event: FeedbackEvent) => {
  if (event.reason === "wrong_area" && !event.facts.neighbourhood) {
    return "Candidate hidden. Its neighborhood is unknown, so other areas have not been reranked.";
  }
  if (event.reason === "too_expensive" && !event.facts.priceEur) {
    return "Candidate hidden. Its rent is unknown, so your price comparison is unchanged.";
  }
  return FEEDBACK_EXPLANATIONS[event.reason];
};

const normalizeArea = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export const feedbackBoost = (listing: Listing, events: readonly FeedbackEvent[]): number => {
  const reasons = new Set(events.filter((event) => !event.undoneAt).map((event) => event.reason));
  let boost = 0;
  if (
    reasons.has("missing_balcony") &&
    listing.amenities.some((item) => item === "balcony" || item === "terrace")
  ) {
    boost += 25;
  }
  const prices = events
    .filter((event) => !event.undoneAt && event.reason === "too_expensive")
    .map((event) => event.facts.priceEur)
    .filter((price): price is number => price !== null && price > 0);
  const ceiling = Math.min(...prices);
  if (Number.isFinite(ceiling) && listing.priceEur !== null) {
    boost += 25 * Math.max(0, Math.min(1, 1 - listing.priceEur / ceiling));
  }
  const avoidedAreas = new Set(
    events
      .filter((event) => !event.undoneAt && event.reason === "wrong_area")
      .flatMap((event) =>
        event.facts.neighbourhood ? [normalizeArea(event.facts.neighbourhood)] : [],
      ),
  );
  if (listing.neighbourhood && avoidedAreas.has(normalizeArea(listing.neighbourhood))) boost -= 25;
  return boost;
};
