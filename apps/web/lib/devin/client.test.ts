import { beforeEach, describe, expect, it, vi } from "vitest";
import * as v from "valibot";
import { ComparisonPanelSpecSchema, type FeedbackEvent } from "@chezy/contract";
import { createDevinClient, createMockDevinClient, DevinClientError } from "~/lib/devin/client";

const config = { apiKey: "apk_user_testkey", baseUrl: "https://api.devin.ai" };
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const input = {
  title: "t",
  prompt: "p",
  schema: { type: "object" },
  tags: ["chezy", "jes-13", "missing_balcony"],
};

const fetchMock = () => vi.fn<typeof fetch>();

describe("createDevinClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("POSTs /v1/sessions with bearer auth and the bounded body", async () => {
    const fetchImpl = fetchMock().mockResolvedValue(
      ok({ session_id: "abc123", url: "https://app.devin.ai/sessions/abc123" }),
    );
    const client = createDevinClient(config, fetchImpl);
    const snapshot = await client.createSession(input);
    expect(snapshot).toEqual({
      sessionId: "abc123",
      url: "https://app.devin.ai/sessions/abc123",
      phase: "working",
    });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.devin.ai/v1/sessions");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>).authorization).toBe("Bearer apk_user_testkey");
    const body = JSON.parse(init?.body as string);
    expect(body.prompt).toBe("p");
    expect(body.structured_output_schema).toEqual({ type: "object" });
    expect(body.max_acu_limit).toBe(1);
    expect(body.title).toBe("t");
    expect(body.unlisted).toBe(false);
    expect(body.tags).toEqual(["chezy", "jes-13", "missing_balcony"]);
    expect(body.idempotent).toBeUndefined();
  });

  it.each(["abc123", "devin-abc123"])(
    "GETs the prefixed session path for id %s",
    async (sessionId) => {
      const fetchImpl = fetchMock().mockResolvedValue(
        ok({ session_id: sessionId, status_enum: "working", structured_output: null }),
      );
      const client = createDevinClient(config, fetchImpl);
      await client.getSession(sessionId);
      expect(fetchImpl.mock.calls[0][0]).toBe("https://api.devin.ai/v1/sessions/devin-abc123");
      expect(fetchImpl.mock.calls[0][1]?.method).toBe("GET");
    },
  );

  it.each([
    ["finished", "finished", { a: 1 }],
    ["blocked", "blocked", undefined],
    ["expired", "ended", undefined],
    ["working", "working", undefined],
    ["resumed", "working", undefined],
    [null, "working", undefined],
  ])("maps status_enum %s to phase %s", async (statusEnum, phase, output) => {
    const fetchImpl = fetchMock().mockResolvedValue(
      ok({ session_id: "abc", status_enum: statusEnum, structured_output: output ?? null }),
    );
    const client = createDevinClient(config, fetchImpl);
    const snapshot = await client.getSession("abc");
    expect(snapshot.phase).toBe(phase);
    expect(snapshot.structuredOutput).toEqual(output);
    expect(snapshot.url).toBe("https://app.devin.ai/sessions/abc");
  });

  it("POSTs the singular message path", async () => {
    const fetchImpl = fetchMock().mockResolvedValue(ok({}));
    const client = createDevinClient(config, fetchImpl);
    await client.sendMessage("abc", "retry please");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.devin.ai/v1/sessions/devin-abc/message");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ message: "retry please" });
  });

  it("maps non-2xx to DevinClientError without leaking the key", async () => {
    const fetchImpl = fetchMock().mockResolvedValue(
      new Response("unauthorized apk_user_testkey", { status: 401 }),
    );
    const client = createDevinClient(config, fetchImpl);
    const error = await client.getSession("abc").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DevinClientError);
    expect((error as DevinClientError).status).toBe(401);
    expect((error as Error).message).toBe("Devin API responded 401");
    expect((error as Error).message).not.toContain("apk_user_testkey");
  });

  it("maps a fetch failure (timeout) to DevinClientError", async () => {
    const fetchImpl = fetchMock().mockRejectedValue(new Error("TimeoutError"));
    const client = createDevinClient(config, fetchImpl);
    const error = await client.getSession("abc").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DevinClientError);
    expect((error as DevinClientError).code).toBe("network");
    expect((error as Error).message).not.toContain("apk_user_testkey");
  });

  it.each<[number, string, DevinClientError["code"], string | undefined]>([
    [
      403,
      '{"detail":"Your organization has a billing error. Error: out_of_quota"}',
      "out_of_quota",
      "Your organization has a billing error. Error: out_of_quota",
    ],
    [403, '{"detail":"Unauthorized"}', "unauthorized", "Unauthorized"],
    [401, "nope", "unauthorized", "nope"],
    [500, '{"detail":"boom"}', "http", "boom"],
    [422, "", "http", undefined],
  ])("classifies status %s with body %s as %s", async (status, body, code, detail) => {
    const fetchImpl = fetchMock().mockResolvedValue(new Response(body, { status }));
    const client = createDevinClient(config, fetchImpl);
    const error = (await client.createSession(input).catch((e: unknown) => e)) as DevinClientError;
    expect(error.code).toBe(code);
    expect(error.status).toBe(status);
    expect(error.detail).toBe(detail);
  });
});

const candidates = [
  {
    id: "a",
    title: "A",
    priceEur: 900,
    neighbourhood: "Gracia",
    rooms: 2,
    builtM2: 60,
    amenities: [],
    outdoorSpace: null,
  },
  {
    id: "b",
    title: "B",
    priceEur: 1100,
    neighbourhood: "Eixample",
    rooms: 3,
    builtM2: 80,
    amenities: ["balcony"],
    outdoorSpace: null,
  },
  {
    id: "c",
    title: "C",
    priceEur: 950,
    neighbourhood: "Sants",
    rooms: 2,
    builtM2: 70,
    amenities: ["terrace"],
    outdoorSpace: null,
  },
];

const event = {
  eventId: "550e8400-e29b-41d4-a716-446655440000",
  profileVersion: `sha256:${"a".repeat(64)}`,
  reason: "missing_balcony",
} as FeedbackEvent;

describe("createMockDevinClient", () => {
  it("is working on the first poll, finished with a valid spec on the second", async () => {
    const client = createMockDevinClient({ candidates, event, focus: "missing_balcony" });
    const created = await client.createSession(input);
    expect(created.phase).toBe("working");
    // The mock never impersonates a Devin session URL.
    expect(created.url).toBeUndefined();
    const first = await client.getSession(created.sessionId);
    expect(first.phase).toBe("working");
    expect(first.url).toBeUndefined();
    expect(first.structuredOutput).toBeUndefined();
    const second = await client.getSession(created.sessionId);
    expect(second.phase).toBe("finished");
    const parsed = v.safeParse(ComparisonPanelSpecSchema, second.structuredOutput);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      // Outdoor listings come first for missing_balcony.
      expect(parsed.output.listingIds.slice(0, 2).sort()).toEqual(["b", "c"]);
      expect(parsed.output.rows.map((r) => r.field)).toEqual(["balcony", "price", "area"]);
      expect(parsed.output.actions).toEqual(["open_listing", "edit_preferences"]);
      expect(parsed.output.feedbackEventId).toBe(event.eventId);
    }
  });

  it("keeps session state across client instances", async () => {
    const first = createMockDevinClient({ candidates, event, focus: "missing_balcony" });
    const created = await first.createSession(input);
    await first.getSession(created.sessionId);
    const second = createMockDevinClient({ candidates: [], event, focus: "missing_balcony" });
    const snapshot = await second.getSession(created.sessionId);
    expect(snapshot.phase).toBe("finished");
  });
});
