// In-memory Telegram Bot API fake. Implements the subset of endpoints the
// polling adapter touches; inbound updates are queued via `enqueue()` and
// every outbound call is recorded in `calls`.
import { Hono } from "hono";

export interface FakeCall {
  method: string;
  body: Record<string, unknown>;
}

export interface FakeTelegram {
  app: Hono;
  calls: FakeCall[];
  enqueue(update: Record<string, unknown>): void;
  sendText(update: {
    telegramUserId: number;
    chatId?: number;
    text: string;
    messageId?: number;
  }): void;
  callbackQuery(update: {
    telegramUserId: number;
    chatId?: number;
    data: string;
    messageId?: number;
  }): void;
  /** Wait until a call matching `method` has been recorded (polls, 5s cap). */
  waitForCall(method: string, timeoutMs?: number): Promise<FakeCall>;
  reset(): void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createFakeTelegram(): FakeTelegram {
  const app = new Hono();
  const calls: FakeCall[] = [];
  let updates: Array<Record<string, unknown>> = [];
  let nextUpdateId = 1;
  let nextMessageId = 1;
  const waiters: Array<() => void> = [];

  const notify = () => {
    for (const wake of waiters.splice(0)) {
      wake();
    }
  };

  // Bot API calls arrive as /bot<token>/<method>; @mastra/telegram uses GET
  // when there is no payload (getMe, deleteWebhook) and POST otherwise.
  app.all("/*", async (c) => {
    const method = c.req.path.split("/").pop() ?? "";
    const body = (
      c.req.method === "POST"
        ? await c.req.json().catch(() => ({}))
        : Object.fromEntries(new URL(c.req.url).searchParams)
    ) as Record<string, unknown>;
    calls.push({ method, body });

    switch (method) {
      case "getMe":
        return c.json({
          ok: true,
          result: { id: 424242, is_bot: true, first_name: "chezy", username: "chezy_fake_bot" },
        });
      case "deleteWebhook":
      case "setWebhook":
        return c.json({ ok: true, result: true });
      case "getUpdates": {
        const offset = typeof body.offset === "number" ? body.offset : undefined;
        const timeoutSec = typeof body.timeout === "number" ? body.timeout : 0;
        // Long-poll: wait briefly for an enqueued update so the polling loop
        // doesn't spin, but never hang a test.
        const deadline = Date.now() + Math.min(timeoutSec * 1000, 25);
        while (updates.length === 0 && Date.now() < deadline) {
          await new Promise<void>((resolve) => {
            const t = setTimeout(resolve, Math.max(deadline - Date.now(), 0));
            waiters.push(() => {
              clearTimeout(t);
              resolve();
            });
          });
        }
        const batch = updates.filter(
          (u) => offset === undefined || (u.update_id as number) >= offset,
        );
        updates = updates.filter((u) => !batch.includes(u));
        return c.json({ ok: true, result: batch });
      }
      case "sendMessage":
        return c.json({
          ok: true,
          result: {
            message_id: nextMessageId++,
            chat: { id: body.chat_id },
            date: Math.floor(Date.now() / 1000),
            text: body.text,
          },
        });
      case "editMessageText":
        return c.json({
          ok: true,
          result: {
            message_id: body.message_id ?? nextMessageId - 1,
            chat: { id: body.chat_id },
            date: Math.floor(Date.now() / 1000),
            text: body.text,
          },
        });
      case "sendChatAction":
      case "answerCallbackQuery":
      case "setMyCommands":
        return c.json({ ok: true, result: true });
      default:
        return c.json({ ok: true, result: true });
    }
  });

  return {
    app,
    calls,
    enqueue(update) {
      updates.push({ update_id: nextUpdateId++, ...update });
      notify();
    },
    sendText({ telegramUserId, chatId, text, messageId }) {
      const chat = chatId ?? telegramUserId;
      updates.push({
        update_id: nextUpdateId++,
        message: {
          message_id: messageId ?? nextMessageId++,
          from: { id: telegramUserId, is_bot: false, first_name: "Tester" },
          chat: { id: chat, type: "private" },
          date: Math.floor(Date.now() / 1000),
          text,
        },
      });
      notify();
    },
    callbackQuery({ telegramUserId, chatId, data, messageId }) {
      const chat = chatId ?? telegramUserId;
      updates.push({
        update_id: nextUpdateId++,
        callback_query: {
          id: `cbq-${nextUpdateId}`,
          from: { id: telegramUserId, is_bot: false, first_name: "Tester" },
          message: {
            message_id: messageId ?? nextMessageId - 1,
            chat: { id: chat, type: "private" },
            date: Math.floor(Date.now() / 1000),
          },
          chat_instance: "fake",
          data,
        },
      });
      notify();
    },
    async waitForCall(method, timeoutMs = 5_000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const hit = calls.find((c) => c.method === method);
        if (hit) {
          return hit;
        }
        if (Date.now() > deadline) {
          throw new Error(`fake telegram: no ${method} call within ${timeoutMs}ms`);
        }
        await sleep(10);
      }
    },
    reset() {
      calls.length = 0;
      updates = [];
    },
  };
}
