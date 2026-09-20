import type { FeedbackEvent } from "@chezy/contract";
import { describe, expect, it } from "vitest";
import type { Listing, SearchProfile } from "~/lib/db/schema";
import { feedbackBoost, describeFeedback } from "~/lib/feedback-ranking";
import { buildFeed } from "~/lib/feed";
import { rankListings, scoreListing } from "~/lib/match";
import { getProfileVersion } from "~/lib/profile-version";
import type { CandidateFilter } from "~/lib/listings";

const profile: SearchProfile = {
  id: "profile",
  userId: "user",
  workAddress: "Barcelona",
  workLat: null,
  workLon: null,
  maxCommuteMin: 25,
  neighbourhoods: ["Gràcia"],
  minPriceEur: 800,
  maxPriceEur: 1500,
  minRooms: 2,
  minM2: 60,
  moveDate: null,
  flexibleDays: 0,
  mustHaves: [],
  redLines: ["no_interior"],
  alertsEnabled: false,
  verified: false,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};
const home = (id: string, extras: Partial<Listing> = {}): Listing => ({
  id,
  platform: "fotocasa",
  platformId: id,
  url: `https://example.com/${id}`,
  operation: "rent",
  priceEur: 1200,
  pricePeriod: "month",
  propertyType: "flat",
  builtM2: 70,
  rooms: 2,
  bathrooms: 1,
  floor: null,
  lat: null,
  lon: null,
  street: id,
  neighbourhood: "Gràcia",
  district: "Gràcia",
  municipality: "Barcelona",
  postalCode: null,
  amenities: ["exterior"],
  outdoorSpace: null,
  title: id,
  description: null,
  publisherName: null,
  publisherKind: null,
  coverUrl: null,
  media: [],
  publishedAt: null,
  createdAt: new Date(0),
  ...extras,
});
const event: FeedbackEvent = {
  schemaVersion: 1,
  type: "listing.rejected",
  eventId: "550e8400-e29b-41d4-a716-446655440000",
  userId: "550e8400-e29b-41d4-a716-446655440001",
  listingId: "reject",
  reason: "missing_balcony",
  profileVersion: getProfileVersion(profile),
  createdAt: new Date(0).toISOString(),
  undoneAt: null,
  facts: { priceEur: 1500, neighbourhood: "Gràcia", amenities: ["exterior"] },
};
const rows = [
  home("reject", { priceEur: 1000 }),
  home("ordinary", { priceEur: 1100 }),
  home("balcony", { priceEur: 1300, amenities: ["exterior", "balcony"] }),
  home("interior", { priceEur: 900, amenities: ["balcony"] }),
];

describe("feedback ranking", () => {
  it("hides rejection, promotes supported balcony and keeps red lines and scores", () => {
    expect(rankListings(profile, rows).map(({ listing }) => listing.id)).toEqual([
      "reject",
      "ordinary",
      "balcony",
    ]);
    const ranked = rankListings(profile, rows, [event]);
    expect(ranked.map(({ listing }) => listing.id)).toEqual(["balcony", "ordinary"]);
    expect(ranked[0].match).toEqual(scoreListing(profile, rows[2]));
    expect(profile.maxPriceEur).toBe(1500);
  });
  it("undo restores the exact original order; duplicates never amplify learning", () => {
    expect(
      rankListings(profile, rows, [{ ...event, undoneAt: new Date(1).toISOString() }]),
    ).toEqual(rankListings(profile, rows));
    expect(rankListings(profile, rows, [event, event])).toEqual(
      rankListings(profile, rows, [event]),
    );
    expect(rankListings(profile, [...rows].reverse(), [event])).toEqual(
      rankListings(profile, rows, [event]),
    );
  });
  it("other hides the listing without reranking the rest", () => {
    const hidden: FeedbackEvent = { ...event, reason: "other" };
    const ranked = rankListings(profile, rows, [hidden]);
    expect(ranked.map(({ listing }) => listing.id)).toEqual(["ordinary", "balcony"]);
    expect(ranked.map(({ listing }) => feedbackBoost(listing, [hidden]))).toEqual([0, 0]);
    expect(describeFeedback(hidden)).toBe("Candidate hidden. No ranking change.");
  });
  it("prices remain bounded and unknown prices are not rewarded", () => {
    const priceEvent = { ...event, reason: "too_expensive" } as const;
    expect(feedbackBoost(home("cheap", { priceEur: 750 }), [priceEvent])).toBe(12.5);
    expect(feedbackBoost(home("unknown", { priceEur: null }), [priceEvent])).toBe(0);
    for (const priceEur of [0, 500, 1500, 2000, 99999]) {
      const boost = feedbackBoost(home("x", { priceEur }), [priceEvent]);
      expect(boost).toBeGreaterThanOrEqual(0);
      expect(boost).toBeLessThanOrEqual(25);
    }
  });
  it("uses normalized known neighborhoods without inferring unknown areas", () => {
    const areaEvent = { ...event, reason: "wrong_area" } as const;
    expect(feedbackBoost(home("same", { neighbourhood: "gracia" }), [areaEvent])).toBe(-25);
    expect(feedbackBoost(home("other", { neighbourhood: "Sants" }), [areaEvent])).toBe(0);
    expect(feedbackBoost(home("unknown", { neighbourhood: null }), [areaEvent])).toBe(0);
    expect(
      describeFeedback({ ...areaEvent, facts: { ...event.facts, neighbourhood: null } }),
    ).toContain("unknown");
  });
  it("does not change the candidate query or silently relax the budget after rejection", async () => {
    const calls: CandidateFilter[] = [];
    const run = async (filter: CandidateFilter) => {
      calls.push({ ...filter });
      return rows;
    };
    const before = await buildFeed(profile, run, 3);
    const after = await buildFeed(profile, run, 3, [event]);
    expect(calls[0]).toEqual(calls[1]);
    expect(after.relaxed).toEqual(before.relaxed);
    expect(after.items.map(({ listing }) => listing.id)).toEqual(["balcony", "ordinary"]);
  });
  it("profile versions survive reload/key order and detect same-timestamp preference changes", () => {
    expect(getProfileVersion({ ...profile })).toBe(getProfileVersion(profile));
    expect(getProfileVersion({ ...profile, maxPriceEur: 1600 })).not.toBe(
      getProfileVersion(profile),
    );
    expect(getProfileVersion({ ...profile, id: "reset-profile" })).not.toBe(
      getProfileVersion(profile),
    );
  });
});
