import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const rows: Record<string, any> = {};
  let created = false;
  return {
    rows,
    get created() {
      return created;
    },
    set created(value: boolean) {
      created = value;
    },
  };
});
const envMock = vi.hoisted(() => ({ FORGE_TRIGGER_MODE: "mock", DEVIN_API_KEY: undefined }));
const createSession = vi.hoisted(() => vi.fn());
const loggerError = vi.hoisted(() => vi.fn());

vi.mock("~/lib/env", () => ({ env: envMock }));
vi.mock("@chezy/observability", () => ({ getLogger: () => ({ error: loggerError }) }));
vi.mock("~/lib/devin/client", () => ({
  createDevinClient: vi.fn(() => ({ createSession })),
}));
vi.mock("~/lib/db/schema", () => ({
  capabilityJob: { id: "id", capability: "capability", userId: "userId", status: "status" },
  adaptationJob: { id: "adaptationJobId" },
}));
vi.mock("~/lib/db/client", () => ({
  db: {
    insert: () => ({
      values: (value: any) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (state.created) return [];
            state.created = true;
            const row = {
              id: "660e8400-e29b-41d4-a716-446655440000",
              ...value,
              providerSessionUrl: null,
              prUrl: null,
              error: null,
              updatedAt: new Date("2026-09-20T10:00:00.000Z"),
            };
            state.rows[row.id] = row;
            return [row];
          },
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: async () => Object.values(state.rows),
      }),
    }),
    update: () => ({
      set: (patch: any) => ({
        where: () => {
          const row = Object.values(state.rows)[0];
          if (row) Object.assign(row, patch, { updatedAt: new Date() });
          return {
            then: (resolve: (value: any[]) => unknown) => resolve(row ? [row] : []),
            returning: async () => (row ? [row] : []),
          };
        },
      }),
    }),
  },
}));

const { launchCapabilityForge } = await import("~/lib/capability/jobs");

describe("launchCapabilityForge", () => {
  beforeEach(() => {
    envMock.FORGE_TRIGGER_MODE = "mock";
    state.created = false;
    for (const key of Object.keys(state.rows)) delete state.rows[key];
    createSession.mockReset();
  });

  it("deduplicates a capability and does not create a second session", async () => {
    const input = {
      userId: "user",
      adaptationJobId: "adaptation",
      trace: [],
      gap: {
        capability: "listing.outdoorSpace.population",
        coverage: 0,
        covered: 0,
        total: 5,
      },
    };
    const first = await launchCapabilityForge(input);
    const second = await launchCapabilityForge(input);
    expect(first?.jobId).toBe(second?.jobId);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("does not touch the database when disabled", async () => {
    envMock.FORGE_TRIGGER_MODE = "off";
    expect(
      await launchCapabilityForge({
        userId: "user",
        adaptationJobId: "adaptation",
        trace: [],
        gap: { capability: "listing.outdoorSpace.population", coverage: 0, covered: 0, total: 5 },
      }),
    ).toBeUndefined();
    expect(state.created).toBe(false);
  });
});
