import { describe, expect, it } from "vitest";

import { isSameOrigin, requestOrigin } from "./request-origin";

const request = (headers: Record<string, string>) =>
  new Request("http://localhost:3000/api/feedback", { method: "POST", headers });

describe("requestOrigin", () => {
  it.each([
    [{}, "http://localhost:3000"],
    [{ host: "app.local:3000" }, "http://app.local:3000"],
    [
      {
        host: "mac.tailnet.ts.net",
        "x-forwarded-host": "mac.tailnet.ts.net",
        "x-forwarded-proto": "https",
      },
      "https://mac.tailnet.ts.net",
    ],
    [
      { "x-forwarded-host": "edge.example, internal", "x-forwarded-proto": "https, http" },
      "https://edge.example",
    ],
  ])("derives the browser-facing origin from %j", (headers, expected) => {
    expect(requestOrigin(request(headers))).toBe(expected);
  });
});

describe("isSameOrigin", () => {
  const proxied = { "x-forwarded-host": "mac.tailnet.ts.net", "x-forwarded-proto": "https" };
  it.each([
    [{}, true],
    [{ origin: "http://localhost:3000" }, true],
    [{ origin: "http://other.test" }, false],
    [{ ...proxied, origin: "https://mac.tailnet.ts.net" }, true],
    [{ ...proxied, origin: "http://localhost:3000" }, false],
    [{ ...proxied, origin: "https://other.test" }, false],
  ])("%j -> %s", (headers, expected) => {
    expect(isSameOrigin(request(headers))).toBe(expected);
  });
});
