import { CapabilityOutputSchema } from "@chezy/contract";
import * as v from "valibot";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), refresh: vi.fn() }));
vi.mock("~/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("~/lib/capability/jobs", () => ({ refreshCapabilityJob: mocks.refresh }));

const jobId = "660e8400-e29b-41d4-a716-446655440000";
const capability = {
  jobId,
  capability: "listing.outdoorSpace.population",
  status: "running",
  provider: "mock",
  coverage: 0,
  sessionUrl: null,
  prUrl: null,
  error: null,
  updatedAt: "2026-09-20T10:00:00.000Z",
};
const get = (id = jobId) =>
  GET(new Request(`http://localhost/api/capability/${id}`), {
    params: Promise.resolve({ jobId: id }),
  });

describe("/api/capability/[jobId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "authenticated-guest" } });
    mocks.refresh.mockResolvedValue(capability);
  });
  it("requires authentication and validates ids", async () => {
    mocks.auth.mockResolvedValue(undefined);
    expect((await get()).status).toBe(401);
    mocks.auth.mockResolvedValue({ user: { id: "authenticated-guest" } });
    expect((await get("bad")).status).toBe(404);
  });
  it("returns the strict private capability shape", async () => {
    const response = await get();
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(v.safeParse(CapabilityOutputSchema, await response.json()).success).toBe(true);
  });
});
