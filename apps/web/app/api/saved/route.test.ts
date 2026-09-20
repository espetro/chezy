import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), set: vi.fn(), list: vi.fn() }));
vi.mock("~/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("~/lib/saved", () => ({
  setSaved: mocks.set,
  listSavedListingIds: mocks.list,
  SavedError: class extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
}));
const input = { listingId: "fotocasa:123", saved: true };
const request = (body: unknown, headers = {}) =>
  new Request("http://localhost/api/saved", {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("/api/saved ownership", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "authenticated-guest" } });
    mocks.set.mockResolvedValue(true);
    mocks.list.mockResolvedValue(["fotocasa:123"]);
  });
  it.each([GET, PUT])("rejects missing authentication", async (handler) => {
    mocks.auth.mockResolvedValue(undefined);
    expect((await handler(request(input))).status).toBe(401);
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it("uses session ownership for reads and writes", async () => {
    const response = await PUT(request(input));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ listingId: "fotocasa:123", saved: true });
    expect(mocks.set).toHaveBeenCalledExactlyOnceWith("authenticated-guest", "fotocasa:123", true);
    const list = await GET();
    expect(list.headers.get("cache-control")).toBe("private, no-store");
    expect(await list.json()).toEqual({ listingIds: ["fotocasa:123"] });
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith("authenticated-guest");
  });
  it.each([{ listingId: "" }, { saved: "yes" }, { userId: "other" }])(
    "rejects malformed bodies %j",
    async (override) => {
      expect((await PUT(request({ ...input, ...override }))).status).toBe(400);
      expect(mocks.set).not.toHaveBeenCalled();
    },
  );
  it("rejects cross-origin and simple form submissions", async () => {
    expect((await PUT(request(input, { origin: "http://other.test" }))).status).toBe(403);
    expect((await PUT(request(input, { "content-type": "text/plain" }))).status).toBe(415);
  });
  it("does not expose database errors", async () => {
    mocks.set.mockRejectedValue(new Error("private db details"));
    const response = await PUT(request(input));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private db details");
  });
});
