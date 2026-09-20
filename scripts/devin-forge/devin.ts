/**
 * Thin Devin REST client. A `cog_` PAT talks to v3 (organisation sessions);
 * an `apk_` personal or service key talks to v1 (`/v1/sessions`), whose
 * responses are mapped onto the same v3-shaped `DevinSession`. All responses
 * are valibot-parsed loose objects so new fields never break us.
 */
import * as v from "valibot";

const sessionSchema = v.looseObject({
  session_id: v.string(),
  url: v.string(),
  status: v.picklist(["new", "claimed", "running", "exit", "error", "suspended", "resuming"]),
  status_detail: v.optional(v.nullable(v.string())),
  structured_output: v.optional(v.nullable(v.record(v.string(), v.unknown()))),
  pull_requests: v.optional(
    v.array(v.looseObject({ pr_url: v.string(), pr_state: v.optional(v.string()) })),
  ),
  acus_consumed: v.optional(v.number()),
});

const sessionListSchema = v.looseObject({
  items: v.optional(v.array(sessionSchema)),
});

export type DevinSession = v.InferOutput<typeof sessionSchema>;

export interface DevinClientOptions {
  pat: string;
  // Only used by the v3 transport; empty for v1 keys.
  orgId: string;
}

export const isV1Key = (pat: string): boolean => pat.startsWith("apk_");

function baseUrl(opts: DevinClientOptions): string {
  return isV1Key(opts.pat)
    ? "https://api.devin.ai/v1"
    : `https://api.devin.ai/v3/organizations/${opts.orgId}`;
}

// v1 session shape (GET /v1/sessions/{id}); the create response only carries
// session_id and url.
const v1SessionSchema = v.looseObject({
  session_id: v.string(),
  url: v.optional(v.string()),
  status: v.optional(v.string()),
  status_enum: v.optional(v.nullable(v.string())),
  structured_output: v.optional(v.nullable(v.record(v.string(), v.unknown()))),
  pull_request: v.optional(v.nullable(v.looseObject({ url: v.string() }))),
});

const webId = (sessionId: string) =>
  sessionId.startsWith("devin-") ? sessionId.slice("devin-".length) : sessionId;

// Maps v1 status_enum onto the v3 status/status_detail pairs forge.ts reads:
// blocked = waiting_for_user, finished = finished, expired = exit.
function fromV1(data: v.InferOutput<typeof v1SessionSchema>): DevinSession {
  const phase = data.status_enum ?? "working";
  const detail =
    phase === "blocked"
      ? "waiting_for_user"
      : phase === "finished"
        ? "finished"
        : phase.startsWith("suspend")
          ? "suspended"
          : phase === "expired"
            ? "expired"
            : "working";
  const status =
    phase === "expired" ? "exit" : phase.startsWith("suspend") ? "suspended" : "running";
  return {
    session_id: data.session_id,
    url: data.url ?? `https://app.devin.ai/sessions/${webId(data.session_id)}`,
    status,
    status_detail: detail,
    structured_output: data.structured_output ?? undefined,
    pull_requests: data.pull_request ? [{ pr_url: data.pull_request.url, pr_state: "open" }] : [],
  };
}

async function request(
  opts: DevinClientOptions,
  path: string,
  init: RequestInit,
): Promise<unknown> {
  const doFetch = () =>
    fetch(`${baseUrl(opts)}${path}`, {
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
  if (isV1Key(opts.pat)) {
    // v1 has no structured_output_required; the schema alone is accepted.
    const { structured_output_required: _required, ...v1Body } = body;
    const data = v.parse(
      v1SessionSchema,
      await request(opts, "/sessions", { method: "POST", body: JSON.stringify(v1Body) }),
    );
    return fromV1({ ...data, status_enum: "working" });
  }
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
  if (isV1Key(opts.pat)) {
    const id = sessionId.startsWith("devin-") ? sessionId : `devin-${sessionId}`;
    const data = await request(opts, `/sessions/${id}`, { method: "GET" });
    return fromV1(v.parse(v1SessionSchema, data));
  }
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
  if (isV1Key(opts.pat)) {
    await request(opts, `/sessions/${id}/message`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    return;
  }
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
  if (isV1Key(opts.pat)) {
    const data = v.parse(
      v.looseObject({ sessions: v.optional(v.array(v1SessionSchema)) }),
      await request(opts, "/sessions?limit=20", { method: "GET" }),
    );
    return (data.sessions ?? []).map(fromV1);
  }
  const data = await request(opts, "/sessions", { method: "GET" });
  return v.parse(sessionListSchema, data).items ?? [];
}
