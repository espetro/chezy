import { describe, expect, it } from "vitest";

import { getDistrictProfile } from "./neighbourhoods";

describe("getDistrictProfile", () => {
  it("returns the profile for a known district", () => {
    const profile = getDistrictProfile("Gràcia");
    expect(profile).toBeDefined();
    expect(profile?.pois.length).toBe(3);
  });

  it("returns undefined for unknown districts and null", () => {
    expect(getDistrictProfile("Horta-Guinardó")).toBeUndefined();
    expect(getDistrictProfile(null)).toBeUndefined();
  });
});
