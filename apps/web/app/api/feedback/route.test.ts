import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "./route";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), record: vi.fn(), undo: vi.fn(), list: vi.fn() }));
vi.mock("~/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("~/lib/feedback", () => ({
  recordFeedback: mocks.record,
  undoFeedback: mocks.undo,
  listActiveFeedback: mocks.list,
  FeedbackError: class extends Error {},
}));
const input = {
  eventId: "550e8400-e29b-41d4-a716-446655440000",
  listingId: "fotocasa:123",
  reason: "missing_balcony",
};
const request = (body: unknown, headers = {}) =>
  new Request("http://localhost/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("/api/feedback ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "authenticated-guest" } });
    mocks.record.mockResolvedValue(input);
    mocks.undo.mockResolvedValue(input);
    mocks.list.mockResolvedValue([]);
  });
  it.each([GET, POST, DELETE])("rejects missing authentication", async (handler) => {
    mocks.auth.mockResolvedValue(undefined);
    expect((await handler(request(input))).status).toBe(401);
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.undo).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("uses session ownership for writes, reads and Undo", async () => {
    expect((await POST(request(input))).status).toBe(200);
    expect(mocks.record).toHaveBeenCalledExactlyOnceWith("authenticated-guest", input);
    expect((await DELETE(request({ eventId: input.eventId }))).status).toBe(200);
    expect(mocks.undo).toHaveBeenCalledExactlyOnceWith("authenticated-guest", input.eventId);
    const response = await GET();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith("authenticated-guest");
  });
  it.each([{ userId: "other" }, { profileVersion: "spoofed" }, { reason: "other" }])(
    "rejects assertions %j",
    async (override) => {
      expect((await POST(request({ ...input, ...override }))).status).toBe(400);
      expect(mocks.record).not.toHaveBeenCalled();
    },
  );
  it.each([POST, DELETE])("rejects cross-origin and simple form submissions", async (handler) => {
    expect((await handler(request(input, { origin: "http://other.test" }))).status).toBe(403);
    expect((await handler(request(input, { "content-type": "text/plain" }))).status).toBe(415);
  });
  it("does not expose database errors", async () => {
    mocks.record.mockRejectedValue(new Error("private db details"));
    const response = await POST(request(input));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private db details");
  });
});
