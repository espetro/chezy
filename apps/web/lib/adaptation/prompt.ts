import {
  FOCUS_FIELD,
  type AdaptationFocus,
  type FeedbackEvent,
  type PanelValidationError,
} from "@chezy/contract";
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
  outdoorSpace: row.outdoorSpace,
});

interface AdaptationPromptInput {
  event: FeedbackEvent;
  focus: AdaptationFocus;
  rejected: CandidateFacts | undefined;
  candidates: CandidateFacts[];
  schema: Record<string, unknown>;
  // The attempt number Devin must echo back in the spec: 1 for the first
  // output, 2 for the corrected one.
  attempt: number;
}

const constraints = ({
  event,
  focus,
  rejected,
  candidates,
  schema,
  attempt,
}: AdaptationPromptInput) => `The rejected listing:
${rejected ? JSON.stringify(rejected) : "unknown (the listing is no longer available)"}

Candidate listings (the only ids you may reference):
${candidates.map((candidate) => JSON.stringify(candidate)).join("\n")}

Required output values:
- feedbackEventId: ${event.eventId}
- profileVersion: ${event.profileVersion}
- focus: ${focus}
- attempt: ${attempt}

Hard rules:
- listingIds may only contain ids from the candidate list above (2 or 3 of them).
- rows must include a row with field "${FOCUS_FIELD[focus]}" covering what the user disliked.
- Prefer candidates that actually improve on the rejected listing for "${FOCUS_FIELD[focus]}"; a listing whose amenities do not mention a balcony or terrace is unknown, not a balcony.
- rows carry field, label and optional note only; never per-listing display values, the app resolves those itself.
- Plain text only: no links, markup or scripts in title, labels or notes.
- Do not browse, clone repositories, install anything, or use the network.
- Answer only via the structured output; no messages, no files.

Structured output schema:
${JSON.stringify(schema)}`;

export const buildAdaptationPrompt = (input: AdaptationPromptInput): string =>
  `You are building one comparison panel for a rental feed. The user rejected a listing; compare 2 or 3 of the candidate listings below around what the user disliked, so the feed can show better alternatives.

${constraints(input)}`;

interface CorrectionPromptInput extends Omit<AdaptationPromptInput, "rejected"> {
  // Undefined only if the rejected listing has since left the dataset.
  rejected: CandidateFacts | undefined;
  errors: PanelValidationError[];
}

// Sent to the same session after the validator refused the previous output.
// Restates every original constraint so the correction is self-contained.
export const buildCorrectionPrompt = ({ errors, ...input }: CorrectionPromptInput) =>
  `Your previous structured output was rejected by an automated validator. This is attempt ${input.attempt} of 2; a second rejection fails the task.

Validation errors (code, path, message):
${JSON.stringify(errors)}

Fix every error and publish a new structured output with attempt: ${input.attempt}. Keep what was valid. The original constraints still apply:

${constraints(input)}`;
