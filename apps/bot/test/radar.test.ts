import { afterAll, describe, expect, it, vi } from "vitest";

import { cleanBotState, startFakeTelegram, stubTelegramEnv } from "./harness";

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("radar", () => {
  it("alerts once per unseen matching listing", async () => {
    const { fake, apiBaseUrl, close } = await startFakeTelegram();
    stubTelegramEnv(apiBaseUrl);
    vi.resetModules();

    const { client } = await import("~/lib/db/client");
    const { ensureBotSchema, ensureTelegramUser } = await import("../src/identity");
    const { updateUserProfile, getUserByUsername } = await import("~/lib/db/queries");
    const { createRadar } = await import("../src/radar/radar");
    const { createTelegramSender } = await import("../src/radar/sender");
    const { createTelegramProvider } = await import("../src/telegram");

    await ensureBotSchema();
    await cleanBotState(910001);

    // Seed a linked user with a complete profile.
    const link = await ensureTelegramUser({ telegramUserId: 910001, chatId: 910001 });
    await updateUserProfile({
      userId: link.userId,
      profile: { areas: ["Gràcia"], budgetMaxEur: 1500, bedroomsMin: 1 },
    });
    const user = await getUserByUsername(link.username);
    expect(user?.profile?.budgetMaxEur).toBe(1500);

    // Seed a matching rent listing.
    const listingId = `radar-test-${Date.now()}`;
    await client.unsafe(
      `INSERT INTO "Listing" (id, platform, "platformId", url, operation, title, "priceEur", rooms, "builtM2", neighbourhood)
       VALUES ($1, 'idealista', $1, 'https://example.com/l', 'rent', 'Test flat', 1200, 2, 60, 'Gràcia')
       ON CONFLICT (id) DO NOTHING`,
      [listingId],
    );

    // Sender falls back to the raw Bot API (no installation) -> hits the fake.
    const radar = createRadar({ send: createTelegramSender(createTelegramProvider()) });
    await radar.runOnce();

    const sends = fake.calls.filter(
      (c) => c.method === "sendMessage" && String(c.body.chat_id) === "910001",
    );
    expect(sends.length).toBe(1);
    expect(String(sends[0]?.body.text)).toContain("Want me to call the agency");

    const seen = await client.unsafe(`SELECT listing_id FROM bot.radar_seen WHERE username = $1`, [
      link.username,
    ]);
    expect(seen.length).toBeGreaterThan(0);

    fake.reset();
    await radar.runOnce();
    const sends2 = fake.calls.filter(
      (c) => c.method === "sendMessage" && String(c.body.chat_id) === "910001",
    );
    expect(sends2.length).toBe(0);

    close();
  });
});
