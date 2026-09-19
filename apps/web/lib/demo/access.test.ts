import { describe, expect, it, vi } from "vitest";

import { isDemoRehearsalSafe, isDemoResetEnabled } from "./access";

const config = vi.hoisted(() => ({
  development: false,
  env: {
    IS_DEMO: undefined as string | undefined,
    VIEWING_MODE: "mock",
    CALENDAR_MODE: "mock",
  },
}));
vi.mock("~/lib/constants", () => ({
  get isDevelopmentEnvironment() {
    return config.development;
  },
}));
vi.mock("~/lib/env", () => ({ env: config.env }));

describe("demo reset gates", () => {
  it.each([
    [false, undefined, false],
    [false, "0", false],
    [false, "true", false],
    [false, "1", true],
    [true, undefined, true],
  ])("development=%s IS_DEMO=%s allows reset=%s", (development, demo, allowed) => {
    config.development = development;
    config.env.IS_DEMO = demo;
    expect(isDemoResetEnabled()).toBe(allowed);
  });

  it.each([
    ["mock", "mock", true],
    ["slng", "mock", false],
    ["vonage", "mock", false],
    ["mock", "google", false],
  ])("viewing=%s calendar=%s is rehearsal safe=%s", (viewing, calendar, safe) => {
    config.env.VIEWING_MODE = viewing;
    config.env.CALENDAR_MODE = calendar;
    expect(isDemoRehearsalSafe()).toBe(safe);
  });
});
