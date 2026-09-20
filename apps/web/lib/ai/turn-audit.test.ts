import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";

import {
  extractListingRefs,
  listingIdsFromToolResult,
  summarizeTurn,
  turnFromUIMessages,
} from "./turn-audit";

describe("extractListingRefs", () => {
  it("normalises idealista urls to their listing id", () => {
    const refs = extractListingRefs(
      "Mira este: https://www.idealista.com/inmueble/110246870/ y también idealista:999",
    );
    expect(refs).toEqual(["idealista:110246870", "idealista:999"]);
  });

  it("picks up bare platform:id refs and dedups", () => {
    const refs = extractListingRefs("fotocasa:183343174 vs fotocasa:183343174 y habitaclia:42");
    expect(refs).toEqual(["fotocasa:183343174", "habitaclia:42"]);
  });

  it("returns [] when nothing is cited", () => {
    expect(extractListingRefs("un piso bonito en Gràcia")).toEqual([]);
  });
});

describe("listingIdsFromToolResult", () => {
  it("searchListings -> listings[].id", () => {
    expect(
      listingIdsFromToolResult("searchListings", {
        listings: [{ id: "idealista:1" }, { id: "fotocasa:2" }, { noId: true }],
      }),
    ).toEqual(["idealista:1", "fotocasa:2"]);
  });

  it("getListing -> id", () => {
    expect(listingIdsFromToolResult("getListing", { id: "idealista:7" })).toEqual(["idealista:7"]);
  });

  it("arrangeViewing -> listing.id", () => {
    expect(
      listingIdsFromToolResult("arrangeViewing", {
        listing: { id: "idealista:3" },
        viewingId: "v1",
      }),
    ).toEqual(["idealista:3"]);
  });

  it("arrangeViewing -> input propertyRef / listingId", () => {
    expect(listingIdsFromToolResult("arrangeViewing", { propertyRef: "lst-9" })).toEqual(["lst-9"]);
    expect(listingIdsFromToolResult("arrangeViewing", { listingId: "idealista:4" })).toEqual([
      "idealista:4",
    ]);
  });

  it("unknown tool / bad payload -> []", () => {
    expect(listingIdsFromToolResult("saveUserProfile", { userId: "u" })).toEqual([]);
    expect(listingIdsFromToolResult("searchListings", "nope")).toEqual([]);
    expect(listingIdsFromToolResult("searchListings", undefined)).toEqual([]);
  });
});

describe("turnFromUIMessages", () => {
  const msg = (role: string, parts: unknown[]) =>
    ({ id: role + Math.random(), role, parts }) as UIMessage;

  it("collects terminal tool parts and concatenates assistant text", () => {
    const { toolCalls, assistantText } = turnFromUIMessages([
      msg("user", [{ type: "text", text: "find me a flat" }]),
      msg("assistant", [
        {
          type: "tool-searchListings",
          state: "output-available",
          output: { listings: [] },
          input: {},
        },
        { type: "tool-saveUserProfile", state: "output-error", output: { error: "x" } },
        { type: "tool-searchListings", state: "input-streaming" },
        { type: "text", text: "Found" },
        { type: "text", text: "2 flats" },
      ]),
    ]);
    expect(toolCalls).toEqual([
      {
        name: "searchListings",
        ok: true,
        result: { listings: [] },
        input: {},
      },
      { name: "saveUserProfile", ok: false, result: { error: "x" }, input: undefined },
    ]);
    expect(assistantText).toBe("Found\n2 flats");
  });

  it("names dynamic-tool parts via toolName", () => {
    const { toolCalls } = turnFromUIMessages([
      msg("assistant", [
        { type: "dynamic-tool", state: "output-available", toolName: "mcpThing", output: 1 },
      ]),
    ]);
    expect(toolCalls[0].name).toBe("mcpThing");
  });

  it("handles messages with no parts", () => {
    const { toolCalls, assistantText } = turnFromUIMessages([
      { id: "u1", role: "user", parts: [] } as UIMessage,
    ]);
    expect(toolCalls).toEqual([]);
    expect(assistantText).toBe("");
  });
});

describe("summarizeTurn", () => {
  it("produces the TurnAudit shape without message bodies", () => {
    const audit = summarizeTurn({
      channel: "web",
      model: "deepseek-ai/DeepSeek-V4.1-Flash",
      startedAt: Date.now() - 1500,
      toolCalls: [
        {
          name: "searchListings",
          ok: true,
          result: { listings: [{ id: "idealista:1" }] },
        },
        { name: "saveUserProfile", ok: false },
      ],
      assistantText: "Te gusta idealista:1? https://www.idealista.com/inmueble/55/",
    });
    expect(audit.channel).toBe("web");
    expect(audit.model).toContain("DeepSeek");
    expect(audit.latency_ms).toBeGreaterThanOrEqual(1500);
    expect(audit.tools).toEqual([
      { name: "searchListings", ok: true, listingIds: ["idealista:1"] },
      { name: "saveUserProfile", ok: false },
    ]);
    expect(audit.cited_listing_ids).toEqual(["idealista:1", "idealista:55"]);
    expect(JSON.stringify(audit)).not.toContain("budget");
  });
});
