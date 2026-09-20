import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ExplanationSource } from "~/lib/ai/explanation-contract";
import type { FlowListing } from "~/lib/flow/types";
import { MatchDetail } from "./MatchDetail";

const listing: FlowListing = {
  id: "fixture:1",
  title: "Home in Gràcia",
  neighborhood: "Gràcia",
  city: "Barcelona",
  price: 1400,
  sizeM2: 70,
  rooms: 2,
  imageUrl: "",
  agency: "Test agency",
  tags: [],
  depositMonths: 1,
  sharedFlat: false,
  matchScore: 82,
  matchReasons: [],
  neighborhoodProfile: {
    shops: 60,
    nightlife: 50,
    safety: 70,
    noise: 45,
    transitMinutesToWork: 25,
  },
  availableFrom: "Now",
};

const source: ExplanationSource = {
  id: "fixture:1",
  priceEur: 1400,
  pricePeriod: "month",
  rooms: 2,
  builtM2: 70,
  amenities: [],
};

describe("production match detail composition", () => {
  it("mounts grounded pending reasons, a budget trade-off and truthful viewing options", () => {
    const html = renderToStaticMarkup(
      createElement(MatchDetail, {
        listing,
        explanation: {
          listing: source,
          matchScore: 82,
          preferences: { maxPriceEur: 1200, minRooms: 2, minM2: 60 },
          profileKey: "user:profile-revision",
        },
      }),
    );
    expect(html).toContain("Why this home");
    expect(html).toContain("What to check");
    expect(html).toContain("AI explanation pending");
    expect(html).toContain("Above your maximum budget");
    expect(html).toContain("price_eur");
    expect(html).toContain('href="#agency-actions"');
    expect(html).toContain('id="agency-actions"');
    expect(html).toContain("Ready to call the agency for you.");
    expect(html).not.toContain(">Demo<");
    expect(html).toContain("Call the agency");
    expect(html).not.toContain("Simulat");
    expect(html).not.toContain("available Now");
    expect(html.match(/Match score:/g)).toHaveLength(1);
  });

  it("keeps absent source facts unknown instead of presenting zeroes as facts", () => {
    const html = renderToStaticMarkup(
      createElement(MatchDetail, {
        listing: { ...listing, price: 0, rooms: 0, sizeM2: 0 },
        explanation: {
          listing: { ...source, priceEur: null, rooms: null, builtM2: null },
          matchScore: 0,
          profileKey: "user:no-profile",
        },
      }),
    );
    expect(html).toContain("Price unknown");
    expect(html).toContain("Area unknown");
    expect(html).toContain("Bedrooms unknown");
    expect(html).toContain("Natural light: unknown");
    expect(html).not.toContain("€0");
  });
});
