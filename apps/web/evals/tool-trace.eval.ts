// Tool-call trace eval for demo happy path A (.agents/docs/demo-flow.md).
// Replays the four user turns against a running dev server and the configured
// model, records every tool call, and asserts the sequence the demo depends on.
// LLM-backed, so it is run by hand before the demo, not in `validate`:
//
//   mise run eval:trace                              # against http://localhost:4656
//   mise run eval:trace -- http://localhost:3000     # another dev server
//
// Exit code 0 = all assertions hold. The full transcript (tool calls with inputs
// and outputs, assistant text) is written to /tmp/chezy-eval/tool-trace-<ts>.json
// either way, so a failure can be read without re-running.
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import { jessieOnboardingLine } from "./fixtures/jessie";

const BASE_URL = process.argv[2] ?? "http://localhost:4656";
const OUT_DIR = "/tmp/chezy-eval";

interface ToolCall {
  turn: number;
  toolName: string;
  input: unknown;
  output?: unknown;
}

interface TurnRecord {
  turn: number;
  user: string;
  assistantText: string;
  toolCalls: ToolCall[];
  status: number;
  durationMs: number;
}

interface Check {
  name: string;
  pass: boolean;
  detail?: string;
}

// Minimal cookie jar: the guest sign-in sets the NextAuth session cookie across
// a redirect chain, and the chat route rejects requests without it.
class Jar {
  private cookies = new Map<string, string>();
  absorb(response: Response) {
    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const eq = pair?.indexOf("=") ?? -1;
      if (pair && eq > 0) {
        this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }
  }
  header(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function signInGuest(jar: Jar): Promise<void> {
  let url = `${BASE_URL}/api/auth/guest?redirectUrl=/chat`;
  for (let hop = 0; hop < 6; hop++) {
    const response = await fetch(url, {
      redirect: "manual",
      headers: { cookie: jar.header() },
    });
    jar.absorb(response);
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, BASE_URL).toString();
      continue;
    }
    return;
  }
  throw new Error("guest sign-in redirect chain did not settle");
}

async function sendTurn(jar: Jar, chatId: string, turn: number, text: string): Promise<TurnRecord> {
  const started = Date.now();
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: jar.header() },
    body: JSON.stringify({
      id: chatId,
      message: { id: randomUUID(), role: "user", parts: [{ type: "text", text }] },
      selectedChatModel: "",
      selectedVisibilityType: "private",
    }),
  });
  jar.absorb(response);

  const record: TurnRecord = {
    turn,
    user: text,
    assistantText: "",
    toolCalls: [],
    status: response.status,
    durationMs: 0,
  };
  if (!response.ok || !response.body) {
    record.assistantText = await response.text().catch(() => "");
    record.durationMs = Date.now() - started;
    return record;
  }

  const byCallId = new Map<string, ToolCall>();
  const decoder = new TextDecoder();
  let buffer = "";
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let nl = buffer.indexOf("\n");
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf("\n");
      if (!line.startsWith("data:")) {
        continue;
      }
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") {
        continue;
      }
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }
      const type = String(event.type ?? "");
      if (type === "text-delta") {
        record.assistantText += String(event.delta ?? "");
      } else if (type === "tool-input-available") {
        const call: ToolCall = {
          turn,
          toolName: String(event.toolName),
          input: event.input,
        };
        byCallId.set(String(event.toolCallId), call);
        record.toolCalls.push(call);
      } else if (type === "tool-output-available") {
        const call = byCallId.get(String(event.toolCallId));
        if (call) {
          call.output = event.output;
        }
      }
    }
  }
  record.durationMs = Date.now() - started;
  return record;
}

function lowestScoredListingId(turns: TurnRecord[]): string | undefined {
  let best: { id: string; score: number } | undefined;
  for (const t of turns) {
    for (const call of t.toolCalls) {
      if (call.toolName !== "searchListings") {
        continue;
      }
      const out = call.output as
        | { listings?: Array<{ id?: string; score?: number }> }
        | undefined;
      for (const l of out?.listings ?? []) {
        if (l.id && typeof l.score === "number" && (!best || l.score < best.score)) {
          best = { id: l.id, score: l.score };
        }
      }
    }
  }
  return best?.id;
}

function topMatchesOf(turns: TurnRecord[]): string[] {
  const ids: string[] = [];
  for (const t of turns) {
    for (const call of t.toolCalls) {
      if (call.toolName === "searchListings") {
        const out = call.output as { topMatches?: string[] } | undefined;
        ids.push(...(out?.topMatches ?? []));
      }
    }
  }
  return ids;
}

function toolNames(turns: TurnRecord[], turn?: number): string[] {
  return turns
    .filter((t) => turn === undefined || t.turn === turn)
    .flatMap((t) => t.toolCalls.map((c) => c.toolName));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const jar = new Jar();
  await signInGuest(jar);

  const chatId = randomUUID();
  const username = `jessie-eval-${Date.now().toString(36)}`;
  const turns: TurnRecord[] = [];

  turns.push(await sendTurn(jar, chatId, 1, `Hi, I'm ${username}`));

  turns.push(await sendTurn(jar, chatId, 2, jessieOnboardingLine));

  // Reject the lowest-scored card so the top matches survive into beat 3.
  const rejectId = lowestScoredListingId(turns) ?? "<no listing id from searchListings>";
  turns.push(await sendTurn(jar, chatId, 3, `Rejected listing ${rejectId}: too far from work`));

  turns.push(await sendTurn(jar, chatId, 4, "Yes, book a visit for the top one"));

  const all = toolNames(turns);
  const t1 = toolNames(turns, 1);
  const t2 = toolNames(turns, 2);
  const t3 = toolNames(turns, 3);
  const t4 = toolNames(turns, 4);
  const beforeAsk = [...t1, ...t2, ...t3];

  const checks: Check[] = [
    {
      name: "all turns returned 200",
      pass: turns.every((t) => t.status === 200),
      detail: turns.map((t) => `t${t.turn}=${t.status}`).join(" "),
    },
    {
      name: "turn 1 identifies the user",
      pass: t1.includes("identifyUser"),
      detail: t1.join(" > "),
    },
    {
      name: "turn 2 saves the profile before searching",
      pass:
        t2.includes("saveUserProfile") &&
        t2.includes("searchListings") &&
        t2.indexOf("saveUserProfile") < t2.indexOf("searchListings"),
      detail: t2.join(" > "),
    },
    {
      name: "turn 2 searches without being asked (autonomous search)",
      pass: t2.includes("searchListings"),
      detail: t2.join(" > "),
    },
    {
      name: "searchListings results carry scores",
      pass: turns.some((t) =>
        t.toolCalls.some((c) => {
          if (c.toolName !== "searchListings") {
            return false;
          }
          const out = c.output as { listings?: Array<{ score?: unknown }> } | undefined;
          return (out?.listings ?? []).some((l) => typeof l.score === "number");
        }),
      ),
    },
    {
      name: "turn 3 records the rejection",
      pass: t3.includes("recordListingFeedback"),
      detail: t3.join(" > "),
    },
    {
      name: "a second search follows the rejection (turn 3 or 4)",
      pass: t3.includes("searchListings") || t4.includes("searchListings"),
      detail: `t3=${t3.join(">")} t4=${t4.join(">")}`,
    },
    {
      name: "arrangeViewing is never called before the user is asked / asks",
      pass: !beforeAsk.includes("arrangeViewing"),
      detail: beforeAsk.join(" > "),
    },
    {
      name: "at least one listing clears the auto-call bar on real data",
      pass: topMatchesOf(turns).length > 0,
    },
    {
      name: "turn 4 arranges the viewing",
      pass: t4.includes("arrangeViewing"),
      detail: t4.join(" > "),
    },
    {
      name: "searchListings is not called twice in one turn",
      pass: [t1, t2, t3, t4].every(
        (names) => names.filter((n) => n === "searchListings").length <= 1,
      ),
    },
    {
      name: "getWeather / document tools never fire",
      pass: !all.some((n) =>
        ["getWeather", "createDocument", "editDocument", "updateDocument"].includes(n),
      ),
      detail: all.join(" > "),
    },
  ];

  const report = {
    baseUrl: BASE_URL,
    chatId,
    username,
    topMatches: topMatchesOf(turns),
    checks,
    turns,
  };
  const outPath = `${OUT_DIR}/tool-trace-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(outPath, JSON.stringify(report, undefined, 2));

  for (const c of checks) {
    console.log(`${c.pass ? "PASS" : "FAIL"}  ${c.name}${c.detail ? `  [${c.detail}]` : ""}`);
  }
  console.log(`\ntool sequence: ${all.join(" > ") || "(none)"}`);
  console.log(`topMatches: ${report.topMatches.join(", ") || "(none)"}`);
  console.log(`report: ${outPath}`);

  const failed = checks.filter((c) => !c.pass).length;
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
