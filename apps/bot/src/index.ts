import path from "node:path";
import { fileURLToPath } from "node:url";

import { serve } from "@hono/node-server";
import { MastraServer } from "@mastra/hono";
import { config as loadDotenv } from "dotenv";
import { Hono } from "hono";

const botDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Bot-local secrets (TELEGRAM_BOT_API_KEY, …) live in apps/bot/.env /
// .env.local — loaded here, only in the real entrypoint, so tests control
// process.env themselves. First file wins on duplicates.
loadDotenv({
  path: [path.join(botDir, ".env"), path.join(botDir, ".env.local")],
  quiet: true,
});

export async function startBot() {
  // Imported lazily so the dotenv load above lands before env.ts parses.
  const { configureLogger } = await import("@chezy/observability");
  const { env } = await import("./env");
  const { ensureBotSchema } = await import("./identity");
  const { createBotStack } = await import("./mastra");
  const { createRadar } = await import("./radar/radar");
  const { createTelegramSender } = await import("./radar/sender");

  await configureLogger({ service: "chezy-bot" });
  await ensureBotSchema();

  const { mastra, telegram } = createBotStack();
  const app = new Hono();
  const server = new MastraServer({ app, mastra });
  await server.init();

  const radar = createRadar({ send: createTelegramSender(telegram) });

  // Manual radar trigger for demos and `mise run bot:radar`. Disabled unless
  // BOT_INTERNAL_TOKEN is set.
  app.post("/internal/radar/run", async (c) => {
    if (!env.BOT_INTERNAL_TOKEN) {
      return c.json({ error: "radar trigger disabled (BOT_INTERNAL_TOKEN unset)" }, 404);
    }
    const token =
      c.req.header("x-internal-token") ?? c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
    if (token !== env.BOT_INTERNAL_TOKEN) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const result = await radar.runOnce();
    return c.json(result);
  });

  serve({ fetch: app.fetch, port: env.BOT_PORT }, (info) => {
    console.log(`[bot] listening on http://127.0.0.1:${info.port}`);
  });

  if (env.BOT_TOKEN) {
    try {
      await telegram.connect("chezy", {
        botToken: env.BOT_TOKEN,
        name: env.BOT_USERNAME,
      });
    } catch (error) {
      // A stale installation (e.g. a previous token or the fake test bot)
      // persists in Mastra storage; drop it and reconnect.
      if (!(error instanceof Error && error.message.includes("already connected"))) {
        throw error;
      }
      await telegram.disconnect("chezy").catch(() => {});
      await telegram.connect("chezy", {
        botToken: env.BOT_TOKEN,
        name: env.BOT_USERNAME,
      });
    }
    console.log("[bot] telegram connected (polling)");
  } else {
    console.log("[bot] TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_API_KEY unset — HTTP routes only");
  }

  radar.start();
  return { app, mastra, telegram, radar };
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  void startBot();
}
