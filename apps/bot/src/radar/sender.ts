// Proactive Telegram sends for the radar. Primary path: the Chat SDK adapter
// the provider keeps per installation (`openDM` + `postMessage`), which gives
// proper message rendering. Fallback: a raw Bot API `sendMessage` against
// TELEGRAM_API_BASE_URL — used when the adapter isn't available (e.g. the
// radar fires before connect, or in tests).
import type { TelegramProvider } from "@mastra/telegram";

import { env } from "../env";
import type { TelegramUserLink } from "../identity";
import type { RadarSender } from "./radar";

export function createTelegramSender(telegram: TelegramProvider): RadarSender {
  return async (link, text) => {
    const installation = await telegram.getInstallation("chezy");
    const adapter = installation ? telegram.getAdapter(installation.id) : undefined;
    if (adapter) {
      try {
        const dmThreadId = await adapter.openDM(link.telegramUserId);
        await adapter.postMessage(dmThreadId, text);
        return;
      } catch {
        // fall through to the raw Bot API below
      }
    }
    if (!env.BOT_TOKEN) {
      throw new Error("radar send failed: no telegram adapter and bot token is unset");
    }
    const response = await fetch(`${env.TELEGRAM_API_BASE_URL}/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: link.chatId, text }),
    });
    if (!response.ok) {
      throw new Error(`radar sendMessage failed: ${response.status} ${await response.text()}`);
    }
  };
}
