import type {
  AdaptationStatus,
  ComparisonPanelSpec,
  FeedbackEvent,
  FeedbackReason,
  PanelValidationError,
  UserProfile,
} from "@chezy/contract";
import type { InferSelectModel } from "drizzle-orm";
import type { ListingInsights } from "~/lib/vision/schema";
import {
  boolean,
  customType,
  doublePrecision,
  foreignKey,
  integer,
  json,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const user = pgTable("User", {
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  email: varchar("email", { length: 64 }).notNull(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  image: text("image"),
  isAnonymous: boolean("isAnonymous").notNull().default(false),
  name: text("name"),
  password: varchar("password", { length: 64 }),
  profile: json("profile").$type<UserProfile>(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  username: varchar("username", { length: 64 }).unique(),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  createdAt: timestamp("createdAt").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  attachments: json("attachments").notNull(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  createdAt: timestamp("createdAt").notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  parts: json("parts").notNull(),
  role: varchar("role").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    isUpvoted: boolean("isUpvoted").notNull(),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  }),
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    content: text("content"),
    createdAt: timestamp("createdAt").notNull(),
    id: uuid("id").notNull().defaultRandom(),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    title: text("title").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  }),
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    createdAt: timestamp("createdAt").notNull(),
    description: text("description"),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    documentId: uuid("documentId").notNull(),
    id: uuid("id").notNull().defaultRandom(),
    isResolved: boolean("isResolved").notNull().default(false),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
    pk: primaryKey({ columns: [table.id] }),
  }),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
    id: uuid("id").notNull().defaultRandom(),
  },
  (table) => ({
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
    pk: primaryKey({ columns: [table.id] }),
  }),
);

export type Stream = InferSelectModel<typeof stream>;

export const listing = pgTable("Listing", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(),
  platformId: text("platformId").notNull(),
  url: text("url").notNull(),
  operation: text("operation").notNull(),
  priceEur: doublePrecision("priceEur"),
  pricePeriod: text("pricePeriod"),
  propertyType: text("propertyType"),
  builtM2: doublePrecision("builtM2"),
  rooms: integer("rooms"),
  bathrooms: integer("bathrooms"),
  floor: text("floor"),
  lat: doublePrecision("lat"),
  lon: doublePrecision("lon"),
  street: text("street"),
  neighbourhood: text("neighbourhood"),
  district: text("district"),
  municipality: text("municipality"),
  postalCode: text("postalCode"),
  amenities: jsonb("amenities").$type<string[]>().notNull().default([]),
  title: text("title").notNull(),
  description: text("description"),
  publisherName: text("publisherName"),
  publisherKind: text("publisherKind"),
  coverUrl: text("coverUrl"),
  media: jsonb("media")
    .$type<Array<{ url: string; kind: string; roomType: string | null }>>()
    .notNull()
    .default([]),
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Listing = InferSelectModel<typeof listing>;

export const listingInsight = pgTable("ListingInsight", {
  listingId: text("listingId")
    .primaryKey()
    .references(() => listing.id, { onDelete: "cascade" }),
  insights: jsonb("insights").$type<ListingInsights>().notNull(),
  model: text("model").notNull(),
  promptVersion: integer("promptVersion").notNull(),
  promptTokens: integer("promptTokens"),
  completionTokens: integer("completionTokens"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  // Flattened from `insights` so search can filter without jsonb scans.
  conditionScore: integer("conditionScore"),
  flooringDominant: text("flooringDominant"),
  flooringAll: jsonb("flooringAll").$type<string[]>().notNull().default([]),
  ceilingFeatures: jsonb("ceilingFeatures").$type<string[]>().notNull().default([]),
  windowSize: text("windowSize"),
  lightNatural: text("lightNatural"),
  facing: text("facing"),
  outdoorSpaces: jsonb("outdoorSpaces").$type<string[]>().notNull().default([]),
  furnished: text("furnished"),
  style: text("style"),
  acVisible: boolean("acVisible"),
  virtualStaging: boolean("virtualStaging"),
});

export type ListingInsight = InferSelectModel<typeof listingInsight>;

// pgvector column: fixed 4096 dims (Qwen3-embedding). toDriver serializes
// number[] to the literal form pgvector accepts; fromDriver keeps the raw
// "[1,2,3]" string so callers parse on demand.
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(4096)";
  },
  toDriver(values) {
    return `[${values.join(",")}]`;
  },
});

export const memory = pgTable("Memory", {
  chatId: uuid("chatId").references(() => chat.id, {
    onDelete: "set null",
  }),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  embedding: vector("embedding"),
  embeddingModel: varchar("embeddingModel", { length: 64 }).notNull(),
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  kind: varchar("kind", { enum: ["summary", "fact", "property"] })
    .notNull()
    .default("fact"),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
});

export type MemoryKind = NonNullable<Memory["kind"]>;

export type Memory = InferSelectModel<typeof memory>;

export const searchProfile = pgTable("SearchProfile", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .unique()
    .references(() => user.id),
  workAddress: text("workAddress").notNull(),
  workLat: doublePrecision("workLat"),
  workLon: doublePrecision("workLon"),
  maxCommuteMin: integer("maxCommuteMin").notNull(),
  neighbourhoods: jsonb("neighbourhoods").$type<string[]>().notNull().default([]),
  minPriceEur: integer("minPriceEur").notNull(),
  maxPriceEur: integer("maxPriceEur").notNull(),
  minRooms: integer("minRooms").notNull(),
  minM2: integer("minM2").notNull(),
  moveDate: text("moveDate"),
  flexibleDays: integer("flexibleDays").notNull().default(0),
  mustHaves: jsonb("mustHaves").$type<string[]>().notNull().default([]),
  redLines: jsonb("redLines").$type<string[]>().notNull().default([]),
  alertsEnabled: boolean("alertsEnabled").notNull().default(true),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type SearchProfile = InferSelectModel<typeof searchProfile>;

export const listingFeedback = pgTable(
  "listing_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    listingId: text("listing_id")
      .notNull()
      .references(() => listing.id, { onDelete: "cascade" }),
    reason: text("reason").$type<FeedbackReason>().notNull(),
    profileVersion: text("profile_version").notNull(),
    facts: jsonb("facts").$type<FeedbackEvent["facts"]>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    undoneAt: timestamp("undone_at"),
  },
  (table) => [uniqueIndex("listing_feedback_user_event").on(table.userId, table.eventId)],
);

export type ListingFeedback = InferSelectModel<typeof listingFeedback>;

// A viewing arranged by the chat agent (or the SLNG call it dispatches).
// `status` tracks the lifecycle: dispatched (call placed, slot pending) ->
// booked (calendar confirmed, either by the tool or the SLNG webhook) or
// failed. `mock` marks rows written under VIEWING_MODE=mock.
export const viewing = pgTable("Viewing", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  listingId: text("listingId")
    .notNull()
    .references(() => listing.id),
  channel: text("channel").notNull(),
  callId: text("callId"),
  slotIso: text("slotIso"),
  status: text("status").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type Viewing = InferSelectModel<typeof viewing>;

export const adaptationJob = pgTable(
  "adaptation_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    feedbackEventId: uuid("feedback_event_id").notNull(),
    profileVersion: text("profile_version").notNull(),
    status: text("status").$type<AdaptationStatus>().notNull(),
    provider: text("provider").$type<"devin" | "mock">().notNull(),
    attempt: integer("attempt").notNull().default(0),
    // The candidate set handed to the provider; also the validator's allowlist.
    sourceListingIds: jsonb("source_listing_ids").$type<string[]>().notNull().default([]),
    providerSessionId: text("provider_session_id"),
    providerSessionUrl: text("provider_session_url"),
    candidateSpec: jsonb("candidate_spec").$type<unknown>(),
    acceptedSpec: jsonb("accepted_spec").$type<ComparisonPanelSpec>(),
    validationErrors: jsonb("validation_errors").$type<PanelValidationError[]>(),
    error: text("error"),
    deadlineAt: timestamp("deadline_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [uniqueIndex("adaptation_job_user_event").on(table.userId, table.feedbackEventId)],
);

export type AdaptationJobRow = InferSelectModel<typeof adaptationJob>;
