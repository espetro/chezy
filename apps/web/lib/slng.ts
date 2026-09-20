// SLNG Voice Agents API. The agent places the outbound call; dispatch
// requires an outbound connection to be attached to the agent first
// (connection creation is dashboard-only in SLNG).
import { getLogger } from "@chezy/observability";

import {
  FETCH_TIMEOUT_MS,
  SLNG_AGENT_ORCHESTRATOR,
  SLNG_AGENT_REGION,
  SLNG_API_BASE_URL,
} from "~/lib/constants";
import { env } from "~/lib/env";
import { CallDispatchError } from "~/lib/viewing-dispatch";

const logger = getLogger(["chezy", "slng"]);

export interface SlngDispatchResult {
  readonly callId: string;
  readonly detail: string;
}

export interface SlngTranscriptLine {
  readonly role: "agent" | "human";
  readonly text: string;
}

export interface SlngCallSnapshot {
  readonly status: string;
  readonly startedAt: string | undefined;
  readonly endedAt: string | undefined;
  readonly endReason: string | undefined;
  readonly answered: boolean;
  readonly toolNames: string[];
  readonly transcript: SlngTranscriptLine[];
}

export interface SlngAgentState {
  readonly region: string | undefined;
  readonly orchestrator: string | undefined;
  readonly livekitDeployment: string | undefined;
  readonly sipOutboundTrunkId: string | undefined;
  // Keys of template_variables; undefined when the field is absent so a
  // response shape change never breaks dispatch.
  readonly declaredVariables: string[] | undefined;
}

interface SlngAgentResponse {
  readonly region?: string | null;
  readonly orchestrator?: string | null;
  readonly livekit_deployment?: string | null;
  readonly sip_outbound_trunk_id?: string | null;
  readonly template_variables?: Record<string, unknown> | null;
}

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

function slngCredentials(): { apiKey: string; agentId: string } {
  const apiKey = env.SLNG_API_KEY;
  const agentId = env.SLNG_AGENT_ID;
  if (!apiKey || !agentId) {
    throw new Error("SLNG_API_KEY and SLNG_AGENT_ID are required");
  }
  return { apiKey, agentId };
}

async function slngFetch(
  path: string,
  init: { method: string; apiKey: string; body?: unknown },
): Promise<Response> {
  return fetch(`${SLNG_API_BASE_URL}${path}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${init.apiKey}`,
      "content-type": "application/json",
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

function toAgentState(json: SlngAgentResponse): SlngAgentState {
  return {
    region: json.region ?? undefined,
    orchestrator: json.orchestrator ?? undefined,
    livekitDeployment: json.livekit_deployment ?? undefined,
    sipOutboundTrunkId: json.sip_outbound_trunk_id ?? undefined,
    declaredVariables:
      json.template_variables == undefined ? undefined : Object.keys(json.template_variables),
  };
}

function toSlngCallSnapshot(json: unknown): SlngCallSnapshot {
  const record = asRecord(json);
  const events = Array.isArray(record?.call_events) ? record.call_events : [];
  const tools = Array.isArray(record?.tool_executions) ? record.tool_executions : [];
  const report = asRecord(record?.livekit_session_report);
  const chatHistory = asRecord(report?.chat_history);
  const items = Array.isArray(chatHistory?.items) ? chatHistory.items : [];
  const transcript: SlngTranscriptLine[] = [];
  for (const item of items) {
    const message = asRecord(item);
    if (message?.type !== "message") continue;
    const role =
      message.role === "assistant" ? "agent" : message?.role === "user" ? "human" : undefined;
    if (!role) continue;
    const content = Array.isArray(message.content)
      ? message.content.filter((part): part is string => typeof part === "string").join(" ")
      : asString(message.content);
    const text = content?.trim();
    if (text) transcript.push({ role, text });
  }

  return {
    status: asString(record?.status) ?? "",
    startedAt: asString(record?.call_started_at),
    endedAt: asString(record?.call_ended_at) ?? asString(record?.finalized_at),
    endReason: asString(record?.call_end_reason) ?? asString(record?.error_message),
    answered: events.some((event) => asRecord(event)?.event === "first_user_message"),
    toolNames: tools.flatMap((tool) => {
      const name = asString(asRecord(tool)?.tool_name);
      return name ? [name] : [];
    }),
    transcript,
  };
}

export async function getSlngCall(callId: string): Promise<SlngCallSnapshot> {
  const { apiKey, agentId } = slngCredentials();
  const response = await slngFetch(`/v1/agents/${agentId}/calls/${encodeURIComponent(callId)}`, {
    method: "GET",
    apiKey,
  });
  if (!response.ok) {
    throw new CallDispatchError(`SLNG call fetch failed: ${response.status}`, true);
  }
  return toSlngCallSnapshot(await response.json());
}

export async function ensureSlngAgentPinned(): Promise<SlngAgentState> {
  const { apiKey, agentId } = slngCredentials();
  const path = `/v1/agents/${agentId}`;

  const getResponse = await slngFetch(path, { method: "GET", apiKey });
  if (!getResponse.ok) {
    throw new CallDispatchError(`SLNG agent fetch failed: ${getResponse.status}`, true);
  }
  let state = toAgentState((await getResponse.json()) as SlngAgentResponse);

  if (state.region !== SLNG_AGENT_REGION || state.orchestrator !== SLNG_AGENT_ORCHESTRATOR) {
    const patchResponse = await slngFetch(path, {
      method: "PATCH",
      apiKey,
      body: {
        region: SLNG_AGENT_REGION,
        orchestrator: SLNG_AGENT_ORCHESTRATOR,
      },
    });
    if (!patchResponse.ok) {
      throw new CallDispatchError(`SLNG agent update failed: ${patchResponse.status}`, true);
    }
    state = toAgentState((await patchResponse.json()) as SlngAgentResponse);
  }

  return state;
}

export async function dispatchSlngCall(input: {
  readonly to: string;
  readonly variables?: Record<string, string>;
}): Promise<SlngDispatchResult> {
  const state = await ensureSlngAgentPinned().catch((error: unknown) => {
    if (error instanceof CallDispatchError) throw error;
    throw new CallDispatchError("SLNG agent preflight failed", true);
  });
  if (state.sipOutboundTrunkId === undefined) {
    throw new CallDispatchError(
      "SLNG agent has no outbound SIP trunk attached; attach a connection in the SLNG dashboard (Telephony -> Outbound) or PATCH sip_outbound_trunk_id",
      true,
    );
  }
  const { apiKey, agentId } = slngCredentials();

  // SLNG rejects call arguments the agent template does not declare.
  let args = input.variables ?? {};
  if (state.declaredVariables !== undefined) {
    const declared = new Set(state.declaredVariables);
    const dropped: string[] = [];
    const kept: Record<string, string> = {};
    for (const [key, value] of Object.entries(args)) {
      if (declared.has(key)) {
        kept[key] = value;
      } else {
        dropped.push(key);
      }
    }
    if (dropped.length > 0) {
      logger.warn("Dropping undeclared agent inputs {droppedKeys} for agent {agentId}", {
        droppedKeys: dropped.join(", "),
        agentId,
      });
    }
    args = kept;
  }

  const response = await slngFetch(`/v1/agents/${agentId}/calls`, {
    method: "POST",
    apiKey,
    body: {
      phone_number: input.to,
      arguments: args,
    },
  });

  if (!response.ok) {
    throw new CallDispatchError(
      `SLNG dispatch failed: ${response.status}`,
      [400, 401, 402, 403, 404, 422, 429].includes(response.status),
    );
  }
  const json = (await response.json()) as { call_id?: string; message?: string };
  if (!json.call_id) {
    throw new Error("SLNG dispatch response missing call_id");
  }
  return { callId: json.call_id, detail: json.message ?? "dispatched" };
}
