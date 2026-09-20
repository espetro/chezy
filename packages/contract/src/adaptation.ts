import * as v from "valibot";
import { ProfileVersionSchema, type FeedbackReason } from "./feedback";

export const COMPARISON_FIELDS = ["price", "area", "balcony", "rooms", "size"] as const;
export const ComparisonFieldSchema = v.picklist(COMPARISON_FIELDS);
export type ComparisonField = v.InferOutput<typeof ComparisonFieldSchema>;

export const COMPARISON_ACTIONS = ["open_listing", "edit_preferences"] as const;
export const ComparisonActionSchema = v.picklist(COMPARISON_ACTIONS);
export type ComparisonAction = v.InferOutput<typeof ComparisonActionSchema>;

// Rejection reasons that name a comparable field. A free-form "other"
// rejection has nothing to compare around and starts no adaptation.
export const ADAPTATION_FOCUSES = ["too_expensive", "wrong_area", "missing_balcony"] as const;
export const AdaptationFocusSchema = v.picklist(ADAPTATION_FOCUSES);
export type AdaptationFocus = v.InferOutput<typeof AdaptationFocusSchema>;
export const isAdaptationFocus = (reason: FeedbackReason): reason is AdaptationFocus =>
  (ADAPTATION_FOCUSES as readonly string[]).includes(reason);

// The row a comparison must contain per focus.
export const FOCUS_FIELD: Record<AdaptationFocus, ComparisonField> = {
  too_expensive: "price",
  wrong_area: "area",
  missing_balcony: "balcony",
};

// Bounds shared between the Valibot schema and the Draft 7 twin below so the
// two cannot drift.
export const COMPARISON_TITLE_MAX = 80;
export const COMPARISON_LISTING_ID_MAX = 200;
export const COMPARISON_LISTINGS_MIN = 2;
export const COMPARISON_LISTINGS_MAX = 3;
export const COMPARISON_ROW_LABEL_MAX = 40;
export const COMPARISON_ROW_NOTE_MAX = 140;
export const COMPARISON_ROWS_MIN = 1;
export const COMPARISON_ROWS_MAX = 4;
export const COMPARISON_ACTIONS_MAX = 2;

export const ComparisonPanelSpecSchema = v.strictObject({
  schemaVersion: v.literal(1),
  feedbackEventId: v.pipe(v.string(), v.uuid()),
  profileVersion: ProfileVersionSchema,
  focus: AdaptationFocusSchema,
  // Echoed from the prompt (1, or 2 after a correction message); together with
  // a content hash it tells a fresh candidate from the previous output.
  attempt: v.pipe(v.number(), v.integer(), v.minValue(1)),
  title: v.pipe(v.string(), v.minLength(1), v.maxLength(COMPARISON_TITLE_MAX)),
  listingIds: v.pipe(
    v.array(v.pipe(v.string(), v.minLength(1), v.maxLength(COMPARISON_LISTING_ID_MAX))),
    v.minLength(COMPARISON_LISTINGS_MIN),
    v.maxLength(COMPARISON_LISTINGS_MAX),
    v.check((ids) => new Set(ids).size === ids.length, "listingIds must not repeat"),
  ),
  rows: v.pipe(
    v.array(
      v.strictObject({
        field: ComparisonFieldSchema,
        label: v.pipe(v.string(), v.minLength(1), v.maxLength(COMPARISON_ROW_LABEL_MAX)),
        note: v.optional(v.pipe(v.string(), v.maxLength(COMPARISON_ROW_NOTE_MAX))),
      }),
    ),
    v.minLength(COMPARISON_ROWS_MIN),
    v.maxLength(COMPARISON_ROWS_MAX),
    v.check(
      (rows) => new Set(rows.map((row) => row.field)).size === rows.length,
      "row fields must not repeat",
    ),
  ),
  actions: v.pipe(
    v.array(ComparisonActionSchema),
    v.maxLength(COMPARISON_ACTIONS_MAX),
    v.check((actions) => new Set(actions).size === actions.length, "actions must not repeat"),
  ),
});
export type ComparisonPanelSpec = v.InferOutput<typeof ComparisonPanelSpecSchema>;

// Draft 7 twin of ComparisonPanelSpecSchema, sent to Devin as
// structured_output_schema. Hand-built from the same constants; no display
// values, only listing ids.
export const comparisonPanelJsonSchema: Record<string, unknown> = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "feedbackEventId",
    "profileVersion",
    "focus",
    "attempt",
    "title",
    "listingIds",
    "rows",
    "actions",
  ],
  properties: {
    schemaVersion: { const: 1 },
    feedbackEventId: { type: "string", format: "uuid" },
    profileVersion: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
    focus: { enum: [...ADAPTATION_FOCUSES] },
    attempt: { type: "integer", minimum: 1 },
    title: { type: "string", minLength: 1, maxLength: COMPARISON_TITLE_MAX },
    listingIds: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: COMPARISON_LISTING_ID_MAX },
      minItems: COMPARISON_LISTINGS_MIN,
      maxItems: COMPARISON_LISTINGS_MAX,
      uniqueItems: true,
    },
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "label"],
        properties: {
          field: { enum: [...COMPARISON_FIELDS] },
          label: { type: "string", minLength: 1, maxLength: COMPARISON_ROW_LABEL_MAX },
          note: { type: "string", maxLength: COMPARISON_ROW_NOTE_MAX },
        },
      },
      minItems: COMPARISON_ROWS_MIN,
      maxItems: COMPARISON_ROWS_MAX,
    },
    actions: {
      type: "array",
      items: { enum: [...COMPARISON_ACTIONS] },
      maxItems: COMPARISON_ACTIONS_MAX,
      uniqueItems: true,
    },
  },
};

// Validator codes stored in adaptation_job.validation_errors; the retry follow-up appends.
export const PANEL_ERROR_CODES = [
  "schema",
  "wrong_attempt",
  "wrong_event",
  "stale_profile",
  "wrong_focus",
  "unknown_listing",
  "missing_required_row",
  "rejected_listing",
  "red_line_violation",
  "unsafe_text",
  "no_improvement",
] as const;
export const PanelValidationErrorSchema = v.strictObject({
  code: v.picklist(PANEL_ERROR_CODES),
  path: v.string(),
  message: v.string(),
});
export type PanelValidationError = v.InferOutput<typeof PanelValidationErrorSchema>;

export const ADAPTATION_STATUSES = [
  "queued",
  "running",
  "correcting",
  "validating",
  "ready",
  "failed",
  "stale",
] as const;
export const AdaptationStatusSchema = v.picklist(ADAPTATION_STATUSES);
export type AdaptationStatus = v.InferOutput<typeof AdaptationStatusSchema>;

// Run trace shown to the user and exported as the sponsor proof. Carries step
// names, timestamps and validator codes only; never candidate content.
export const TRACE_STEPS = [
  "triggered",
  "session_created",
  "proposed",
  "rejected",
  "correcting",
  "accepted",
  "failed",
  "stale",
  "retried",
  "capability_gap",
] as const;
export const TraceEventSchema = v.strictObject({
  at: v.pipe(v.string(), v.isoTimestamp()),
  step: v.picklist(TRACE_STEPS),
  attempt: v.optional(v.pipe(v.number(), v.integer())),
  run: v.optional(v.pipe(v.number(), v.integer())),
  errors: v.optional(v.array(PanelValidationErrorSchema)),
  sessionId: v.optional(v.string()),
  message: v.optional(v.string()),
});
export type TraceEvent = v.InferOutput<typeof TraceEventSchema>;

export const CAPABILITY_STATUSES = ["queued", "running", "pr_opened", "failed"] as const;
export const CapabilityStatusSchema = v.picklist(CAPABILITY_STATUSES);
export type CapabilityStatus = v.InferOutput<typeof CapabilityStatusSchema>;

export const CapabilityJobSchema = v.strictObject({
  jobId: v.pipe(v.string(), v.uuid()),
  capability: v.string(),
  status: CapabilityStatusSchema,
  provider: v.picklist(["devin", "mock"]),
  coverage: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
  // oxlint-disable-next-line unicorn/no-null
  sessionUrl: v.nullable(v.pipe(v.string(), v.url())),
  // oxlint-disable-next-line unicorn/no-null
  prUrl: v.nullable(v.pipe(v.string(), v.url())),
  // oxlint-disable-next-line unicorn/no-null
  error: v.nullable(v.string()),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});
export type CapabilityJob = v.InferOutput<typeof CapabilityJobSchema>;

export const AdaptationJobSchema = v.strictObject({
  jobId: v.pipe(v.string(), v.uuid()),
  feedbackEventId: v.pipe(v.string(), v.uuid()),
  status: AdaptationStatusSchema,
  provider: v.picklist(["devin", "mock"]),
  attempt: v.number(),
  // Deliberate new attempts after a terminal failure; each run has its own
  // candidate budget.
  run: v.number(),
  trace: v.array(TraceEventSchema),
  sessionUrl: v.nullable(v.pipe(v.string(), v.url())),
  // The accepted panel; only set when status is "ready".
  panel: v.nullable(ComparisonPanelSpecSchema),
  // Safe user-facing message only; never provider internals.
  error: v.nullable(v.string()),
  capability: v.optional(v.nullable(CapabilityJobSchema)),
  updatedAt: v.pipe(v.string(), v.isoTimestamp()),
});
export type AdaptationJob = v.InferOutput<typeof AdaptationJobSchema>;

export const AdaptationInputSchema = v.strictObject({
  eventId: v.pipe(v.string(), v.uuid()),
});
export type AdaptationInput = v.InferOutput<typeof AdaptationInputSchema>;

export const AdaptationOutputSchema = v.strictObject({ job: AdaptationJobSchema });
export type AdaptationOutput = v.InferOutput<typeof AdaptationOutputSchema>;

export const CapabilityOutputSchema = v.strictObject({ capability: CapabilityJobSchema });
export type CapabilityOutput = v.InferOutput<typeof CapabilityOutputSchema>;
