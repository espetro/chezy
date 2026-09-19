// Vonage Voice API. Outbound calls use a JWT signed with the application's
// private key; the JWT claim that Vonage expects is `application_id` (not
// iss/sub). Calls accept an inline NCCO, so no public answer URL is needed.
import { createSign, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import { env } from "@/lib/env";

export interface VonageCallResult {
  readonly uuid: string;
  readonly status: string;
}

function loadPrivateKey(): string {
  if (env.VONAGE_PRIVATE_KEY) {
    return env.VONAGE_PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  if (env.VONAGE_PRIVATE_KEY_PATH) {
    return readFileSync(env.VONAGE_PRIVATE_KEY_PATH, "utf8");
  }
  throw new Error("VONAGE_PRIVATE_KEY or VONAGE_PRIVATE_KEY_PATH is required");
}

export function signVonageJwt(applicationId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      application_id: applicationId,
      iat: now,
      jti: randomUUID(),
      exp: now + 3600,
    }),
  ).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

export async function placeVonageCall(input: {
  readonly to: string;
  readonly ncco: readonly Record<string, unknown>[];
}): Promise<VonageCallResult> {
  const applicationId = env.VONAGE_APPLICATION_ID;
  const from = env.VONAGE_FROM_NUMBER;
  if (!applicationId || !from) {
    throw new Error("VONAGE_APPLICATION_ID and VONAGE_FROM_NUMBER are required");
  }

  const token = signVonageJwt(applicationId, loadPrivateKey());
  const response = await fetch("https://api.nexmo.com/v1/calls", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      to: [{ type: "phone", number: input.to.replace(/^\+/, "") }],
      from: { type: "phone", number: from.replace(/^\+/, "") },
      ncco: input.ncco,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Vonage call failed: ${response.status} ${await response.text()}`,
    );
  }
  const json = (await response.json()) as { uuid?: string; status?: string };
  if (!json.uuid) {
    throw new Error("Vonage call response missing uuid");
  }
  return { uuid: json.uuid, status: json.status ?? "started" };
}
