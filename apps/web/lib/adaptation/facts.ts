import type { CandidateFacts } from "~/lib/adaptation/types";

// Balcony is only ever asserted by the amenities text; absence is unknown,
// never "no balcony".
export const hasOutdoorSpace = (candidate: CandidateFacts): boolean =>
  candidate.amenities.some((amenity) => /balcony|terrace/i.test(amenity));
