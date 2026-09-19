import { describe, expect, it } from "vitest";
import * as v from "valibot";
import { ListingSchema } from "./listings";
import fixture from "./listings.fixture.json";

// The fixture is `Listing.model_dump_json()` output from the Python scraper, so this
// test fails when the pydantic model and the Valibot mirror drift apart.
describe("ListingSchema", () => {
  it.each(fixture.map((row, i) => [i, row] as const))("accepts scraper output #%i", (_i, row) => {
    expect(v.safeParse(ListingSchema, row).success).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(v.safeParse(ListingSchema, { ...fixture[0], surprise: 1 }).success).toBe(false);
  });
});
