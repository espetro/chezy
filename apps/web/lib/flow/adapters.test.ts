import { describe, expect, it } from "vitest";

import type { Listing, SearchProfile } from "@/lib/db/schema";
import type { MatchResult } from "@/lib/match";
import type { UserPreferences } from "@/lib/flow/types";
import {
  fromSearchProfile,
  toFlowListing,
  toSearchProfileInput,
} from "./adapters";

const fullPrefs: UserPreferences = {
  workAddress: "Diagonal 405",
  commuteMaxMin: 25,
  zones: ["Gràcia", "Eixample"],
  budgetMin: 1200,
  budgetMax: 2500,
  rooms: 2,
  sizeMin: 50,
  moveIn: { mode: "date", date: "2026-10-01" },
  mustHaves: ["natural-light", "balcony", "pets"],
  dealBreakers: ["no-dark-interior", "no-excessive-deposit"],
  alerts: false,
  autonomy: "autopilot",
};

const minimalPrefs: UserPreferences = {
  workAddress: "Diagonal 405",
  commuteMaxMin: undefined,
  zones: [],
  budgetMin: 800,
  budgetMax: 1200,
  rooms: 1,
  sizeMin: 40,
  moveIn: undefined,
  mustHaves: [],
  dealBreakers: [],
  alerts: true,
  autonomy: "cowork",
};

describe("toSearchProfileInput", () => {
  it("maps a full preferences object", () => {
    expect(toSearchProfileInput(fullPrefs)).toEqual({
      workAddress: "Diagonal 405",
      maxCommuteMin: 25,
      neighbourhoods: ["Gràcia", "Eixample"],
      minPriceEur: 1200,
      maxPriceEur: 2500,
      minRooms: 2,
      minM2: 50,
      moveDate: "2026-10-01",
      flexibleDays: 0,
      mustHaves: ["exterior", "balcony_or_terrace", "pets_allowed"],
      redLines: ["no_interior", "no_high_deposit"],
      alertsEnabled: false,
    });
  });

  it("defaults commute to 25 and flexible move-in to 15 days", () => {
    const input = toSearchProfileInput({
      ...minimalPrefs,
      moveIn: { mode: "flexible" },
    });
    expect(input.maxCommuteMin).toBe(25);
    expect(input.moveDate).toBeNull();
    expect(input.flexibleDays).toBe(15);
  });

  it("maps every must-have and red-line id", () => {
    const input = toSearchProfileInput({
      ...minimalPrefs,
      mustHaves: [
        "natural-light",
        "balcony",
        "elevator",
        "air-conditioning",
        "furnished",
        "pets",
      ],
      dealBreakers: [
        "no-dark-interior",
        "no-excessive-deposit",
        "no-unknown-flatmates",
      ],
    });
    expect(input.mustHaves).toEqual([
      "exterior",
      "balcony_or_terrace",
      "elevator",
      "air_conditioning",
      "furnished",
      "pets_allowed",
    ]);
    expect(input.redLines).toEqual([
      "no_interior",
      "no_high_deposit",
      "no_flatmates",
    ]);
  });

  it("drops unknown ids instead of sending them", () => {
    const input = toSearchProfileInput({
      ...minimalPrefs,
      mustHaves: ["made-up-id"],
      dealBreakers: ["another"],
    });
    expect(input.mustHaves).toEqual([]);
    expect(input.redLines).toEqual([]);
  });
});

const baseProfile: SearchProfile = {
  id: "p1",
  userId: "u1",
  workAddress: "Diagonal 405",
  workLat: null,
  workLon: null,
  maxCommuteMin: 25,
  neighbourhoods: ["Gràcia"],
  minPriceEur: 1200,
  maxPriceEur: 2500,
  minRooms: 2,
  minM2: 50,
  moveDate: "2026-10-01",
  flexibleDays: 0,
  mustHaves: ["exterior", "pets_allowed"],
  redLines: ["no_interior", "no_flatmates"],
  alertsEnabled: true,
  verified: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe("fromSearchProfile", () => {
  it("round-trips a persisted profile", () => {
    const prefs = fromSearchProfile(baseProfile);
    expect(prefs).toMatchObject({
      workAddress: "Diagonal 405",
      commuteMaxMin: 25,
      zones: ["Gràcia"],
      budgetMin: 1200,
      budgetMax: 2500,
      rooms: 2,
      sizeMin: 50,
      moveIn: { mode: "date", date: "2026-10-01" },
      mustHaves: ["natural-light", "pets"],
      dealBreakers: ["no-dark-interior", "no-unknown-flatmates"],
      alerts: true,
      autonomy: "cowork",
    });
  });

  it("maps flexibleDays to flexible move-in", () => {
    const prefs = fromSearchProfile({ ...baseProfile, moveDate: null, flexibleDays: 15 });
    expect(prefs.moveIn).toEqual({ mode: "flexible" });
  });

  it("falls back to 25 for an off-menu commute value", () => {
    expect(fromSearchProfile({ ...baseProfile, maxCommuteMin: 33 }).commuteMaxMin).toBe(25);
  });
});

const makeRow = (over: Partial<Listing> = {}): Listing =>
  ({
    id: "fotocasa:190451552",
    title: "PISO EN ALQUILER EN LA NOVA ESQUERRA DE L'EIXAMPLE",
    operation: "rent",
    priceEur: 2400,
    builtM2: 64,
    rooms: 2,
    street: null,
    neighbourhood: "La Nova Esquerra de l'Eixample",
    district: "Eixample",
    amenities: [],
    publisherName: "Agència Pisos",
    coverUrl: "https://cdn.example.com/cover.jpg",
    ...over,
  }) as Listing;

const match: MatchResult = { score: 82, reasons: ["Dentro de tu presupuesto"], commuteMin: 18 };

describe("toFlowListing", () => {
  it("maps a DB row with real score, reasons and image", () => {
    const flow = toFlowListing(makeRow(), match, baseProfile);
    expect(flow.id).toBe("fotocasa:190451552");
    expect(flow.title).toBe("Piso en alquiler en la nova esquerra de l’eixample");
    expect(flow.neighborhood).toBe("La Nova Esquerra de l'Eixample");
    expect(flow.city).toBe("Barcelona");
    expect(flow.price).toBe(2400);
    expect(flow.sizeM2).toBe(64);
    expect(flow.rooms).toBe(2);
    expect(flow.imageUrl).toBe("https://cdn.example.com/cover.jpg");
    expect(flow.agency).toBe("Agència Pisos");
    expect(flow.matchScore).toBe(82);
    expect(flow.matchReasons).toEqual([
      { label: "Dentro de tu presupuesto", detail: "" },
    ]);
    expect(flow.neighborhoodProfile.transitMinutesToWork).toBe(18);
    expect(flow.availableFrom).toBe("Now");
  });

  it("derives amenity tags with dedupe and a 4-tag cap", () => {
    const flow = toFlowListing(
      makeRow({ amenities: ["furnished", "pets_allowed", "exterior", "elevator", "terrace", "balcony"] }),
      match,
    );
    expect(flow.tags).toEqual(["Furnished", "Pets allowed", "Exterior-facing", "Elevator"]);
  });

  it("uses neutral fallbacks for unknown district and missing fields", () => {
    const flow = toFlowListing(
      makeRow({
        title: null as unknown as string,
        priceEur: null,
        builtM2: null,
        rooms: null,
        neighbourhood: null,
        district: "Narnia",
        publisherName: null,
        coverUrl: null,
      }),
      { score: 0, reasons: [] },
    );
    expect(flow.title).toBe("Apartment in Narnia");
    expect(flow.price).toBe(0);
    expect(flow.imageUrl).toBe("");
    expect(flow.agency).toBe("the agency");
    expect(flow.matchReasons).toEqual([]);
    expect(flow.neighborhoodProfile).toEqual({
      shops: 60,
      nightlife: 50,
      safety: 70,
      noise: 45,
      transitMinutesToWork: 25,
    });
  });

  it("prefers profile commute when the match has none", () => {
    const flow = toFlowListing(makeRow(), { score: 50, reasons: [] }, baseProfile);
    expect(flow.neighborhoodProfile.transitMinutesToWork).toBe(25);
  });
});
