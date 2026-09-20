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
