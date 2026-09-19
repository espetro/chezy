import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: { SLNG_API_KEY: "k", SLNG_AGENT_ID: "a" },
}));

import { dispatchSlngCall, ensureSlngAgentPinned } from "@/lib/slng";

const BASE = "https://api.agents.slng.ai";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fetchMock(): ReturnType<typeof vi.fn> {
  const mock = vi.fn();
  vi.stubGlobal("fetch", mock);
  return mock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("dispatchSlngCall", () => {
  test("dispatches without PATCH when the agent is already pinned", async () => {
    const mock = fetchMock();
    mock
      .mockResolvedValueOnce(
        jsonResponse({
          region: "eu-central",
          orchestrator: "livekit",
          livekit_deployment: "default-eu",
          sip_outbound_trunk_id: "t1",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ call_id: "c1", message: "ok" }));

    const result = await dispatchSlngCall({ to: "+15551234567" });

    expect(result).toEqual({ callId: "c1", detail: "ok" });
    expect(mock).toHaveBeenCalledTimes(2);
    expect(mock.mock.calls[0]?.[0]).toBe(`${BASE}/v1/agents/a`);
    expect(mock.mock.calls[0]?.[1]?.method).toBe("GET");
    expect(mock.mock.calls[1]?.[0]).toBe(`${BASE}/v1/agents/a/calls`);
    expect(mock.mock.calls[1]?.[1]?.method).toBe("POST");
  });

  test("PATCHes region+orchestrator before dispatch when the agent drifted", async () => {
    const mock = fetchMock();
    mock
      .mockResolvedValueOnce(
        jsonResponse({
          region: "eu-west",
          orchestrator: "pipecat",
          sip_outbound_trunk_id: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          region: "eu-central",
          orchestrator: "livekit",
          livekit_deployment: "default-eu",
          sip_outbound_trunk_id: "t1",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ call_id: "c1" }));

    const result = await dispatchSlngCall({ to: "+15551234567" });

    expect(result.callId).toBe("c1");
    expect(mock).toHaveBeenCalledTimes(3);
    expect(mock.mock.calls[1]?.[0]).toBe(`${BASE}/v1/agents/a`);
    expect(mock.mock.calls[1]?.[1]?.method).toBe("PATCH");
    expect(mock.mock.calls[1]?.[1]?.body).toBe(
      JSON.stringify({ region: "eu-central", orchestrator: "livekit" }),
    );
    expect(mock.mock.calls[2]?.[0]).toBe(`${BASE}/v1/agents/a/calls`);
  });

  test("rejects without dispatching when no outbound SIP trunk is attached", async () => {
    const mock = fetchMock();
    mock.mockResolvedValueOnce(
      jsonResponse({
        region: "eu-central",
        orchestrator: "livekit",
        sip_outbound_trunk_id: null,
      }),
    );

    await expect(dispatchSlngCall({ to: "+15551234567" })).rejects.toThrow(/no outbound SIP trunk/);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  test("rejects when the pin PATCH fails", async () => {
    const mock = fetchMock();
    mock
      .mockResolvedValueOnce(
        jsonResponse({
          region: "eu-west",
          orchestrator: "pipecat",
          sip_outbound_trunk_id: null,
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "AGENT_NOT_FOUND",
              message:
                "No default LiveKit deployment configured for region 'eu-central' and orchestrator 'pipecat'",
            },
          },
          404,
        ),
      );

    await expect(dispatchSlngCall({ to: "+15551234567" })).rejects.toThrow(
      /SLNG agent update failed: 404/,
    );
    expect(mock).toHaveBeenCalledTimes(2);
  });
});

describe("ensureSlngAgentPinned", () => {
  test("returns mapped snake_case state", async () => {
    const mock = fetchMock();
    mock.mockResolvedValueOnce(
      jsonResponse({
        region: "eu-central",
        orchestrator: "livekit",
        livekit_deployment: "default-eu",
        sip_outbound_trunk_id: "t1",
      }),
    );

    await expect(ensureSlngAgentPinned()).resolves.toEqual({
      region: "eu-central",
      orchestrator: "livekit",
      livekitDeployment: "default-eu",
      sipOutboundTrunkId: "t1",
    });
  });
});
