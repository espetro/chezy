import { afterEach, describe, expect, test, vi } from "vitest";

import { getWeather } from "~/lib/ai/tools/get-weather";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const GEOCODE_BARCELONA = {
  results: [{ latitude: 41.3888, longitude: 2.159 }],
};

function run(input: { city: string }) {
  return getWeather.execute!(input, {
    toolCallId: "t",
    messages: [],
  } as never);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getWeather", () => {
  test("returns an error when the forecast API is rate limited (429)", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    mock
      .mockResolvedValueOnce(jsonResponse(GEOCODE_BARCELONA))
      .mockResolvedValueOnce(jsonResponse({ reason: "Too many requests" }, 429));

    const result = (await run({ city: "Barcelona" })) as { error?: string };

    expect(result.error).toBeDefined();
    expect(result.error).toContain("429");
  });

  test("returns weather data on success", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    mock
      .mockResolvedValueOnce(jsonResponse(GEOCODE_BARCELONA))
      .mockResolvedValueOnce(
        jsonResponse({
          current: { temperature_2m: 21.5 },
          hourly: { temperature_2m: [1] },
          daily: {},
        })
      );

    const result = (await run({ city: "Barcelona" })) as {
      hourly?: unknown;
      cityName?: string;
    };

    expect(result.hourly).toBeDefined();
    expect(result.cityName).toBe("Barcelona");
  });

  test("returns an error when the forecast body is missing weather data", async () => {
    const mock = vi.fn();
    vi.stubGlobal("fetch", mock);
    mock
      .mockResolvedValueOnce(jsonResponse(GEOCODE_BARCELONA))
      .mockResolvedValueOnce(jsonResponse({}));

    const result = (await run({ city: "Barcelona" })) as { error?: string };

    expect(result.error).toBeDefined();
  });
});
