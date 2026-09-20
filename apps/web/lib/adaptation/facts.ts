import type { CandidateFacts } from "~/lib/adaptation/types";

// Balcony is asserted by the amenities text or by a balcony/terrace seen in
// the photos; absence (and a photo label of "none") is unknown, never
// "no balcony".
export const hasOutdoorSpace = (candidate: CandidateFacts): boolean =>
  candidate.amenities.some((amenity) => /balcony|terrace/i.test(amenity)) ||
  candidate.outdoorSpace === "balcony" ||
  candidate.outdoorSpace === "terrace";
