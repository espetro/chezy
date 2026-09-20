// Proactive listing alerts ("radar"). On an interval, every linked Telegram
// user with a complete profile gets at most one DM listing the best unseen
// matches. Deduped by bot.radar_seen so a second run is a no-op.
import { client } from "~/lib/db/client";
import { getUserByUsername } from "~/lib/db/queries";
import type { SearchProfile } from "~/lib/db/schema";
import { buildFeed } from "~/lib/feed";
import { getProfile } from "~/lib/profile";
import { missingProfileFields } from "~/lib/user-profile";

import { env } from "../env";
import type { TelegramUserLink } from "../identity";
import { filterUnseenListings, markListingsSeen } from "./seen";

export type RadarSender = (link: TelegramUserLink, text: string) => Promise<void>;

const MAX_LISTINGS_PER_ALERT = 3;

// The bot's UserProfile is a lighter shape than the SearchProfile table the
// web flow fills in. When no SearchProfile row exists we synthesize a scoring
// profile so radar still works for bot-only users.
function synthesizeSearchProfile(profile: {
  areas?: string[];
  budgetMinEur?: number;
  budgetMaxEur?: number;
  bedroomsMin?: number;
  workLocation?: string;
}): SearchProfile {
  return {
    id: "",
    userId: "",
    workAddress: profile.workLocation ?? "",
    workLat: null,
    workLon: null,
    maxCommuteMin: 45,
    neighbourhoods: profile.areas ?? [],
    minPriceEur: profile.budgetMinEur ?? 0,
    maxPriceEur: profile.budgetMaxEur ?? 0,
    minRooms: profile.bedroomsMin ?? 0,
    minM2: 0,
    moveDate: null,
    flexibleDays: 0,
    mustHaves: [],
    redLines: [],
    alertsEnabled: true,
    verified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function formatAlert(
  items: Array<{
    listing: { title: string; priceEur: number | null; neighbourhood: string | null; url: string };
    match: { score: number };
  }>,
): string {
  const lines = items.map(({ listing, match }) => {
    const price = listing.priceEur != null ? `${Math.round(listing.priceEur)}€/mo` : "price n/a";
    const area = listing.neighbourhood ?? "Barcelona";
    return `• ${listing.title} — ${price}, ${area} (match ${match.score}/100)\n${listing.url}`;
  });
  return `New matches for you:\n\n${lines.join("\n\n")}\n\nWant me to call the agency for any of these?`;
}

async function linkedUsers(): Promise<TelegramUserLink[]> {
  const rows = await client.unsafe<
    {
      username: string;
      telegram_user_id: string;
      chat_id: string;
      thread_id: string | null;
    }[]
  >(`SELECT username, telegram_user_id, chat_id, thread_id FROM bot.telegram_users`);
  return rows.map((row) => {
    return {
      username: row.username,
      userId: "",
      telegramUserId: row.telegram_user_id,
      chatId: row.chat_id,
      threadId: row.thread_id ?? "",
    };
  });
}

export function createRadar({ send }: { send: RadarSender }) {
  let timer: ReturnType<typeof setInterval> | undefined;

  async function runOnce(): Promise<{ alerted: number; scanned: number }> {
    const users = await linkedUsers();
    let alerted = 0;
    for (const link of users) {
      const user = await getUserByUsername(link.username);
      if (!user || missingProfileFields(user.profile).length > 0) {
        continue;
      }
      const profile = (await getProfile(user.id)) ?? synthesizeSearchProfile(user.profile ?? {});
      if (!profile.alertsEnabled) {
        continue;
      }
      const feed = await buildFeed(profile);
      const candidates = feed.items.filter((item) => item.match.score >= env.RADAR_MIN_SCORE);
      const unseenIds = await filterUnseenListings(
        link.username,
        candidates.map((item) => item.listing.id),
      );
      const fresh = candidates.filter((item) => unseenIds.includes(item.listing.id));
      if (fresh.length === 0) {
        continue;
      }
      const top = fresh.slice(0, MAX_LISTINGS_PER_ALERT);
      await send(link, formatAlert(top));
      // Mark every qualifying candidate seen, not just the three sent — the
      // rest are still "known" and must not trigger another alert next run.
      await markListingsSeen(
        link.username,
        fresh.map((item) => item.listing.id),
      );
      alerted += 1;
    }
    return { alerted, scanned: users.length };
  }

  return {
    runOnce,
    start() {
      timer = setInterval(() => {
        void runOnce().catch((error) => {
          console.error("[radar] run failed:", error);
        });
      }, env.RADAR_INTERVAL_MS);
      timer.unref();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
    },
  };
}
