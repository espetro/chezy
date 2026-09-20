import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("~/lib/env", () => ({
  env: { SLNG_API_KEY: "k", SLNG_AGENT_ID: "a" },
}));

const warnSpy = vi.hoisted(() => vi.fn());
vi.mock("@chezy/observability", () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: warnSpy,
    error: vi.fn(),
  }),
}));

import { dispatchSlngCall, ensureSlngAgentPinned, getSlngCall } from "~/lib/slng";

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
  warnSpy.mockClear();
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

describe("declared call arguments", () => {
  const TEMPLATE_VARIABLES = {
    property_title: { usage: "x", default: "", required: false },
    property_location: { usage: "x", default: "", required: false },
    property_price: { usage: "x", default: "", required: false },
    property_rooms: { usage: "x", default: "", required: false },
    property_m2: { usage: "x", default: "", required: false },
    property_ref: { usage: "x", default: "", required: false },
  };

  test("drops undeclared variables and warns", async () => {
    const mock = fetchMock();
    mock
      .mockResolvedValueOnce(
        jsonResponse({
          region: "eu-central",
          orchestrator: "livekit",
          sip_outbound_trunk_id: "t1",
          template_variables: TEMPLATE_VARIABLES,
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ call_id: "c1", message: "ok" }));

    const result = await dispatchSlngCall({
      to: "+34600000000",
      variables: {
        property_title: "x",
        property_ref: "r",
        property_highlights: "h",
      },
    });

    expect(result.callId).toBe("c1");
    const body = JSON.parse(mock.mock.calls[1]?.[1]?.body as string);
    expect(body.arguments).toEqual({
      property_title: "x",
      property_ref: "r",
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message, props] = warnSpy.mock.calls[0] ?? [];
    expect(`${message} ${JSON.stringify(props)}`).toContain("property_highlights");
  });

  test("passes variables through unchanged when template_variables is absent", async () => {
    const mock = fetchMock();
    mock
      .mockResolvedValueOnce(
        jsonResponse({
          region: "eu-central",
          orchestrator: "livekit",
          sip_outbound_trunk_id: "t1",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ call_id: "c1" }));

    await dispatchSlngCall({
      to: "+34600000000",
      variables: { property_title: "x", property_highlights: "h" },
    });

    const body = JSON.parse(mock.mock.calls[1]?.[1]?.body as string);
    expect(body.arguments).toEqual({
      property_title: "x",
      property_highlights: "h",
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test("still rejects on a missing SIP trunk before filtering arguments", async () => {
    const mock = fetchMock();
    mock.mockResolvedValueOnce(
      jsonResponse({
        region: "eu-central",
        orchestrator: "livekit",
        sip_outbound_trunk_id: null,
        template_variables: TEMPLATE_VARIABLES,
      }),
    );

    await expect(
      dispatchSlngCall({
        to: "+34600000000",
        variables: { property_title: "x" },
      }),
    ).rejects.toThrow(/trunk/i);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
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
      declaredVariables: undefined,
    });
  });
});

describe("getSlngCall", () => {
  test("maps an in-progress answered call without a finalized transcript", async () => {
    const mock = fetchMock();
    mock.mockResolvedValueOnce(
      jsonResponse({
        status: "in_progress",
        call_started_at: "2026-09-20T12:00:00.000Z",
        call_events: [{ event: "first_user_message", created_at: "2026-09-20T12:00:03.000Z" }],
        livekit_session_report: null,
      }),
    );

    await expect(getSlngCall("call/1")).resolves.toEqual({
      status: "in_progress",
      startedAt: "2026-09-20T12:00:00.000Z",
      endedAt: undefined,
      endReason: undefined,
      answered: true,
      toolNames: [],
      transcript: [],
    });
    expect(mock.mock.calls[0]?.[0]).toBe(`${BASE}/v1/agents/a/calls/call%2F1`);
  });

  test("maps completed transcript messages and tool executions", async () => {
    const mock = fetchMock();
    mock.mockResolvedValueOnce(
      jsonResponse({
        status: "completed",
        finalized_at: "2026-09-20T12:01:00.000Z",
        call_end_reason: "hangup",
        call_events: [],
        tool_executions: [{ tool_name: "book_viewing" }],
        livekit_session_report: {
          chat_history: {
            items: [
              { type: "system", role: "assistant", content: ["ignored"] },
              { type: "message", role: "assistant", content: ["Hola", "agencia"] },
              { type: "message", role: "user", content: "Sí" },
              { type: "message", role: "user", content: ["  "] },
            ],
          },
        },
      }),
    );

    await expect(getSlngCall("c1")).resolves.toEqual({
      status: "completed",
      startedAt: undefined,
      endedAt: "2026-09-20T12:01:00.000Z",
      endReason: "hangup",
      answered: false,
      toolNames: ["book_viewing"],
      transcript: [
        { role: "agent", text: "Hola agencia" },
        { role: "human", text: "Sí" },
      ],
    });
  });

  test("throws a retryable error for a non-ok response", async () => {
    const mock = fetchMock();
    mock.mockResolvedValueOnce(jsonResponse({ error: "unavailable" }, 503));

    await expect(getSlngCall("c1")).rejects.toMatchObject({
      message: "SLNG call fetch failed: 503",
      retryable: true,
    });
  });
});
