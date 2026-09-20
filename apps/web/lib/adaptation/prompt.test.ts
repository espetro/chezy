import { describe, expect, it } from "vitest";
import type { FeedbackEvent } from "@chezy/contract";
import { buildAdaptationPrompt, sanitizeCandidate } from "~/lib/adaptation/prompt";
import type { CandidateFacts } from "~/lib/adaptation/types";
import type { Listing } from "~/lib/db/schema";

const event = {
  eventId: "550e8400-e29b-41d4-a716-446655440000",
  profileVersion: `sha256:${"a".repeat(64)}`,
  reason: "missing_balcony",
} as FeedbackEvent;

const candidates: CandidateFacts[] = [
  {
    id: "fotocasa:1",
    title: "Flat in Gracia",
    priceEur: 1200,
    neighbourhood: "Gracia",
    rooms: 2,
    builtM2: 70,
    amenities: ["balcony"],
  },
  {
    id: "fotocasa:2",
    title: "Loft in Sants",
    priceEur: 950,
    neighbourhood: "Sants",
    rooms: 1,
    builtM2: 55,
    amenities: [],
  },
];

const rejected: CandidateFacts = {
  id: "fotocasa:0",
  title: "Rejected flat",
  priceEur: 1400,
  neighbourhood: "Eixample",
  rooms: 2,
  builtM2: 65,
  amenities: [],
};

describe("sanitizeCandidate", () => {
  it("keeps only the sanitized fact set", () => {
    const row = {
      id: "fotocasa:9",
      title: "Some flat",
      priceEur: 800,
      neighbourhood: "Poble-sec",
      rooms: 3,
      builtM2: 90,
      amenities: ["terrace"],
      url: "https://SECRET-URL.example",
      publisherName: "SECRET-PUBLISHER",
      description: "SECRET-DESCRIPTION",
    } as unknown as Listing;
    expect(sanitizeCandidate(row)).toEqual({
      id: "fotocasa:9",
      title: "Some flat",
      priceEur: 800,
      neighbourhood: "Poble-sec",
      rooms: 3,
      builtM2: 90,
      amenities: ["terrace"],
    });
  });
});

describe("buildAdaptationPrompt", () => {
  const prompt = buildAdaptationPrompt({
    event,
    rejected,
    candidates,
    schema: { type: "object" },
    attempt: 1,
  });
  it("contains every candidate id, the event id and the profile version", () => {
    for (const candidate of candidates) expect(prompt).toContain(candidate.id);
    expect(prompt).toContain(event.eventId);
    expect(prompt).toContain(event.profileVersion);
    expect(prompt).toContain(event.reason);
    expect(prompt).toContain("balcony");
  });
  it("states the exact attempt number to echo", () => {
    expect(prompt).toContain("attempt: 1");
  });
  it("never carries fields outside the sanitized set", () => {
    const dirtyRow = {
      id: "fotocasa:0",
      title: "Rejected flat",
      priceEur: 1400,
      neighbourhood: "Eixample",
      rooms: 2,
      builtM2: 65,
      amenities: [],
      url: "SECRET-URL",
      publisherName: "SECRET-PUBLISHER",
      description: "SECRET-DESCRIPTION",
    } as unknown as Listing;
    const clean = buildAdaptationPrompt({
      event,
      rejected: sanitizeCandidate(dirtyRow),
      candidates,
      schema: { type: "object" },
      attempt: 1,
    });
    for (const secret of ["SECRET-URL", "SECRET-PUBLISHER", "SECRET-DESCRIPTION"]) {
      expect(clean).not.toContain(secret);
    }
  });
});
