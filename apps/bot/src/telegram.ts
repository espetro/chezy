import { MemoryStateAdapter } from "@chat-adapter/state-memory";
import { TelegramProvider } from "@mastra/telegram";

import { env } from "./env";
import { ensureTelegramUser } from "./identity";
import { USERNAME_CONTEXT_KEY } from "./tools/adapt";

const allowedUserIds = (): Set<string> =>
  new Set(
    (env.TELEGRAM_ALLOWED_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );

export function createTelegramProvider(): TelegramProvider {
  return new TelegramProvider({
    mode: "polling",
    apiBaseUrl: env.TELEGRAM_API_BASE_URL,
    // 'cards' keeps requireApproval tool calls rendered as approve/deny inline
    // keyboards; the 'text' default would auto-resume them without asking.
    toolDisplay: "cards",
    // Dedupe/locking/subscriptions need a state adapter; in-memory is enough
    // for polling mode (a restart simply re-reads pending updates).
    state: new MemoryStateAdapter(),
    resolveResourceId: ({ message }) => `tg:${message.author.userId ?? "unknown"}`,
    handlers: {
      onDirectMessage: async (thread, message, defaultHandler, ctx) => {
        const userId = message.author.userId;
        if (userId) {
          const allowed = allowedUserIds();
          if (allowed.size > 0 && !allowed.has(userId)) {
            return;
          }
          const raw = message.raw as { chat?: { id?: number | string } } | undefined;
          const chatId = raw?.chat?.id ?? thread.channelId;
          const { username } = await ensureTelegramUser({
            telegramUserId: userId,
            chatId,
            threadId: thread.channelId,
          });
          // Tools read this inside their execute; see tools/adapt.ts.
          ctx.requestContext.set(USERNAME_CONTEXT_KEY, username);
        }
        await defaultHandler(thread, message);
      },
    },
  });
}
