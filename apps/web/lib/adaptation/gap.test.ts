import { describe, expect, it } from "vitest";
import type { CandidateFacts } from "~/lib/adaptation/types";
import { detectCapabilityGap } from "~/lib/adaptation/gap";

const candidate = (overrides: Partial<CandidateFacts> = {}): CandidateFacts => ({
  id: crypto.randomUUID(),
  title: "Flat",
  priceEur: 1000,
  neighbourhood: "Gracia",
  rooms: 2,
  builtM2: 60,
  amenities: [],
  outdoorSpace: null,
  ...overrides,
});

describe("detectCapabilityGap", () => {
  it("finds a 0/5 gap", () => {
    expect(detectCapabilityGap("missing_balcony", Array.from({ length: 5 }, candidate))).toEqual({
      capability: "listing.outdoorSpace.population",
      coverage: 0,
      covered: 0,
      total: 5,
    });
  });
  it("finds a 1/6 gap", () => {
    const candidates = Array.from({ length: 6 }, candidate);
    candidates[0] = candidate({ amenities: ["Balcony"] });
    expect(detectCapabilityGap("missing_balcony", candidates)?.coverage).toBe(1 / 6);
  });
  it.each([
    ["1/5", 1],
    ["3/5", 3],
  ])("does not report %s", (_label, covered) => {
    const candidates = Array.from({ length: 5 }, (_, index) =>
      candidate(index < covered ? { outdoorSpace: "none" } : undefined),
    );
    expect(detectCapabilityGap("missing_balcony", candidates)).toBeUndefined();
  });
  it("counts amenities and none as evidence", () => {
    expect(
      detectCapabilityGap("missing_balcony", [
        candidate({ amenities: ["Balcony"] }),
        candidate({ outdoorSpace: "none" }),
        candidate({ outdoorSpace: null }),
        candidate({ outdoorSpace: null }),
        candidate({ outdoorSpace: null }),
      ]),
    ).toBeUndefined();
  });
  it("ignores empty and unsupported focuses", () => {
    expect(detectCapabilityGap("missing_balcony", [])).toBeUndefined();
    expect(detectCapabilityGap("too_expensive", [candidate(), candidate()])).toBeUndefined();
  });
});
