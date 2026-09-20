import { FOCUS_FIELD, type FeedbackEvent } from "@chezy/contract";
import type { CandidateFacts } from "~/lib/adaptation/types";
import type { Listing } from "~/lib/db/schema";

// The only listing fields the provider ever sees; URLs, publisher names and
// descriptions stay server-side.
export const sanitizeCandidate = (row: Listing): CandidateFacts => ({
  id: row.id,
  title: row.title,
  priceEur: row.priceEur,
  neighbourhood: row.neighbourhood,
  rooms: row.rooms,
  builtM2: row.builtM2,
  amenities: row.amenities,
});

interface AdaptationPromptInput {
  event: FeedbackEvent;
  rejected: CandidateFacts;
  candidates: CandidateFacts[];
  schema: Record<string, unknown>;
  // The attempt number Devin must echo back in the spec (always 1 while
  // correction retries are JES-13 scope).
  attempt: number;
}

export const buildAdaptationPrompt = ({
  event,
  rejected,
  candidates,
  schema,
  attempt,
}: AdaptationPromptInput): string =>
  `You are building one comparison panel for a rental feed. The user rejected a listing; compare 2 or 3 of the candidate listings below around what the user disliked, so the feed can show better alternatives.

The rejected listing:
${JSON.stringify(rejected)}

Candidate listings (the only ids you may reference):
${candidates.map((candidate) => JSON.stringify(candidate)).join("\n")}

Required output values:
- feedbackEventId: ${event.eventId}
- profileVersion: ${event.profileVersion}
- focus: ${event.reason}
- attempt: ${attempt}

Hard rules:
- listingIds may only contain ids from the candidate list above (2 or 3 of them).
- rows must include a row with field "${FOCUS_FIELD[event.reason]}" covering what the user disliked.
- rows carry field, label and optional note only; never per-listing display values, the app resolves those itself.
- Do not browse, clone repositories, install anything, or use the network.
- Answer only via the structured output; no messages, no files.

Structured output schema:
${JSON.stringify(schema)}`;
