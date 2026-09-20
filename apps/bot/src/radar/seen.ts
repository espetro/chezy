import { client } from "~/lib/db/client";

export async function filterUnseenListings(
  username: string,
  listingIds: string[],
): Promise<string[]> {
  if (listingIds.length === 0) {
    return [];
  }
  const rows = await client.unsafe<{ listing_id: string }[]>(
    `SELECT listing_id FROM bot.radar_seen WHERE username = $1 AND listing_id = ANY($2)`,
    [username, listingIds],
  );
  const seen = new Set(rows.map((r) => r.listing_id));
  return listingIds.filter((id) => !seen.has(id));
}

export async function markListingsSeen(username: string, listingIds: string[]): Promise<void> {
  for (const listingId of listingIds) {
    await client.unsafe(
      `INSERT INTO bot.radar_seen (username, listing_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [username, listingId],
    );
  }
}
