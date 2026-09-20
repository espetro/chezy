// Telegram identity: `tg-<telegramUserId>` maps to a chezy `User` row via the
// same helpers the web `identifyUser` tool uses, and the link is persisted in
// `bot.telegram_users` so the radar can DM users proactively.
//
// The `bot` schema and its tables are created lazily at startup — apps/web
// drizzle migrations stay untouched.
import { client } from "~/lib/db/client";
import { createNamedUser, getUserByUsername } from "~/lib/db/queries";
import { scopedUsername } from "~/lib/user-profile";

// Web tools scope every claimed name to a session user via `scopedUsername`
// (`<name>--<session8>`). For Telegram the session user IS the telegram user
// id, so the mapped username is minted already-scoped: `scopedUsername` inside
// the tools returns it unchanged. The full id stays in the prefix, keeping the
// username unique even when two ids share their first 8 digits.
export function telegramUsername(telegramUserId: string | number): string {
  return scopedUsername(String(telegramUserId), `tg-${telegramUserId}`) ?? `tg-${telegramUserId}`;
}

let schemaReady: Promise<void> | undefined;

export function ensureBotSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await client.unsafe(`CREATE SCHEMA IF NOT EXISTS bot`);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS bot.telegram_users (
        username text PRIMARY KEY,
        telegram_user_id text NOT NULL UNIQUE,
        chat_id text NOT NULL,
        thread_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.unsafe(`
      CREATE TABLE IF NOT EXISTS bot.radar_seen (
        username text NOT NULL,
        listing_id text NOT NULL,
        seen_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (username, listing_id)
      )
    `);
    // Bot-local copies of these tables predate the web arrangeViewing /
    // recordListingFeedback tools; the adapted web tools persist to `Viewing`
    // and `listing_feedback` instead, so the bot tables are dropped once here.
    await client.unsafe(`DROP TABLE IF EXISTS bot.viewings, bot.listing_feedback`);
  })();
  return schemaReady;
}

export interface TelegramUserLink {
  username: string;
  userId: string;
  telegramUserId: string;
  chatId: string;
  threadId?: string;
}

export async function ensureTelegramUser(input: {
  telegramUserId: string | number;
  chatId: string | number;
  threadId?: string;
}): Promise<TelegramUserLink> {
  await ensureBotSchema();

  const telegramUserId = String(input.telegramUserId);
  const username = telegramUsername(telegramUserId);
  const chatId = String(input.chatId);

  const existing = await getUserByUsername(username);
  const userId = existing ? existing.id : (await createNamedUser(username)).id;

  await client.unsafe(
    `INSERT INTO bot.telegram_users (username, telegram_user_id, chat_id, thread_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (telegram_user_id) DO UPDATE SET
       username = EXCLUDED.username,
       chat_id = EXCLUDED.chat_id,
       thread_id = EXCLUDED.thread_id,
       updated_at = now()`,
    [username, telegramUserId, chatId, input.threadId ?? null],
  );

  return { username, userId, telegramUserId, chatId, threadId: input.threadId ?? "" };
}

export async function getTelegramUserLink(
  telegramUserId: string | number,
): Promise<TelegramUserLink | undefined> {
  await ensureBotSchema();
  const rows = await client.unsafe<
    { username: string; telegram_user_id: string; chat_id: string; thread_id: string | null }[]
  >(
    `SELECT username, telegram_user_id, chat_id, thread_id
     FROM bot.telegram_users WHERE telegram_user_id = $1`,
    [String(telegramUserId)],
  );
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  return {
    username: row.username,
    userId: (await getUserByUsername(row.username))?.id ?? "",
    telegramUserId: row.telegram_user_id,
    chatId: row.chat_id,
    threadId: row.thread_id ?? "",
  };
}
