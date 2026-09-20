import { describe, expect, it, vi } from "vitest";
import { createBookingController, resolveBookingResponse } from "~/lib/booking";

const booked = { status: "booked", channel: "mock", slotIso: "2026-09-21T10:00:00.000Z" };
const slot = booked.slotIso;

function storage(entries = new Map<string, string>()) {
  return {
    entries,
    getItem: (key: string) => entries.get(key) ?? undefined,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}

describe("booking response validation", () => {
  it("accepts a booked result", () => {
    expect(resolveBookingResponse(booked, true)).toEqual({ status: "booked", result: booked });
  });
  it.each([
    [{ status: "failed", channel: "google", slotIso: slot, detail: "quota" }, false, "quota"],
    [{ status: "failed", channel: "google", slotIso: slot }, false, /did not confirm/],
    [booked, false, /did not confirm/],
    [{}, true, /did not confirm/],
    [{ ...booked, channel: "slng" }, true, /did not confirm/],
  ])("fails closed on %j (ok=%s)", (body, ok, detail) => {
    expect(resolveBookingResponse(body, ok)).toMatchObject({ status: "failed", detail });
  });
});

describe("booking controller", () => {
  it("books once, persists the receipt and restores it after remount", async () => {
    const saved = storage();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(booked));
    const controller = createBookingController("listing", saved, fetcher);
    const first = controller.book(slot);
    expect(controller.book(slot)).toBe(first);
    expect((await first).status).toBe("booked");
    expect((await controller.book(slot)).status).toBe("booked");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ propertyRef: "listing", slotIso: slot }),
    );

    const remounted = createBookingController("listing", saved, fetcher);
    expect(remounted.restore()).toEqual({ status: "booked", result: booked });
    expect((await remounted.book(slot)).status).toBe("booked");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("surfaces the server detail on a 502 and allows a retry", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json(
          { status: "failed", channel: "google", slotIso: slot, detail: "insert failed" },
          { status: 502 },
        ),
      )
      .mockResolvedValueOnce(Response.json(booked));
    const controller = createBookingController("listing", storage(), fetcher);
    expect(await controller.book(slot)).toEqual({ status: "failed", detail: "insert failed" });
    expect((await controller.book(slot)).status).toBe("booked");
  });
  it("does not persist failures", async () => {
    const saved = storage();
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    const controller = createBookingController("listing", saved, fetcher);
    expect((await controller.book(slot)).status).toBe("failed");
    expect(saved.entries.size).toBe(0);
  });
  it("restores to idle on a corrupt or foreign receipt", () => {
    const corrupt = storage(new Map([["chezy:booking:listing", "{not json"]]));
    expect(createBookingController("listing", corrupt).restore()).toEqual({ status: "idle" });
    const other = storage(new Map([["chezy:booking:other", JSON.stringify(booked)]]));
    expect(createBookingController("listing", other).restore()).toEqual({ status: "idle" });
  });
});
