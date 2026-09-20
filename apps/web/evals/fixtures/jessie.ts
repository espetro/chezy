// Golden fixtures for the demo persona (PRD.md "Jessie") and eight hand-written
// listings that exercise every scorer dimension. Expected bands are derived from
// the weights in lib/match.ts (budget 30, barrio 25/15, must-haves 25, rooms 10,
// m2 10) and are the product's expectation for the demo, not a snapshot of the
// code. If a change in lib/match.ts breaks a band, decide whether the product
// expectation or the weights are wrong before editing either.
import type { UserProfile } from "@chezy/contract";

import type { Listing } from "~/lib/db/schema";

// Measured 2026-09-20 against the seeded 150-row rent set: the cheapest 2-bed
// with elevator + balcony/terrace + exterior in Eixample is 2,400 EUR, in
// Poblenou 2,300. A 1,800 budget yields 0 candidates after the red line, so the
// demo brief is 2,400 with Eixample + Poblenou. Change here, and the demo
// script in .agents/docs/demo-flow.md, together.
export const jessie: UserProfile = {
  areas: ["Eixample", "Poblenou"],
  budgetMaxEur: 2400,
  bedroomsMin: 2,
  mustHaves: ["elevator", "balcony_or_terrace"],
  redLines: ["no_interior"],
  workLocation: "Diagonal 405",
  onboardedAt: "2026-09-20T09:00:00.000Z",
};

// The exact line the onboarding form (or the eval replaying it) sends in beat 1.
export const jessieOnboardingLine = `Onboarding form submitted: areas=${jessie.areas?.join(",")}; budgetMaxEur=${jessie.budgetMaxEur}; bedroomsMin=${jessie.bedroomsMin}; mustHaves=${jessie.mustHaves?.join(",")}; redLines=${jessie.redLines?.join(",")}; workLocation=${jessie.workLocation}`;

const base: Listing = {
  id: "",
  platform: "eval",
  platformId: "",
  url: "https://example.invalid/",
  operation: "rent",
  priceEur: 0,
  pricePeriod: "month",
  propertyType: "flat",
  builtM2: 0,
  rooms: 0,
  bathrooms: 1,
  floor: "2",
  lat: null,
  lon: null,
  street: "Carrer Eval",
  neighbourhood: null,
  district: null,
  municipality: "Barcelona",
  postalCode: "08000",
  amenities: [],
  title: "",
  description: null,
  publisherName: "Eval Agency",
  publisherKind: "agency",
  coverUrl: null,
  media: [],
  publishedAt: null,
  createdAt: new Date(0),
};

function listing(id: string, over: Partial<Listing>): Listing {
  return { ...base, id: `eval:${id}`, platformId: id, title: id, ...over };
}

export const listings = {
  // Everything Jessie asked for. The one card that must clear the 95 bar.
  graciaPerfect: listing("gracia-perfect", {
    neighbourhood: "Vila de Gràcia",
    district: "Gràcia",
    priceEur: 1650,
    rooms: 2,
    builtM2: 72,
    amenities: ["elevator", "balcony", "exterior"],
  }),
  // Right area, right price, missing one of two must-haves.
  eixampleNoBalcony: listing("eixample-no-balcony", {
    neighbourhood: "Dreta de l'Eixample",
    district: "Eixample",
    priceEur: 1750,
    rooms: 3,
    builtM2: 85,
    amenities: ["elevator", "exterior"],
  }),
  // Wrong area and ~6% over budget; otherwise fine.
  santsOverBudget: listing("sants-over-budget", {
    neighbourhood: "Sants",
    district: "Sants-Montjuïc",
    priceEur: 1900,
    rooms: 2,
    builtM2: 65,
    amenities: ["elevator", "balcony", "exterior"],
  }),
  // Cheap studio, wrong area, interior. Must be filtered by the red line.
  ravalInteriorStudio: listing("raval-interior-studio", {
    neighbourhood: "El Raval",
    district: "Ciutat Vella",
    priceEur: 1200,
    rooms: 1,
    builtM2: 40,
    amenities: [],
  }),
  // Otherwise strong Gràcia flat with no `exterior` amenity: red line must win.
  graciaInterior: listing("gracia-interior", {
    neighbourhood: "Vila de Gràcia",
    district: "Gràcia",
    priceEur: 1500,
    rooms: 2,
    builtM2: 60,
    amenities: ["elevator", "balcony"],
  }),
  // Neighbourhood not in the list but the district is: partial barrio credit.
  eixampleDistrictOnly: listing("eixample-district-only", {
    neighbourhood: "Sant Antoni",
    district: "Eixample",
    priceEur: 1700,
    rooms: 2,
    builtM2: 70,
    amenities: ["elevator", "balcony", "exterior"],
  }),
  // Dream flat at 44% over budget: budget tiering must sink it.
  graciaWayOver: listing("gracia-way-over", {
    neighbourhood: "Vila de Gràcia",
    district: "Gràcia",
    priceEur: 2600,
    rooms: 3,
    builtM2: 100,
    amenities: ["elevator", "balcony", "exterior"],
  }),
  // Perfect except it is a 1-bed for a 2-bed brief.
  graciaOneRoom: listing("gracia-one-room", {
    neighbourhood: "Vila de Gràcia",
    district: "Gràcia",
    priceEur: 1400,
    rooms: 1,
    builtM2: 45,
    amenities: ["elevator", "balcony", "exterior"],
  }),
} as const;

export const allListings: Listing[] = Object.values(listings);

export type Band = "top" | "strong" | "weak" | "poor" | "excluded";

// top >= 95 (proposes a visit), strong 80-94, weak 60-79, poor < 60,
// excluded = removed by a red line before scoring.
export const expectedBands: Record<keyof typeof listings, Band> = {
  graciaPerfect: "top",
  eixampleNoBalcony: "strong",
  santsOverBudget: "weak",
  ravalInteriorStudio: "excluded",
  graciaInterior: "excluded",
  eixampleDistrictOnly: "strong",
  graciaWayOver: "weak",
  graciaOneRoom: "strong",
};
