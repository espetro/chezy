import { describe, expect, it } from "vitest";
import { cases } from "./cases";
import {
  assertComparable,
  datasetCsv,
  datasetInput,
  signals,
  suiteHash,
  type Run,
} from "./evaluation";

const run = (phase: "before" | "after"): Run => ({
  schemaVersion: 1,
  phase,
  runId: `unit-test-${phase}`,
  revision: (phase === "before" ? "a" : "b").repeat(40),
  suiteHash: suiteHash(),
  adapterHash: "same-adapter",
  promptHash: `${phase}-prompt`,
  config: {
    target: "concierge-text-synthesis-with-fixture-history",
    baseURL: "https://api.studio.nebius.com/v1",
    model: "unit-test-model",
    temperature: 0,
    maxOutputTokens: 700,
    supportsToolsPrompt: true,
    executableTools: false,
    memory: "none",
  },
  results: cases.map((testCase) => ({
    caseId: testCase.id,
    input: datasetInput(testCase),
    expectedOutput: testCase.expectedOutput,
    status: "completed",
    output: "Synthetic unit-test text, not model evidence.",
    finishReason: "stop",
  })),
});

describe("JES-9 frozen suite", () => {
  it("pins case content, order and all ten unique IDs", () => {
    expect(cases).toHaveLength(10);
    expect(new Set(cases.map((testCase) => testCase.id)).size).toBe(10);
    expect(suiteHash()).toBe("57a95334e417386eb076e549599fce31714246988a328e9843ba5d9ad349a90f");
    expect(new Set(cases.map((testCase) => testCase.category))).toEqual(
      new Set(["coverage", "deal-breaker", "amenity", "grounding", "source-injection", "booking"]),
    );
  });

  it("exports quoted histories and criteria without conflating criteria with responses", () => {
    const csv = datasetCsv();
    expect(csv.split("\n")).toHaveLength(12);
    expect(csv.startsWith("input,expected_output,tag\n")).toBe(true);
    expect(csv).toContain('""role"":""user""');
    expect(csv).toContain('"booking-request"');
    expect(csv).not.toContain("Synthetic unit-test text");
  });

  it("reports lexical signals only, never infers semantic booking safety from negation", () => {
    expect(signals("booking-request", "I have not booked it.")).toEqual({ nonempty: true });
    expect(signals("booking-request", "Your visit is confirmed.")).toEqual({ nonempty: true });
    expect(signals("booking-request", " ")).toEqual({ nonempty: false });
    expect(signals("unsupported-city", "BARCELONA only.")).toEqual({
      nonempty: true,
      mentionsBarcelona: true,
    });
    expect(signals("instruction-like-source", "BOOKING_CONFIRMED_EVAL_001")).toEqual({
      nonempty: true,
      omitsInjectedMarker: false,
    });
  });
});

describe("before/after evidence guards", () => {
  it("accepts complete comparable outputs without treating them as passing", () => {
    expect(assertComparable(run("before"), run("after"))).toBeUndefined();
  });

  it.each(["suiteHash", "adapterHash"] as const)("rejects a changed %s", (key) => {
    const after = run("after");
    after[key] = "changed";
    expect(() => assertComparable(run("before"), after)).toThrow(key);
  });

  it("rejects model changes, identical prompts and reversed phases", () => {
    const after = run("after");
    after.config.model = "another-model";
    expect(() => assertComparable(run("before"), after)).toThrow("settings");
    expect(() =>
      assertComparable(run("before"), { ...run("after"), promptHash: "before-prompt" }),
    ).toThrow("prompt change");
    expect(() => assertComparable(run("after"), run("before"))).toThrow("before run");
  });

  it.each([
    "missing",
    "duplicate",
    "reordered",
    "error",
    "empty",
    "truncated",
    "input",
    "criterion",
  ])("rejects %s results rather than shrinking the denominator", (mutation) => {
    const after = run("after");
    const first = after.results[0]!;
    if (mutation === "missing") after.results.pop();
    if (mutation === "duplicate") after.results[1] = first;
    if (mutation === "reordered") after.results.reverse();
    if (mutation === "error") first.status = "error";
    if (mutation === "empty") first.output = "";
    if (mutation === "truncated") first.finishReason = "length";
    if (mutation === "input") first.input = "changed";
    if (mutation === "criterion") first.expectedOutput = "always pass";
    expect(() => assertComparable(run("before"), after)).toThrow();
  });
});
