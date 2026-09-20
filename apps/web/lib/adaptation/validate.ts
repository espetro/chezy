import {
  ComparisonPanelSpecSchema,
  FOCUS_FIELD,
  type ComparisonPanelSpec,
  type FeedbackReason,
  type PanelValidationError,
} from "@chezy/contract";
import * as v from "valibot";

export interface ValidationContext {
  feedbackEventId: string;
  profileVersion: string;
  focus: FeedbackReason;
  sourceListingIds: readonly string[];
  expectedAttempt: number;
}

export type ValidationResult =
  | { ok: true; spec: ComparisonPanelSpec }
  | { ok: false; errors: PanelValidationError[] };

const error = (
  code: PanelValidationError["code"],
  path: string,
  message: string,
): PanelValidationError => ({ code, path, message });

// Deterministic gate between the provider output and the accepted spec.
// Collects every violation as a coded PanelValidationError so JES-13 retries
// can feed them back to the session. JES-13 extends ValidationContext,
// appends codes and adds semantic checks; the signature stays.
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
  spec.listingIds.forEach((id, index) => {
    if (!allowed.has(id)) {
      errors.push(
        error("unknown_listing", `listingIds.${index}`, `${id} is not in the candidate set`),
      );
    }
  });
  const focusField = FOCUS_FIELD[ctx.focus];
  if (!spec.rows.some((row) => row.field === focusField)) {
    errors.push(error("missing_required_row", "rows", `rows must include the ${focusField} field`));
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, spec };
};
