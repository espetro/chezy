import type { UserProfile } from "@chezy/contract";
import type { InferSelectModel } from "drizzle-orm";
import type { ListingInsights } from "@/lib/vision/schema";
import {
  boolean,
  doublePrecision,
  foreignKey,
  integer,
  json,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
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
  })
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
  })
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
  })
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
  })
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
  ceilingFeatures: jsonb("ceilingFeatures")
    .$type<string[]>()
    .notNull()
    .default([]),
  windowSize: text("windowSize"),
  lightNatural: text("lightNatural"),
  facing: text("facing"),
  outdoorSpaces: jsonb("outdoorSpaces")
    .$type<string[]>()
    .notNull()
    .default([]),
  furnished: text("furnished"),
  style: text("style"),
  acVisible: boolean("acVisible"),
  virtualStaging: boolean("virtualStaging"),
});

export type ListingInsight = InferSelectModel<typeof listingInsight>;
