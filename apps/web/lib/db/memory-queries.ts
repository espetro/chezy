import "server-only";

import postgres from "postgres";
import { ChatbotError } from "../errors";
import type { MemoryKind } from "./schema";

const client = postgres(process.env.POSTGRES_URL ?? "");

export type MemoryRow = {
  id: string;
  userId: string;
  chatId: string | null;
  kind: MemoryKind;
  content: string;
  embeddingModel: string;
  createdAt: Date;
  distance?: number;
};

export type InsertMemoryParams = {
  userId: string;
  chatId: string | null;
  kind: MemoryKind;
  content: string;
  embedding: number[];
  embeddingModel: string;
};

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function mapRow(row: Record<string, unknown>): MemoryRow {
  return {
    id: row.id as string,
    userId: row.userId as string,
    chatId: (row.chatId as string | null) ?? null,
    kind: row.kind as MemoryKind,
    content: row.content as string,
    embeddingModel: row.embeddingModel as string,
    createdAt: row.createdAt as Date,
    distance: Number(row.distance),
  };
}

export async function insertMemory(params: InsertMemoryParams): Promise<void> {
  const { userId, chatId, kind, content, embedding, embeddingModel } = params;

  try {
    await client`
      INSERT INTO "Memory" ("userId", "chatId", kind, content, embedding, "embeddingModel")
      VALUES (${userId}, ${chatId}, ${kind}, ${content}, ${toVectorLiteral(embedding)}::vector, ${embeddingModel})
    `;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function searchMemories(params: {
  userId: string;
  queryEmbedding: number[];
  limit: number;
}): Promise<MemoryRow[]> {
  const { userId, queryEmbedding, limit } = params;
  const vector = toVectorLiteral(queryEmbedding);

  try {
    const result = await client`
      SELECT id, "userId", "chatId", kind, content, "embeddingModel", "createdAt",
             embedding <=> ${vector}::vector AS distance
      FROM "Memory"
      WHERE "userId" = ${userId}
      ORDER BY embedding <=> ${vector}::vector
      LIMIT ${limit}
    `;

    return result.map((row) => mapRow(row as Record<string, unknown>));
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}

export async function findSimilarMemory(params: {
  userId: string;
  contentEmbedding: number[];
  threshold: number;
}): Promise<MemoryRow | undefined> {
  const { userId, contentEmbedding, threshold } = params;
  const vector = toVectorLiteral(contentEmbedding);

  try {
    const result = await client`
      SELECT id, "userId", "chatId", kind, content, "embeddingModel", "createdAt",
             embedding <=> ${vector}::vector AS distance
      FROM "Memory"
      WHERE "userId" = ${userId} AND embedding <=> ${vector}::vector < ${threshold}
      LIMIT 1
    `;

    return result[0] ? mapRow(result[0] as Record<string, unknown>) : undefined;
  } catch (error) {
    throw new ChatbotError("bad_request:database", { cause: error });
  }
}
