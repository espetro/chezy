import { eq } from "drizzle-orm";

import { db } from "~/lib/db/client";
import { listing, listingInsight } from "~/lib/db/schema";
import { ensureListingInsights } from "~/lib/insights";
import { INSIGHTS_PROMPT_VERSION } from "~/lib/vision/prompt";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const limit = arg("limit") ? Number(arg("limit")) : undefined;
const force = process.argv.includes("--force");
const concurrency = Number(arg("concurrency") ?? 6);
const modelId = arg("model");

const allIds = (await db.select({ id: listing.id }).from(listing)).map(
  (r) => r.id,
);
const done = new Set(
  (
    await db
      .select({ listingId: listingInsight.listingId })
      .from(listingInsight)
      .where(eq(listingInsight.promptVersion, INSIGHTS_PROMPT_VERSION))
  ).map((r) => r.listingId),
);
const targets = (force ? allIds : allIds.filter((id) => !done.has(id))).slice(
  0,
  limit,
);

console.log(
  `enriching ${targets.length} listings (concurrency ${concurrency}${force ? ", force" : ""}${modelId ? `, model ${modelId}` : ""})`,
);

let ok = 0;
let fail = 0;
let promptTokens = 0;
let completionTokens = 0;
const started = Date.now();
const queue = [...targets];

async function worker() {
  for (;;) {
    const id = queue.shift();
    if (!id) {
      return;
    }
    const t0 = Date.now();
    try {
      await ensureListingInsights(id, { force, modelId });
      const rows = await db
        .select({
          promptTokens: listingInsight.promptTokens,
          completionTokens: listingInsight.completionTokens,
        })
        .from(listingInsight)
        .where(eq(listingInsight.listingId, id));
      const ms = Date.now() - t0;
      promptTokens += rows[0]?.promptTokens ?? 0;
      completionTokens += rows[0]?.completionTokens ?? 0;
      ok++;
      console.log(`ok ${id} ${ms}ms ${rows[0]?.promptTokens ?? 0} promptTok`);
    } catch (error) {
      fail++;
      console.log(
        `fail ${id} ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

console.log(
  `done: ${ok} ok, ${fail} fail, ${promptTokens} prompt tokens, ${completionTokens} completion tokens, ${Math.round((Date.now() - started) / 1000)}s`,
);
