import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/lib/env", () => ({
  env: {
    OPENAI_COMPATIBLE_BASE_URL: "https://llm.test/v1",
    OPENAI_COMPATIBLE_API_KEY: "k",
    VISION_MODEL_ID: "moonshotai/Kimi-K3",
  },
}));

import { extractListingInsights } from "~/lib/vision/extract";

const FIXTURE = {
  per_image: [
    { i: 0, room_type: "pool" },
    { i: 1, room_type: "terrace" },
    { i: 2, room_type: "garden" },
    { i: 3, room_type: "living_room" },
    { i: 4, room_type: "kitchen" },
  ],
  condition: { score_1to5: 5, needs_renovation: false },
  flooring: {
    dominant: "parquet",
    all: ["parquet", "stone", "ceramic"],
    evidence: [3, 4, 5],
  },
  ceiling: { features: ["high_ceilings"], evidence: [3] },
  windows: {
    frame: "aluminum",
    size: "floor_to_ceiling",
    shutters: true,
    evidence: [1, 3],
  },
  light: { natural: "high", facing: "exterior" },
  outdoor: {
    spaces: ["terrace", "pool", "garden"],
    views: ["city", "mountain", "street"],
  },
  kitchen: {
    layout: "open",
    island: true,
    appliances: ["oven", "induction_hob", "sink", "refrigerator"],
    updated: true,
  },
  furnished: "none",
  climate: { ac_visible: true, radiators_visible: false, fireplace: true },
  style: "modern",
  trust: {
    virtual_staging: false,
    renders: false,
    red_flags: ["watermark_present"],
  },
  highlights_es: [
    "Terraza y piscina privadas",
    "Cocina abierta con isla",
    "Ventanales de suelo a techo",
  ],
  summary_es: "Piso moderno y luminoso con terraza, piscina y jardín.",
};

const PHOTOS = [
  { url: "https://cdn.test/0.webp", localPath: undefined },
  { url: "https://cdn.test/1.webp", localPath: undefined },
];

function okResponse(body: unknown, usage = { prompt_tokens: 10, completion_tokens: 5 }) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: typeof body === "string" ? body : JSON.stringify(body) } }],
      usage,
    }),
    text: async () => JSON.stringify(body),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractListingInsights", () => {
  it("parses fenced JSON and validates it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse(`\`\`\`json\n${JSON.stringify(FIXTURE)}\n\`\`\``));
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractListingInsights({
      listingId: "l1",
      photos: PHOTOS,
    });
    expect(result.insights.flooring.dominant).toBe("parquet");
    expect(result.insights.trust.red_flags).toEqual(["watermark_present"]);
    expect(result.usage.promptTokens).toBe(10);
  });

  it("falls back on unknown enum values instead of throwing", async () => {
    const mutated = structuredClone(FIXTURE);
    mutated.per_image[0].room_type = "sauna" as never;
    mutated.style = "brutalist" as never;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(mutated)));

    const result = await extractListingInsights({ listingId: "l1", photos: PHOTOS });
    expect(result.insights.per_image[0].room_type).toBe("other");
    expect(result.insights.style).toBe("mixed");
  });

  it("retries once on invalid JSON then throws", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse("not json at all"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(extractListingInsights({ listingId: "l1", photos: PHOTOS })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends thinking:false and one image part per photo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(FIXTURE));
    vi.stubGlobal("fetch", fetchMock);

    await extractListingInsights({ listingId: "l1", photos: PHOTOS });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.chat_template_kwargs).toEqual({ thinking: false });
    expect(
      body.messages[0].content.filter((p: { type: string }) => p.type === "image_url"),
    ).toHaveLength(PHOTOS.length);
  });
});
