// SLNG Voice Agents API. The agent places the outbound call; dispatch
// requires an outbound connection to be attached to the agent first
// (connection creation is dashboard-only in SLNG).
import { getLogger } from "@chezy/observability";

import {
  SLNG_AGENT_ORCHESTRATOR,
  SLNG_AGENT_REGION,
  SLNG_API_BASE_URL,
} from "@/lib/constants";
import { env } from "@/lib/env";

const logger = getLogger(["chezy", "slng"]);

export interface SlngDispatchResult {
  readonly callId: string;
  readonly detail: string;
}

export interface SlngAgentState {
  readonly region: string | null;
  readonly orchestrator: string | null;
  readonly livekitDeployment: string | null;
  readonly sipOutboundTrunkId: string | null;
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
  });
}

function toAgentState(json: SlngAgentResponse): SlngAgentState {
  return {
    region: json.region ?? null,
    orchestrator: json.orchestrator ?? null,
    livekitDeployment: json.livekit_deployment ?? null,
    sipOutboundTrunkId: json.sip_outbound_trunk_id ?? null,
    declaredVariables:
      json.template_variables == null
        ? undefined
        : Object.keys(json.template_variables),
  };
}

export async function ensureSlngAgentPinned(): Promise<SlngAgentState> {
  const { apiKey, agentId } = slngCredentials();
  const path = `/v1/agents/${agentId}`;

  const getResponse = await slngFetch(path, { method: "GET", apiKey });
  if (!getResponse.ok) {
    throw new Error(`SLNG agent fetch failed: ${getResponse.status} ${await getResponse.text()}`);
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
      throw new Error(
        `SLNG agent update failed: ${patchResponse.status} ${await patchResponse.text()}`,
      );
    }
    state = toAgentState((await patchResponse.json()) as SlngAgentResponse);
  }

  return state;
}

export async function dispatchSlngCall(input: {
  readonly to: string;
  readonly variables?: Record<string, string>;
}): Promise<SlngDispatchResult> {
  const state = await ensureSlngAgentPinned();
  if (state.sipOutboundTrunkId === null) {
    throw new Error(
      "SLNG agent has no outbound SIP trunk attached; attach a connection in the SLNG dashboard (Telephony -> Outbound) or PATCH sip_outbound_trunk_id",
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
      logger.warn(
        "Dropping undeclared agent inputs {droppedKeys} for agent {agentId}",
        { droppedKeys: dropped.join(", "), agentId },
      );
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
    throw new Error(`SLNG dispatch failed: ${response.status} ${await response.text()}`);
  }
  const json = (await response.json()) as { call_id?: string; message?: string };
  if (!json.call_id) {
    throw new Error("SLNG dispatch response missing call_id");
  }
  return { callId: json.call_id, detail: json.message ?? "dispatched" };
}
