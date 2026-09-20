import { mkdirSync, writeFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

// Drives one genuine run against the Devin API through the real UI and keeps
// screenshots of every state it observes. Opt-in only: the dev server must run
// with ADAPTATION_MODE=devin and this file is executed with LIVE_ADAPTATION=1.
// Nothing here stages a failure; whatever Devin answers is what gets recorded.
const live = process.env.LIVE_ADAPTATION === "1";
const SHOT_DIR = process.env.LIVE_ADAPTATION_DIR ?? "/tmp/jes13-live";
const RUN_TIMEOUT_MS = 15 * 60_000;
// Which structured reason the run refines the card-level rejection to.
const REASON = process.env.LIVE_ADAPTATION_REASON ?? "Missing balcony";

test.skip(!live, "set LIVE_ADAPTATION=1 against a devin-mode dev server");
test.use({ viewport: { width: 390, height: 844 } });

const status = (page: Page) => page.getByRole("region", { name: "Comparison status" });
const panel = (page: Page) => page.getByRole("region", { name: "Adaptive comparison" });

test("one live Devin run: trigger, validate, correct if refused, accept or fail", async ({
  page,
}) => {
  test.setTimeout(RUN_TIMEOUT_MS + 60_000);
  mkdirSync(SHOT_DIR, { recursive: true });
  const observed: { at: string; text: string }[] = [];

  await page.goto("/onboarding");
  const demoTools = page.getByRole("region", { name: "Demo reset" });
  await demoTools.getByRole("button", { name: "Show" }).click();
  await demoTools.getByRole("button", { name: "Reset and load demo" }).click();
  await expect(page).toHaveURL(/\/explore$/, { timeout: 15_000 });

  const slide = page.getByRole("region", { name: "Candidate matches" }).getByRole("group").first();
  await expect(slide).toBeVisible({ timeout: 15_000 });
  await slide.getByRole("button", { name: "Discard this candidate" }).click();
  await page.getByLabel("Refine the reason").getByRole("button", { name: REASON }).click();
  await expect(status(page)).toBeVisible({ timeout: 15_000 });
  await expect(status(page)).not.toContainText("Simulated");
  await page.screenshot({ path: `${SHOT_DIR}/01-triggered.png`, fullPage: true });

  const started = Date.now();
  let last = "";
  let shot = 2;
  while (Date.now() - started < RUN_TIMEOUT_MS) {
    if (await panel(page).isVisible()) break;
    // The status line unmounts for a moment between "ready" and the refresh
    // that renders the panel; an empty read is not a state change.
    const text = (
      await status(page)
        .innerText({ timeout: 2000 })
        .catch(() => "")
    )
      .replace(/\s+/g, " ")
      .trim();
    if (text !== "" && text !== last) {
      observed.push({ at: new Date().toISOString(), text });
      await page.screenshot({
        path: `${SHOT_DIR}/${String(shot).padStart(2, "0")}-status.png`,
        fullPage: true,
      });
      shot += 1;
      last = text;
      if (/Your feed is unchanged|Timed out|without a result|did not match/.test(text)) break;
    }
    await page.waitForTimeout(3000);
  }

  const accepted = await panel(page).isVisible();
  if (accepted) {
    await expect(panel(page)).toContainText("Built by a Devin session from your rejection.");
    const details = panel(page).locator("details").filter({ hasText: "Run trace" });
    await details.locator("summary").click();
    await page.screenshot({ path: `${SHOT_DIR}/99-accepted.png`, fullPage: true });
    observed.push({ at: new Date().toISOString(), text: await panel(page).innerText() });
  } else {
    await page.screenshot({ path: `${SHOT_DIR}/99-final.png`, fullPage: true });
  }
  writeFileSync(
    `${SHOT_DIR}/observed.json`,
    `${JSON.stringify({ accepted, observed }, undefined, 2)}\n`,
  );
  expect(observed.length).toBeGreaterThan(0);
});
