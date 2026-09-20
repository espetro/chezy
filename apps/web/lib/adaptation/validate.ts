import {
  ComparisonPanelSpecSchema,
  FOCUS_FIELD,
  type AdaptationFocus,
  type ComparisonPanelSpec,
  type PanelValidationError,
} from "@chezy/contract";
import * as v from "valibot";
import { hasOutdoorSpace } from "~/lib/adaptation/facts";
import type { CandidateFacts } from "~/lib/adaptation/types";

export interface ValidationContext {
  feedbackEventId: string;
  profileVersion: string;
  focus: AdaptationFocus;
  sourceListingIds: readonly string[];
  expectedAttempt: number;
  // The listing the user rejected in the triggering event.
  rejectedListingId: string;
  // Every listing with active feedback, including the triggering one.
  rejectedListingIds: readonly string[];
  // Allowlisted candidates that violate a profile red line.
  redLineListingIds: readonly string[];
  // Trusted facts for the candidates and the rejected listing, by id.
  facts: Readonly<Record<string, CandidateFacts>>;
}

export type ValidationResult =
  | { ok: true; spec: ComparisonPanelSpec }
  | { ok: false; errors: PanelValidationError[] };

const error = (
  code: PanelValidationError["code"],
  path: string,
  message: string,
): PanelValidationError => ({ code, path, message });

// Links, markup, script URLs and inline handlers; the spec is plain text only.
const UNSAFE_TEXT = /https?:\/\/|www\.|<\/?[a-z!]|javascript:|data:|\bon\w+\s*=/i;

// Whether `candidate` is better than `rejected` on the focus. Unknown facts
// (null price, no amenities text) never count as an improvement.
const improves = (
  focus: AdaptationFocus,
  candidate: CandidateFacts,
  rejected: CandidateFacts | undefined,
): boolean => {
  switch (focus) {
    case "too_expensive":
      return (
        candidate.priceEur !== null &&
        rejected?.priceEur !== null &&
        rejected?.priceEur !== undefined &&
        candidate.priceEur < rejected.priceEur
      );
    case "missing_balcony":
      return hasOutdoorSpace(candidate);
    case "wrong_area":
      return (
        candidate.neighbourhood !== null &&
        rejected?.neighbourhood !== undefined &&
        candidate.neighbourhood !== rejected.neighbourhood
      );
  }
};

// Deterministic gate between the provider output and the accepted spec.
// Collects every violation as a coded PanelValidationError so the correction
// message can feed them back to the session.
export const validateComparisonPanel = (
  candidate: unknown,
  ctx: ValidationContext,
): ValidationResult => {
  const parsed = v.safeParse(ComparisonPanelSpecSchema, candidate);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.issues.map((issue) =>
        error("schema", v.getDotPath(issue) ?? "", `Invalid panel spec: ${issue.message}`),
      ),
    };
  }
  const spec = parsed.output;
  const errors: PanelValidationError[] = [];
  if (spec.attempt !== ctx.expectedAttempt) {
    errors.push(error("wrong_attempt", "attempt", `attempt must be ${ctx.expectedAttempt}`));
  }
  if (spec.feedbackEventId !== ctx.feedbackEventId) {
    errors.push(
      error(
        "wrong_event",
        "feedbackEventId",
        "feedbackEventId does not match the triggering event",
      ),
    );
  }
  if (spec.profileVersion !== ctx.profileVersion) {
    errors.push(
      error("stale_profile", "profileVersion", "profileVersion does not match the current profile"),
    );
  }
  if (spec.focus !== ctx.focus) {
    errors.push(error("wrong_focus", "focus", `focus must be ${ctx.focus}`));
  }
  const allowed = new Set(ctx.sourceListingIds);
  const rejected = new Set(ctx.rejectedListingIds);
  const redLine = new Set(ctx.redLineListingIds);
  spec.listingIds.forEach((id, index) => {
    const path = `listingIds.${index}`;
    if (!allowed.has(id)) {
      errors.push(error("unknown_listing", path, `${id} is not in the candidate set`));
    }
    if (rejected.has(id)) {
      errors.push(error("rejected_listing", path, `${id} was rejected by the user`));
    }
    if (redLine.has(id)) {
      errors.push(error("red_line_violation", path, `${id} violates a profile red line`));
    }
  });
  const focusField = FOCUS_FIELD[ctx.focus];
  if (!spec.rows.some((row) => row.field === focusField)) {
    errors.push(error("missing_required_row", "rows", `rows must include the ${focusField} field`));
  }
  const texts: [string, string | undefined][] = [
    ["title", spec.title],
    ...spec.rows.flatMap((row, index): [string, string | undefined][] => [
      [`rows.${index}.label`, row.label],
      [`rows.${index}.note`, row.note],
    ]),
  ];
  for (const [path, text] of texts) {
    if (text !== undefined && UNSAFE_TEXT.test(text)) {
      errors.push(error("unsafe_text", path, "links, markup and scripts are not allowed"));
    }
  }
  // Usefulness: at least one compared listing must beat the rejected one on
  // the focus, but only when some eligible candidate could.
  const rejectedFacts = ctx.facts[ctx.rejectedListingId];
  const improvesOn = (id: string) => {
    const facts = ctx.facts[id];
    return facts !== undefined && improves(ctx.focus, facts, rejectedFacts);
  };
  const possible = ctx.sourceListingIds.some(
    (id) => !rejected.has(id) && !redLine.has(id) && improvesOn(id),
  );
  const chosen = spec.listingIds.some(improvesOn);
  if (possible && !chosen) {
    errors.push(
      error(
        "no_improvement",
        "listingIds",
        `none of the compared listings improves on the rejected one for ${focusField}`,
      ),
    );
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, spec };
};
