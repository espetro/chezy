import { describe, expect, it, vi } from "vitest";
import { createViewingController, resolveViewingResponse } from "~/lib/viewing";

const dispatched = {
  status: "dispatched",
  channel: "slng",
  callId: "redacted:123456abcdef",
  requestedAt: "2026-09-19T12:00:00.000Z",
  dispatchedAt: "2026-09-19T12:00:00.200Z",
  latencyMs: 200,
};
const simulated = {
  status: "mock",
  channel: "mock",
  slotIso: "2026-09-20T12:00:00.000Z",
};

function storage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? undefined,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

describe("viewing response validation", () => {
  it("keeps a dispatch unbooked without requiring a slot", () => {
    expect(resolveViewingResponse(dispatched, true)).toEqual({
      status: "dispatched",
      result: dispatched,
    });
  });
  it("labels mock as simulated", () => {
    expect(resolveViewingResponse(simulated, true).status).toBe("simulated");
  });
  it("preserves failure and retry semantics", () => {
    expect(
      resolveViewingResponse(
        { status: "failed", channel: "slng", retryable: false, detail: "uncertain" },
        false,
      ),
    ).toEqual({ status: "failed", retryable: false, detail: "uncertain" });
  });
  it.each([
    {},
    undefined,
    { status: "booked" },
    { status: "unexpected" },
    { ...simulated, slotIso: undefined },
    { ...simulated, slotIso: "not a date" },
    { ...simulated, slotIso: "2026-99-99T12:00:00.000Z" },
    { ...simulated, slotIso: "2026-02-30T12:00:00.000Z" },
    { ...dispatched, slotIso: simulated.slotIso },
    { ...dispatched, callId: undefined },
    { ...dispatched, latencyMs: -1 },
    { ...dispatched, channel: "mock" },
  ])("fails closed on malformed success %j", (body) => {
    expect(resolveViewingResponse(body, true)).toMatchObject({ status: "failed", retryable: true });
  });
  it("does not accept a success body with a failure HTTP status", () => {
    expect(resolveViewingResponse(dispatched, false).status).toBe("failed");
  });
});

describe("viewing request controller", () => {
  it("deduplicates in-flight clicks and refuses retries after dispatch", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(dispatched));
    const controller = createViewingController("listing", storage(), fetcher);
    const first = controller.start(true);
    expect(controller.start(true)).toBe(first);
    expect((await first).status).toBe("dispatched");
    await controller.start(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("reuses the request ID after a network error and after remount", async () => {
    const saved = storage();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(Response.json(dispatched));
    const controller = createViewingController("listing", saved, fetcher);
    expect(await controller.start(true)).toMatchObject({ status: "failed", retryable: true });
    const remounted = createViewingController("listing", saved, fetcher);
    expect(remounted.restore().status).toBe("failed");
    expect((await remounted.start()).status).toBe("dispatched");
    const bodies = fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies[0].requestId).toBe(bodies[1].requestId);
    expect(bodies[1].live).toBe(true);
    const finalMount = createViewingController("listing", saved, fetcher);
    expect(finalMount.restore().status).toBe("dispatched");
    await finalMount.start(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("allows genuine failure retry, but not an uncertain provider outcome", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { status: "failed", channel: "slng", detail: "rejected", retryable: true },
          { status: 502 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json(
          { status: "failed", channel: "slng", detail: "uncertain", retryable: false },
          { status: 502 },
        ),
      );
    const controller = createViewingController("listing", storage(), fetcher);
    await controller.start(true);
    await controller.start();
    await controller.start();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("retries malformed successful bodies using the same request ID", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(Response.json(dispatched));
    const controller = createViewingController("listing", storage(), fetcher);
    expect((await controller.start(true)).status).toBe("failed");
    expect((await controller.start()).status).toBe("dispatched");
    const first = JSON.parse(String(fetcher.mock.calls[0][1]?.body));
    const second = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(first.requestId).toBe(second.requestId);
    expect(second.retry).toBe(true);
  });
  it("defaults to mock; live needs a separate opt-in", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(simulated))
      .mockResolvedValueOnce(Response.json(dispatched));
    const controller = createViewingController("listing", storage(), fetcher);
    await controller.start();
    await controller.start();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).live).toBe(false);
    await controller.start(true);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).live).toBe(true);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).retry).toBe(false);
  });
  it("does not dispatch live if browser receipt storage fails", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const saved = {
      ...storage(),
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const controller = createViewingController("listing", saved, fetcher);
    expect((await controller.start(true)).status).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("allows configuration rejection to be retried even after remount", async () => {
    const saved = storage();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          {
            status: "failed",
            channel: "slng",
            detail: "disabled",
            retryable: true,
          },
          { status: 403 },
        ),
      )
      .mockResolvedValueOnce(Response.json(simulated))
      .mockResolvedValueOnce(Response.json(dispatched));
    const controller = createViewingController("listing", saved, fetcher);
    // A pre-dispatch config rejection does not commit the user to live.
    expect(await controller.start(true)).toMatchObject({
      status: "failed",
      retryable: true,
      live: false,
    });
    const remounted = createViewingController("listing", saved, fetcher);
    expect(remounted.restore()).toMatchObject({
      status: "failed",
      retryable: true,
      live: false,
    });
    // A fresh simulation carries no requestId.
    expect((await remounted.start()).status).toBe("simulated");
    const simulatedBody = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(simulatedBody.live).toBe(false);
    expect(simulatedBody).not.toHaveProperty("requestId");
    // Opting back into live reuses the original requestId without a retry flag.
    expect((await remounted.start(true)).status).toBe("dispatched");
    const liveBody = JSON.parse(String(fetcher.mock.calls[2][1]?.body));
    expect(liveBody.live).toBe(true);
    expect(liveBody.retry).toBe(false);
    expect(liveBody.requestId).toBe(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).requestId);
  });

  it("keeps live on record after a provider rejection", async () => {
    const saved = storage();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { status: "failed", channel: "slng", detail: "rejected", retryable: true },
          { status: 502 },
        ),
      );
    const controller = createViewingController("listing", saved, fetcher);
    expect(await controller.start(true)).toMatchObject({
      status: "failed",
      retryable: true,
      live: true,
    });
    const remounted = createViewingController("listing", saved, fetcher);
    expect(remounted.restore()).toMatchObject({ status: "failed", live: true });
  });

  it("network failure keeps live on record", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("network"));
    const controller = createViewingController("listing", storage(), fetcher);
    expect(await controller.start(true)).toMatchObject({ live: true, retryable: true });
  });

  it("abandons an ended call and dispatches a fresh request", async () => {
    const saved = storage();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(dispatched))
      .mockResolvedValueOnce(Response.json(dispatched));
    const controller = createViewingController("listing", saved, fetcher);
    await controller.start(true);
    const firstRequestId = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)).requestId;

    expect(controller.abandon("x")).toEqual({
      status: "failed",
      detail: "x",
      retryable: true,
      live: true,
    });
    await controller.start(true);

    const secondBody = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
    expect(secondBody.requestId).not.toBe(firstRequestId);
    expect(secondBody.retry).toBe(false);
  });

  it("restores an abandoned call as retryable and dispatches after remount", async () => {
    const saved = storage();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(dispatched))
      .mockResolvedValueOnce(Response.json(dispatched));
    const controller = createViewingController("listing", saved, fetcher);
    await controller.start(true);
    controller.abandon("x");

    const remounted = createViewingController("listing", saved, fetcher);
    expect(remounted.restore()).toMatchObject({ status: "failed", retryable: true });
    await remounted.start(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
