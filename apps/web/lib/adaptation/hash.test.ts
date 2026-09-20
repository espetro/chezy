import { describe, expect, it } from "vitest";
import { canonicalJson, hashCandidate } from "~/lib/adaptation/hash";

describe("hashCandidate", () => {
  it("ignores key order at every depth", () => {
    expect(hashCandidate({ a: 1, b: { c: [1, { d: 2, e: 3 }] } })).toBe(
      hashCandidate({ b: { c: [1, { e: 3, d: 2 }] }, a: 1 }),
    );
  });
  it("treats array order as content", () => {
    expect(hashCandidate({ ids: ["a", "b"] })).not.toBe(hashCandidate({ ids: ["b", "a"] }));
  });
  it("hashes undefined members like absent ones", () => {
    expect(hashCandidate({ a: 1, note: undefined })).toBe(hashCandidate({ a: 1 }));
  });
  it("prefixes the digest", () => {
    expect(hashCandidate(null)).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(canonicalJson({ b: null, a: "x" })).toBe('{"a":"x","b":null}');
  });
});
