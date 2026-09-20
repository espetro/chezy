/**
 * Thin Devin v3 REST client. Auth via PAT; all responses valibot-parsed
 * loose objects so new fields never break us.
 */
import * as v from "valibot";

const sessionSchema = v.looseObject({
  session_id: v.string(),
  url: v.string(),
  status: v.picklist(["new", "claimed", "running", "exit", "error", "suspended", "resuming"]),
  status_detail: v.optional(v.nullable(v.string())),
  structured_output: v.optional(v.nullable(v.record(v.string(), v.unknown()))),
  pull_requests: v.optional(v.array(v.looseObject({ pr_url: v.string() }))),
  acus_consumed: v.optional(v.number()),
});

const sessionListSchema = v.looseObject({
  items: v.optional(v.array(sessionSchema)),
});

export type DevinSession = v.InferOutput<typeof sessionSchema>;

export interface DevinClientOptions {
  pat: string;
  orgId: string;
}

function baseUrl(orgId: string): string {
  return `https://api.devin.ai/v3/organizations/${orgId}`;
}

async function request(
  opts: DevinClientOptions,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  const doFetch = () =>
    fetch(`${baseUrl(opts.orgId)}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${opts.pat}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  let res = await doFetch();
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 30_000));
    res = await doFetch();
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Devin API ${init.method ?? "GET"} ${path} -> ${res.status}: ${body}`);
  }
  return res.json();
}

export async function createSession(
  opts: DevinClientOptions,
  body: Record<string, unknown>,
): Promise<DevinSession> {
  const data = await request(opts, "/sessions", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return v.parse(sessionSchema, data);
}

export async function getSession(
  opts: DevinClientOptions,
  sessionId: string,
): Promise<DevinSession> {
  try {
    const data = await request(opts, `/sessions/${sessionId}`, { method: "GET" });
    return v.parse(sessionSchema, data);
  } catch (err) {
    const id = sessionId.startsWith("devin-") ? sessionId.slice(6) : `devin-${sessionId}`;
    if (err instanceof Error && err.message.includes("-> 404")) {
      const data = await request(opts, `/sessions/${id}`, { method: "GET" });
      return v.parse(sessionSchema, data);
    }
    throw err;
  }
}

export async function sendMessage(
  opts: DevinClientOptions,
  sessionId: string,
  message: string,
): Promise<void> {
  const id = sessionId.startsWith("devin-") ? sessionId : `devin-${sessionId}`;
  try {
    await request(opts, `/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes("-> 404")) {
      await request(opts, `/sessions/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      return;
    }
    throw err;
  }
}

export async function listSessions(opts: DevinClientOptions): Promise<DevinSession[]> {
  const data = await request(opts, "/sessions", { method: "GET" });
  return v.parse(sessionListSchema, data).items ?? [];
}
