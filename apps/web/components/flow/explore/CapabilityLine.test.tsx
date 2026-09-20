import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CapabilityJob } from "@chezy/contract";
import { CapabilityLine } from "./CapabilityLine";

vi.mock("swr", () => ({
  default: (
    _key: readonly [string],
    _fetcher: unknown,
    options: { fallbackData: CapabilityJob },
  ) => ({ data: options.fallbackData }),
}));

const capability = (overrides: Partial<CapabilityJob> = {}): CapabilityJob => ({
  jobId: "660e8400-e29b-41d4-a716-446655440000",
  capability: "listing.outdoorSpace.population",
  status: "running",
  provider: "mock",
  coverage: 0,
  sessionUrl: null,
  prUrl: null,
  error: null,
  updatedAt: "2026-09-20T10:00:00.000Z",
  ...overrides,
});

describe("CapabilityLine", () => {
  it("renders the simulated provider copy", () => {
    const html = renderToStaticMarkup(createElement(CapabilityLine, { capability: capability() }));
    expect(html).toContain("Simulated: capability gap recorded");
  });

  it("links to a running Devin session", () => {
    const html = renderToStaticMarkup(
      createElement(CapabilityLine, {
        capability: capability({
          provider: "devin",
          sessionUrl: "https://app.devin.ai/sessions/session-1",
        }),
      }),
    );
    expect(html).toContain("View session");
    expect(html).toContain('href="https://app.devin.ai/sessions/session-1"');
  });

  it("links to an opened pull request", () => {
    const html = renderToStaticMarkup(
      createElement(CapabilityLine, {
        capability: capability({
          provider: "devin",
          status: "pr_opened",
          sessionUrl: "https://app.devin.ai/sessions/session-1",
          prUrl: "https://github.com/espetro/chezy/pull/14",
        }),
      }),
    );
    expect(html).toContain("PR opened");
    expect(html).toContain('href="https://github.com/espetro/chezy/pull/14"');
  });

  it("renders the provider error", () => {
    const html = renderToStaticMarkup(
      createElement(CapabilityLine, {
        capability: capability({
          provider: "devin",
          status: "failed",
          error: "Devin is not configured.",
        }),
      }),
    );
    expect(html).toContain("Devin is not configured.");
  });
});
