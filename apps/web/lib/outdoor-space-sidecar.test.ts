import { describe, expect, it } from "vitest";

import { mergeOutdoorSpace, parseOutdoorSpaceSidecar } from "~/lib/outdoor-space-sidecar";

const sidecar = parseOutdoorSpaceSidecar([
  '{"platform":"fotocasa","platform_id":"1","outdoor_space":"terrace"}',
  "",
  '{"platform":"pisos","platform_id":"2","outdoor_space":"none"}',
  '{"platform":"pisos","platform_id":"3","outdoor_space":"rooftop"}',
]).sidecar;

describe("parseOutdoorSpaceSidecar", () => {
  it("keys valid lines by platform:platform_id and reports invalid ones", () => {
    const parsed = parseOutdoorSpaceSidecar([
      '{"platform":"fotocasa","platform_id":"1","outdoor_space":"terrace"}',
      '{"platform":"pisos","platform_id":"3","outdoor_space":"rooftop"}',
    ]);
    expect([...parsed.sidecar]).toEqual([["fotocasa:1", "terrace"]]);
    expect(parsed.failures).toHaveLength(1);
  });
});

describe("mergeOutdoorSpace", () => {
  it("fills a record without outdoor_space from the sidecar", () => {
    const record = { platform: "fotocasa", platform_id: "1", title: "x" };
    expect(mergeOutdoorSpace(record, sidecar)).toEqual({ ...record, outdoor_space: "terrace" });
    // DB seam: the seed record shape carries null for absent values.
    // oxlint-disable-next-line unicorn/no-null
    const nulled = { platform: "pisos", platform_id: "2", outdoor_space: null };
    expect(mergeOutdoorSpace(nulled, sidecar).outdoor_space).toBe("none");
  });

  it("keeps a value the record already has", () => {
    const record = { platform: "fotocasa", platform_id: "1", outdoor_space: "garden" as const };
    expect(mergeOutdoorSpace(record, sidecar)).toBe(record);
  });

  it("leaves a listing missing from the sidecar untouched", () => {
    const record = { platform: "habitaclia", platform_id: "9" };
    expect(mergeOutdoorSpace(record, sidecar)).toBe(record);
    // oxlint-disable-next-line unicorn/no-null
    const nulled = { platform: "habitaclia", platform_id: "9", outdoor_space: null };
    expect(mergeOutdoorSpace(nulled, sidecar).outdoor_space).toBeNull();
  });
});
