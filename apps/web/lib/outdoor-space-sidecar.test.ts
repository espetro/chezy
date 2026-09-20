import { describe, expect, test } from "vitest";

import type { OutdoorSpace } from "@chezy/contract";

import { mergeOutdoorSpace, parseOutdoorSpaceSidecar } from "~/lib/outdoor-space-sidecar";

type Record = {
  platform: string;
  platform_id: string;
  url: string;
  outdoor_space?: OutdoorSpace | null;
};

const base: Record = { platform: "fotocasa", platform_id: "1", url: "https://example.test/1" };

describe("parseOutdoorSpaceSidecar", () => {
  test("keys valid lines by platform:platform_id and reports invalid ones", () => {
    const { sidecar, failures } = parseOutdoorSpaceSidecar([
      '{"platform":"fotocasa","platform_id":"1","outdoor_space":"balcony"}',
      "",
      '{"platform":"pisos","platform_id":"2","outdoor_space":"rooftop"}',
      '{"platform":"pisos","platform_id":"3","outdoor_space":"none"}',
    ]);
    expect([...sidecar.entries()]).toEqual([
      ["fotocasa:1", "balcony"],
      ["pisos:3", "none"],
    ]);
    expect(failures).toHaveLength(1);
  });
});

describe("mergeOutdoorSpace", () => {
  const sidecar = new Map([["fotocasa:1", "terrace" as const]]);

  test("fills a record that has no outdoor_space from the sidecar", () => {
    expect(mergeOutdoorSpace(base, sidecar).outdoor_space).toBe("terrace");
    // oxlint-disable-next-line unicorn/no-null -- wire seam: JSONL carries explicit nulls
    expect(mergeOutdoorSpace({ ...base, outdoor_space: null }, sidecar).outdoor_space).toBe(
      "terrace",
    );
  });

  test("keeps a value the record already carries", () => {
    const record: Record = { ...base, outdoor_space: "garden" };
    expect(mergeOutdoorSpace(record, sidecar)).toBe(record);
  });

  test("leaves a listing missing from the sidecar unknown", () => {
    const record = { ...base, platform_id: "99" };
    expect(mergeOutdoorSpace(record, sidecar)).toBe(record);
    expect(mergeOutdoorSpace(record, sidecar).outdoor_space).toBeUndefined();
  });
});
