import { describe, expect, it } from "vitest";

import { geocodeWorkAddress } from "./geocode";

describe("geocodeWorkAddress", () => {
  it("hits a named anchor", () => {
    const result = geocodeWorkAddress("Oficina en Plaça Catalunya 1");
    expect(result.label).toBe("Plaça Catalunya");
    expect(result.approximate).toBe(false);
    expect(result.point.lat).toBeCloseTo(41.387, 3);
  });

  it("matches accent-insensitive spellings", () => {
    const result = geocodeWorkAddress("Paseo de Gracia 120, Barcelona");
    expect(result.label).toBe("Diagonal 405 / Passeig de Gràcia");
    expect(result.approximate).toBe(false);
  });

  it("falls back to the default anchor on a miss", () => {
    const result = geocodeWorkAddress("Calle de Alcalá 50, Madrid");
    expect(result.approximate).toBe(true);
    expect(result.point.lat).toBeCloseTo(41.3954, 3);
    expect(result.point.lon).toBeCloseTo(2.1618, 3);
  });
});
