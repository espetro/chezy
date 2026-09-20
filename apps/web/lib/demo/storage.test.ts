import { describe, expect, it } from "vitest";

import { clearDemoAutoCallMarkers } from "./storage";

describe("clearDemoAutoCallMarkers", () => {
  it.each([
    [],
    ["chezy:autocall:a"],
    ["theme", "chezy:autocall:a", "chezy:autocall:b", "auth", "chezy:autocall:c"],
    ["not-chezy:autocall:a", "chezy:autocall", "chezy:autocall:"],
  ])("removes all and only prefixed markers from %j", (...keys: string[]) => {
    const values = new Map(keys.map((key) => [key, "unchanged"]));
    const unrelated = keys.filter((key) => !key.startsWith("chezy:autocall:"));
    const storage = {
      get length() {
        return values.size;
      },
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
    clearDemoAutoCallMarkers(storage);
    expect([...values.keys()]).toEqual(unrelated);
    expect([...values.values()]).toEqual(unrelated.map(() => "unchanged"));
    clearDemoAutoCallMarkers(storage);
    expect([...values.keys()]).toEqual(unrelated);
  });
});
