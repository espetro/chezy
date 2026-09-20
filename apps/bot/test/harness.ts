import type { AddressInfo, Server } from "node:net";

import { serve } from "@hono/node-server";
import { vi } from "vitest";

import { createFakeTelegram, type FakeTelegram } from "./fake-telegram";

export interface FakeTelegramServer {
  fake: FakeTelegram;
  apiBaseUrl: string;
  close(): void;
}

export async function startFakeTelegram(): Promise<FakeTelegramServer> {
  const fake = createFakeTelegram();
  const server = serve({ fetch: fake.app.fetch, port: 0 }) as unknown as Server;
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    fake,
    apiBaseUrl: `http://127.0.0.1:${port}`,
    close: () => server.close(),
  };
}

/** Point the bot at the fake BEFORE any src/ module is imported. */
export function stubTelegramEnv(apiBaseUrl: string) {
  vi.stubEnv("TELEGRAM_API_BASE_URL", apiBaseUrl);
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "fake-token");
}

/**
 * The suite runs against the shared pg0 database, so leftover rows from a
 * previous run can leak into assertions. Delete this test's `bot.*` rows before
 * each case. (The web `User` row stays: `createNamedUser` is idempotent.)
 */
export async function cleanBotState(...telegramUserIds: number[]) {
  const { client } = await import("~/lib/db/client");
  const { telegramUsername } = await import("../src/identity");
  // Keyed by telegram_user_id so rows left by an older username format go too.
  const links = await client.unsafe<{ username: string }[]>(
    `DELETE FROM bot.telegram_users WHERE telegram_user_id = ANY($1) RETURNING username`,
    [telegramUserIds.map(String)],
  );
  const usernames = [
    ...telegramUserIds.map((id) => telegramUsername(id)),
    ...links.map((l) => l.username),
  ];
  // bot.viewings/bot.listing_feedback are dropped at startup; older worktrees
  // may still have them, so delete only when the table exists.
  for (const table of ["viewings", "listing_feedback", "radar_seen"]) {
    const exists = await client.unsafe<{ reg: string | null }[]>(`SELECT to_regclass($1) AS reg`, [
      `bot.${table}`,
    ]);
    if (exists[0]?.reg) {
      await client.unsafe(`DELETE FROM bot.${table} WHERE username = ANY($1)`, [usernames]);
    }
  }
  // The adapted web tools write Viewing / listing_feedback rows keyed by the
  // mapped User id; clear them for both current and prior username formats.
  const userIds = await client.unsafe<{ id: string }[]>(
    `SELECT id FROM "User" WHERE username = ANY($1)`,
    [usernames],
  );
  for (const { id } of userIds) {
    await client.unsafe(`DELETE FROM "Viewing" WHERE "userId" = $1`, [id]);
    await client.unsafe(`DELETE FROM listing_feedback WHERE user_id = $1`, [id]);
  }
}
