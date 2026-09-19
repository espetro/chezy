// Calendar booking. The SLNG `book_viewing` tool calls /api/calendar, which
// delegates here. `mock` returns a deterministic slot so the demo never
// blocks; `google` writes a real event via a service-account JWT.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

import { FETCH_TIMEOUT_MS } from "~/lib/constants";
import { env } from "~/lib/env";

export interface BookingInput {
  readonly propertyRef: string;
  readonly slotIso: string;
  readonly durationMinutes: number;
  readonly summary: string;
  readonly description: string;
}

export interface CalendarEventResult {
  readonly status: "booked" | "failed";
  readonly channel: "mock" | "google";
  readonly slotIso: string;
  readonly eventId?: string;
  readonly detail?: string;
}

interface ServiceAccount {
  readonly client_email: string;
  readonly private_key: string;
  readonly token_uri: string;
}

export function nextSlotIso(hint?: string): string {
  if (hint) {
    const parsed = new Date(hint);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

export function mockBooking(slotIso: string): CalendarEventResult {
  return {
    status: "booked",
    channel: "mock",
    slotIso,
    detail: "mock booking (CALENDAR_MODE=mock)",
  };
}

async function googleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/calendar.events",
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${signer.sign(sa.private_key).toString("base64url")}`;

  const response = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status}`);
  }
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("Google token exchange returned no access_token");
  }
  return json.access_token;
}

export async function createGoogleEvent(input: BookingInput): Promise<CalendarEventResult> {
  const serviceAccountPath = env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH;
  const calendarId = env.GOOGLE_CALENDAR_ID;
  if (!serviceAccountPath || !calendarId) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON_PATH and GOOGLE_CALENDAR_ID are required");
  }

  const sa = JSON.parse(readFileSync(serviceAccountPath, "utf8")) as ServiceAccount;
  const token = await googleAccessToken(sa);
  const endIso = new Date(
    new Date(input.slotIso).getTime() + input.durationMinutes * 60_000,
  ).toISOString();

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.slotIso },
        end: { dateTime: endIso },
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`Google event insert failed: ${response.status}`);
  }
  const json = (await response.json()) as { id?: string };
  if (!json.id) {
    throw new Error("Google event insert returned no id");
  }
  return {
    status: "booked",
    channel: "google",
    slotIso: input.slotIso,
    eventId: json.id,
  };
}
