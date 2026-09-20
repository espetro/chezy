import {
  FOCUS_FIELD,
  type AdaptationFocus,
  type ComparisonField,
  type ComparisonPanelSpec,
  type FeedbackEvent,
} from "@chezy/contract";
import * as v from "valibot";
import { hasOutdoorSpace } from "~/lib/adaptation/facts";
import type { CandidateFacts } from "~/lib/adaptation/types";
import { ADAPTATION_MAX_ACU, DEVIN_REQUEST_TIMEOUT_MS } from "~/lib/constants";

export type DevinClientErrorCode =
  | "out_of_quota"
  | "unauthorized"
  | "http"
  | "network"
  | "invalid_json";

// `detail` is the API's own error text (never the key, never our request
// body); it is for server logs, not for the browser.
export class DevinClientError extends Error {
  constructor(
    message: string,
    readonly code: DevinClientErrorCode,
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(message);
  }
}

const QUOTA_PATTERN = /out_of_quota|out_of_credits|billing/i;

const classify = (status: number, detail: string | undefined): DevinClientErrorCode => {
  if (status === 401 || status === 403) {
    return detail && QUOTA_PATTERN.test(detail) ? "out_of_quota" : "unauthorized";
  }
  return "http";
};

const readDetail = async (response: Response): Promise<string | undefined> => {
  try {
    const text = (await response.text()).slice(0, 500);
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object" && "detail" in parsed) {
        const { detail } = parsed as { detail: unknown };
        if (typeof detail === "string") return detail;
      }
    } catch {
      // Plain-text body; fall through to the raw text.
    }
    return text || undefined;
  } catch {
    return undefined;
  }
};

// Provider-neutral phase so the machine never sees raw Devin status strings.
export type DevinPhase = "working" | "finished" | "blocked" | "ended";

export interface DevinSessionSnapshot {
  sessionId: string;
  url?: string;
  phase: DevinPhase;
  structuredOutput?: unknown;
}

export interface DevinClient {
  createSession(input: {
    title: string;
    prompt: string;
    schema: Record<string, unknown>;
    tags?: string[];
  }): Promise<DevinSessionSnapshot>;
  getSession(sessionId: string): Promise<DevinSessionSnapshot>;
  sendMessage(sessionId: string, message: string): Promise<void>;
}

const CreateSessionSchema = v.looseObject({
  session_id: v.string(),
  url: v.optional(v.string()),
});

const GetSessionSchema = v.looseObject({
  session_id: v.optional(v.string()),
  url: v.optional(v.string()),
  status_enum: v.optional(v.nullable(v.string())),
  structured_output: v.optional(v.nullable(v.unknown())),
});

const toPhase = (statusEnum: string | null | undefined): DevinPhase => {
  if (statusEnum === "finished") return "finished";
  if (statusEnum === "blocked") return "blocked";
  if (statusEnum === "expired") return "ended";
  return "working";
};

// The API accepts bare or `devin-`-prefixed ids; request paths always send
// the prefixed form while the app.devin.ai URL drops it.
const apiId = (sessionId: string) =>
  sessionId.startsWith("devin-") ? sessionId : `devin-${sessionId}`;
const webId = (sessionId: string) =>
  sessionId.startsWith("devin-") ? sessionId.slice("devin-".length) : sessionId;
const fallbackSessionUrl = (sessionId: string) =>
  `https://app.devin.ai/sessions/${webId(sessionId)}`;

export const createDevinClient = (
  config: { apiKey: string; baseUrl: string },
  fetchImpl: typeof fetch = fetch,
): DevinClient => {
  const call = async (path: string, init: RequestInit): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetchImpl(`${config.baseUrl}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        signal: AbortSignal.timeout(DEVIN_REQUEST_TIMEOUT_MS),
      });
    } catch {
      // Network failure or timeout; the error never carries the key or body.
      throw new DevinClientError("Devin API request failed", "network");
    }
    if (!response.ok) {
      const detail = await readDetail(response);
      throw new DevinClientError(
        `Devin API responded ${response.status}`,
        classify(response.status, detail),
        response.status,
        detail,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new DevinClientError("Devin API returned invalid JSON", "invalid_json");
    }
  };

  return {
    createSession: async ({ title, prompt, schema, tags }) => {
      const data = v.parse(
        CreateSessionSchema,
        await call("/v1/sessions", {
          method: "POST",
          body: JSON.stringify({
            prompt,
            structured_output_schema: schema,
            max_acu_limit: ADAPTATION_MAX_ACU,
            title,
            tags,
            // Listed on purpose: the sessions are the sponsor proof and must
            // show up in the organisation's session list, not only by link.
            unlisted: false,
          }),
        }),
      );
      return {
        sessionId: data.session_id,
        url: data.url ?? fallbackSessionUrl(data.session_id),
        phase: "working",
      };
    },
    getSession: async (sessionId) => {
      const data = v.parse(
        GetSessionSchema,
        await call(`/v1/sessions/${apiId(sessionId)}`, { method: "GET" }),
      );
      const id = data.session_id ?? sessionId;
      return {
        sessionId: id,
        url: data.url ?? fallbackSessionUrl(id),
        phase: toPhase(data.status_enum),
        structuredOutput: data.structured_output ?? undefined,
      };
    },
    sendMessage: async (sessionId, message) => {
      await call(`/v1/sessions/${apiId(sessionId)}/message`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
    },
  };
};

interface MockContext {
  candidates: CandidateFacts[];
  event: FeedbackEvent;
  focus: AdaptationFocus;
}

// Test-only fixtures: which simulated candidates the validator must refuse.
export type MockScenario = "valid" | "invalid_first" | "invalid_twice";

const FIELD_LABELS: Record<ComparisonField, string> = {
  price: "Price",
  area: "Area",
  balcony: "Balcony",
  rooms: "Rooms",
  size: "Size",
};

const MOCK_TITLES: Record<AdaptationFocus, string> = {
  too_expensive: "Cheaper matching homes",
  wrong_area: "Homes in other areas",
  missing_balcony: "Homes with outdoor space",
};

interface MockSession {
  polls: number;
  attempt: number;
  context: MockContext;
  scenario: MockScenario;
}

// Session state is process-global so polls across HTTP requests share the
// deterministic lifecycle; the context captured at createSession is reused.
const mockSessions = new Map<string, MockSession>();
let mockSequence = 0;

const mockSpec = (
  { candidates, event, focus }: MockContext,
  attempt: number,
): ComparisonPanelSpec => {
  const ordered =
    focus === "missing_balcony"
      ? [...candidates].sort((a, b) => Number(hasOutdoorSpace(b)) - Number(hasOutdoorSpace(a)))
      : candidates;
  const fields = [...new Set<ComparisonField>([FOCUS_FIELD[focus], "price", "area"])];
  return {
    schemaVersion: 1,
    feedbackEventId: event.eventId,
    profileVersion: event.profileVersion,
    focus,
    attempt,
    title: MOCK_TITLES[focus],
    listingIds: ordered.slice(0, 3).map((candidate) => candidate.id),
    rows: fields.map((field) => ({ field, label: FIELD_LABELS[field] })),
    actions: ["open_listing", "edit_preferences"],
  };
};

// A labelled test fixture, not a corrupted real answer: one id outside the
// candidate set and no row for the focus field.
const invalidMockSpec = (context: MockContext, attempt: number): ComparisonPanelSpec => {
  const spec = mockSpec(context, attempt);
  return {
    ...spec,
    listingIds: [...spec.listingIds.slice(0, 1), "mock-unknown-listing"],
    rows: [{ field: "rooms", label: "Rooms" }],
  };
};

const isInvalidAttempt = (scenario: MockScenario, attempt: number) =>
  (scenario === "invalid_first" && attempt === 1) || scenario === "invalid_twice";

export const createMockDevinClient = (
  context: MockContext,
  scenario: MockScenario = "valid",
): DevinClient => ({
  createSession: async () => {
    mockSequence += 1;
    const sessionId = `mock-session-${mockSequence}`;
    mockSessions.set(sessionId, { polls: 0, attempt: 1, context, scenario });
    // The mock never claims a Devin URL; the UI labels it "Simulated".
    return { sessionId, phase: "working" };
  },
  getSession: async (sessionId) => {
    const session = mockSessions.get(sessionId);
    if (!session) throw new DevinClientError("Unknown mock session", "http");
    session.polls += 1;
    if (session.polls < 2) return { sessionId, phase: "working" };
    // Like a real session, the previous output stays published until the
    // correction lands; an invalid answer leaves the session blocked on us.
    if (isInvalidAttempt(session.scenario, session.attempt)) {
      return {
        sessionId,
        phase: "blocked",
        structuredOutput: invalidMockSpec(session.context, session.attempt),
      };
    }
    return {
      sessionId,
      phase: "finished",
      structuredOutput: mockSpec(session.context, session.attempt),
    };
  },
  sendMessage: async (sessionId) => {
    const session = mockSessions.get(sessionId);
    if (!session) throw new DevinClientError("Unknown mock session", "http");
    session.attempt += 1;
    session.polls = 0;
  },
});
