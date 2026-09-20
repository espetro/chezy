import { RequestContext } from "@mastra/core/request-context";
import type { Tool } from "ai";
import { describe, expect, it } from "vitest";
import * as v from "valibot";

import { adaptTool, USERNAME_CONTEXT_KEY } from "./adapt";

const input = v.object({
  username: v.string(),
  city: v.string(),
});

function schemaJson(schema: unknown): Record<string, unknown> {
  const standard = (schema as { "~standard": { jsonSchema: { input(o: unknown): unknown } } })[
    "~standard"
  ];
  return standard.jsonSchema.input({ target: "draft-07" }) as Record<string, unknown>;
}

describe("adaptTool", () => {
  it("strips username from the advertised input schema", () => {
    const adapted = adaptTool({
      id: "demo",
      source: { description: "demo", execute: async () => ({ ok: true }) } as unknown as Tool,
      input,
    });
    const json = schemaJson(adapted.inputSchema);
    expect(json.properties).toHaveProperty("city");
    expect(json.properties).not.toHaveProperty("username");
  });

  it("injects the username from request context on execute", async () => {
    let received: unknown;
    const adapted = adaptTool({
      id: "demo",
      source: {
        execute: async (args: unknown) => {
          received = args;
          return { ok: true };
        },
      } as unknown as Tool,
      input,
    });
    const requestContext = new RequestContext();
    requestContext.set(USERNAME_CONTEXT_KEY, "tg-42");
    await adapted.execute?.({ city: "bcn" }, { requestContext } as never);
    expect(received).toEqual({ city: "bcn", username: "tg-42" });
  });

  it("throws when no username is on the context", async () => {
    const adapted = adaptTool({
      id: "demo",
      source: { execute: async () => ({ ok: true }) } as unknown as Tool,
      input,
    });
    await expect(
      adapted.execute?.({ city: "bcn" }, { requestContext: new RequestContext() } as never),
    ).rejects.toThrow(/username/i);
  });
});
