// SLNG Voice Agents API. The agent places the outbound call; dispatch
// requires an outbound connection to be attached to the agent first
// (connection creation is dashboard-only in SLNG).
import { env } from "@/lib/env";

export interface SlngDispatchResult {
  readonly callId: string;
  readonly detail: string;
}

export async function dispatchSlngCall(input: {
  readonly to: string;
  readonly variables?: Record<string, string>;
}): Promise<SlngDispatchResult> {
  const apiKey = env.SLNG_API_KEY;
  const agentId = env.SLNG_AGENT_ID;
  if (!apiKey || !agentId) {
    throw new Error("SLNG_API_KEY and SLNG_AGENT_ID are required");
  }

  const response = await fetch(
    `https://api.agents.slng.ai/v1/agents/${agentId}/calls`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        phone_number: input.to,
        arguments: input.variables ?? {},
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `SLNG dispatch failed: ${response.status} ${await response.text()}`,
    );
  }
  const json = (await response.json()) as { call_id?: string; message?: string };
  if (!json.call_id) {
    throw new Error("SLNG dispatch response missing call_id");
  }
  return { callId: json.call_id, detail: json.message ?? "dispatched" };
}
