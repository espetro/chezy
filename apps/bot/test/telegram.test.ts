import { afterAll, describe, expect, it, vi } from "vitest";
import { MastraLanguageModelV2Mock } from "@mastra/core/test-utils/llm-mock";
import type { AuditEvent, AuditLogger } from "@chezy/observability";

import { cleanBotState, startFakeTelegram, stubTelegramEnv } from "./harness";

afterAll(() => {
  vi.unstubAllEnvs();
});

/** In-memory audit sink injected into the Mastra trace exporter. */
function auditCollector() {
  const events: AuditEvent[] = [];
  const logger: AuditLogger = {
    emit: (e) => {
      events.push(e);
    },
    child: () => logger,
  };
  return { events, logger };
}

async function waitFor<T>(fn: () => T | undefined, timeoutMs = 15_000): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs;
  let hit = fn();
  while (!hit && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
    hit = fn();
  }
  return hit;
}

describe("telegram e2e (fake Bot API)", () => {
  it("answers a plain DM", async () => {
    const { fake, apiBaseUrl, close } = await startFakeTelegram();
    stubTelegramEnv(apiBaseUrl);
    vi.resetModules();
    const { createBotStack } = await import("../src/mastra");
    const { createMockModel } = await import("@mastra/core/test-utils/llm-mock");

    const audit = auditCollector();
    const { telegram } = createBotStack(
      createMockModel({ mockText: "Hola! Tell me about your flat hunt." }),
      audit.logger,
    );
    await telegram.disconnect("chezy").catch(() => {});
    await telegram.connect("chezy", { botToken: "fake-token" });
    await cleanBotState(900001);

    fake.sendText({ telegramUserId: 900001, text: "hola" });
    // The adapter posts a "..." placeholder first and streams the real reply
    // via editMessageText carrying `rich_message.markdown`; the run also does
    // pg memory writes, so give it a generous window.
    const callText = (c: (typeof fake.calls)[number]) =>
      String(
        c.body.text ?? (c.body.rich_message as { markdown?: string } | undefined)?.markdown ?? "",
      );
    const deadline = Date.now() + 30_000;
    let reply = fake.calls.find(
      (c) =>
        (c.method === "sendMessage" || c.method === "editMessageText") &&
        callText(c).includes("Hola"),
    );
    while (!reply && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
      reply = fake.calls.find(
        (c) =>
          (c.method === "sendMessage" || c.method === "editMessageText") &&
          callText(c).includes("Hola"),
      );
    }
    if (!reply) console.log("CALLS", JSON.stringify(fake.calls));
    expect(reply).toBeDefined();
    expect(String(reply?.body.chat_id)).toBe("900001");

    // Identity was linked and the username stamped.
    const { getTelegramUserLink, telegramUsername } = await import("../src/identity");
    const link = await getTelegramUserLink(900001);
    expect(link?.username).toBe(telegramUsername(900001));

    // Open item 2a: the Mastra trace exporter must emit a chat.turn.complete
    // audit record carrying the turn summary. The actor/target below come
    // from chezy.username / chezy.threadId on the root span's exported
    // requestContext, proving the metadata reaches the exporter.
    const auditLine = await waitFor(() =>
      audit.events.find((e) => e.action === "chat.turn.complete"),
    );
    expect(auditLine).toBeDefined();
    expect(auditLine?.actor).toBe(telegramUsername(900001));
    expect(auditLine?.target).toBe("telegram:900001");
    const ctx = auditLine?.ctx as Record<string, unknown>;
    expect(ctx.channel).toBe("telegram");
    expect(typeof ctx.latency_ms).toBe("number");
    expect(Array.isArray(ctx.tools)).toBe(true);
    expect(Array.isArray(ctx.cited_listing_ids)).toBe(true);

    await telegram.disconnect("chezy");
    close();
  });

  it("gates arrangeViewing behind an approval card", async () => {
    const { fake, apiBaseUrl, close } = await startFakeTelegram();
    stubTelegramEnv(apiBaseUrl);
    vi.resetModules();
    const { createBotStack } = await import("../src/mastra");
    const audit = auditCollector();

    const stream = (parts: unknown[]) => ({
      stream: new ReadableStream({
        start(controller) {
          for (const part of parts) controller.enqueue(part);
          controller.close();
        },
      }),
    });
    const textResult = (text: string) =>
      stream([
        { type: "stream-start", warnings: [] },
        { type: "text-start", id: "t1" },
        { type: "text-delta", id: "t1", delta: text },
        { type: "text-end", id: "t1" },
        {
          type: "finish",
          finishReason: "stop",
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]);
    const toolCallResult = stream([
      { type: "stream-start", warnings: [] },
      {
        type: "tool-call",
        toolCallId: "call-approve-1",
        toolName: "arrangeViewing",
        input: JSON.stringify({ listingId: "lst-fake-1" }),
      },
      {
        type: "finish",
        finishReason: "tool-calls",
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
    ]);

    // MastraLanguageModelV2Mock indexes a doStream array after incrementing
    // the call counter (off by one), so drive the sequence with a function.
    let streamCall = 0;
    const model = new MastraLanguageModelV2Mock({
      doStream: async () =>
        streamCall++ === 0 ? toolCallResult : textResult("Booking the visit now."),
    });
    const { telegram } = createBotStack(model, audit.logger);
    await telegram.disconnect("chezy").catch(() => {});
    await telegram.connect("chezy", { botToken: "fake-token" });
    await cleanBotState(900002);

    // arrangeViewing resolves the listing and persists a Viewing row with an
    // FK to Listing, so seed one.
    const { client: seedClient } = await import("~/lib/db/client");
    await seedClient.unsafe(
      `INSERT INTO "Listing" (id, platform, "platformId", url, operation, title, "priceEur", rooms, "builtM2", neighbourhood)
       VALUES ('lst-fake-1', 'idealista', 'lst-fake-1', 'https://example.com/lst-fake-1', 'rent', 'Test flat', 1200, 2, 60, 'Gràcia')
       ON CONFLICT (id) DO NOTHING`,
    );

    fake.sendText({ telegramUserId: 900002, text: "I want to visit lst-fake-1" });

    // The approval card is posted/edited into the tool-call message: look for
    // any outbound call carrying a non-empty inline keyboard.
    const hasKeyboard = (c: (typeof fake.calls)[number]) => {
      const markup = c.body.reply_markup as
        | { inline_keyboard?: Array<Array<{ callback_data?: string }>> }
        | undefined;
      return (markup?.inline_keyboard?.length ?? 0) > 0;
    };
    const deadline = Date.now() + 30_000;
    let card = fake.calls.find(hasKeyboard);
    while (!card && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
      card = fake.calls.find(hasKeyboard);
    }
    if (!card)
      console.log("CALLS", JSON.stringify(fake.calls.filter((c) => c.method !== "getUpdates")));
    expect(card).toBeDefined();
    const markup = card?.body.reply_markup as {
      inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
    };
    const approve = markup.inline_keyboard.flat().find((b) => /approve/i.test(b.text));
    expect(approve).toBeDefined();

    fake.callbackQuery({ telegramUserId: 900002, data: approve?.callback_data ?? "" });

    // Wait for the tool to execute: web's arrangeViewing persists a Viewing
    // row keyed by the mapped user's id.
    const { client } = await import("~/lib/db/client");
    const { getTelegramUserLink } = await import("../src/identity");
    const link = await getTelegramUserLink(900002);
    let rows: unknown[] = [];
    while (Date.now() < deadline + 5_000) {
      rows = await client.unsafe(
        `SELECT * FROM "Viewing" WHERE "userId" = $1 AND "listingId" = 'lst-fake-1'`,
        [link?.userId ?? ""],
      );
      if (rows.length > 0) break;
      await new Promise((r) => setTimeout(r, 50));
      if (Date.now() > deadline + 5_000) break;
    }
    expect(rows.length).toBe(1);
    // VIEWING_MODE=mock + CALENDAR_MODE=mock: dispatch mocks, booking confirms.
    expect((rows[0] as { status: string }).status).toBe("booked");

    // The run's audit record must name the tool and carry its listing id —
    // this is the check that TOOL_CALL span input/output reach the exporter.
    // Approval resumes the run in the same trace, so the tool span ends after
    // the root span; the exporter defers the record until pending tools end.
    const auditLine = await waitFor(() =>
      audit.events.find((e) =>
        (e.ctx?.tools as Array<{ name: string }> | undefined)?.some(
          (t) => t.name === "arrangeViewing",
        ),
      ),
    );
    expect(auditLine).toBeDefined();
    const tools = auditLine?.ctx?.tools as Array<{
      name: string;
      ok: boolean;
      listingIds?: string[];
    }>;
    const arrange = tools?.find((t) => t.name === "arrangeViewing");
    expect(arrange?.ok).toBe(true);
    expect(arrange?.listingIds).toEqual(["lst-fake-1"]);

    await telegram.disconnect("chezy");
    close();
  });
});
