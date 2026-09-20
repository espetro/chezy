import { describe, expect, it, vi } from "vitest";
import { ADAPTATION_ERRORS } from "~/lib/adaptation/machine";
import { DevinClientError } from "~/lib/devin/client";

vi.mock("~/lib/db/client", () => ({ db: {} }));

const { providerFailureMessage } = await import("~/lib/adaptation/runner");

describe("providerFailureMessage", () => {
  it.each([
    [new DevinClientError("Devin API responded 403", "out_of_quota", 403), ADAPTATION_ERRORS.quota],
    [
      new DevinClientError("Devin API responded 401", "unauthorized", 401),
      ADAPTATION_ERRORS.unauthorized,
    ],
    [new DevinClientError("Devin API responded 500", "http", 500), ADAPTATION_ERRORS.provider],
    [new DevinClientError("Devin API request failed", "network"), ADAPTATION_ERRORS.provider],
    [new Error("apk_user_secret leaked?"), ADAPTATION_ERRORS.provider],
    ["string error", ADAPTATION_ERRORS.provider],
  ])("maps %o to a safe message", (error, expected) => {
    const message = providerFailureMessage(error);
    expect(message).toBe(expected);
    expect(message).not.toContain("apk_user");
  });
});
