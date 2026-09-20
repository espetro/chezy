import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const SHOT_DIR = "/tmp/chat-launcher";

// The send flow needs a working model key; read .env.local the same way
// flow-happy-path.test.ts does (playwright.config.ts also dotenv-loads it, but a
// key can be set-and-empty, so check the file).
const envLocal = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
const hasModelKey = /^OPENAI_COMPATIBLE_API_KEY=\S+/m.test(envLocal);

// Known noisy console sources that are tolerated (one line per reason).
const TOLERATED_ERRORS: RegExp[] = [
  // React DevTools banner can surface as console noise in dev builds.
  /react-devtools/i,
  // Candidate photos come from third-party portal CDNs; offline/sandboxed
  // runs can fail image loads without affecting the flow.
  /Failed to load resource.*(fotocasa|idealista|inmuebles|img\..*\.)/i,
];

function collectConsoleErrors(page: import("@playwright/test").Page) {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !TOLERATED_ERRORS.some((re) => re.test(msg.text()))) {
      consoleErrors.push(msg.text());
    }
  });
  return consoleErrors;
}

test.beforeAll(() => {
  mkdirSync(SHOT_DIR, { recursive: true });
});

// /explore redirects to /onboarding for guests without a profile; walk the
// onboarding steps (order per lib/flow/onboarding-steps.ts: welcome → budget →
// moveIn → mustHaves → routine → dealBreakers → autonomy → summary) to land on
// /explore.
async function completeOnboarding(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("link", { name: "Find my home" }).click();
  await page.getByRole("button", { name: "Let's go" }).click();

  // Budget & space: defaults are fine.
  await page.getByRole("button", { name: "Continue" }).click();

  // Move-in.
  await page.getByRole("radio", { name: /Flexible/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Must-haves: none required.
  await page.getByRole("button", { name: "Continue" }).click();

  // Routine & area: address + commute + a zone chip.
  await page.getByLabel(/Work or study address/).fill("Diagonal 405");
  await page.getByRole("radio", { name: "25 min" }).click();
  await page.getByRole("button", { name: "Gràcia", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Dealbreakers: defaults selected.
  await page.getByRole("button", { name: "Continue" }).click();

  // Autonomy (default cowork) → confirm, then start searching.
  await page.getByRole("button", { name: /Confirm autonomy level/ }).click();
  await page.getByRole("button", { name: /Start searching/ }).click();
  await expect(page).toHaveURL(/\/explore$/, { timeout: 15_000 });
}

test.describe("flow chat launcher (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("opens and closes the chat drawer on the landing page", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);

    await page.goto("/");
    const launcher = page.getByRole("button", { name: "Chat with Chezy" });
    await expect(launcher).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/landing-desktop.png` });

    await launcher.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Chezy", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Ask anything about your search")).toBeVisible();

    const input = dialog.getByTestId("multimodal-input");
    await expect(input).toBeVisible({ timeout: 15000 });
    await input.focus();
    await expect(input).toBeFocused();
    await page.screenshot({ path: `${SHOT_DIR}/drawer-open-desktop.png` });

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(launcher).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });
});

test.describe("flow chat launcher (mobile)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("visibility and offsets across the flow", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    const launcher = page.getByRole("button", { name: "Chat with Chezy" });

    await completeOnboarding(page);
    await expect(launcher).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/explore-mobile.png` });

    await page.goto("/onboarding");
    await expect(launcher).toHaveCount(0);

    await page.goto("/explore");
    const firstListing = page.locator("a[href^='/explore/']").first();
    await firstListing.click();
    await expect(page).toHaveURL(/\/explore\/.+/);

    const launcherBox = await launcher.boundingBox();
    // The fixed mobile action bar in MatchDetail wraps the "Review viewing options" anchor.
    const actionsBar = page.locator("a[href='#agency-actions']");
    await expect(actionsBar).toBeVisible();
    const barBox = await actionsBar.boundingBox();
    expect(launcherBox).not.toBeNull();
    expect(barBox).not.toBeNull();
    // Launcher bottom edge must sit above the fixed mobile action bar.
    expect((launcherBox?.y ?? 0) + (launcherBox?.height ?? 0)).toBeLessThanOrEqual(
      (barBox?.y ?? 0) + 1,
    );
    await page.screenshot({ path: `${SHOT_DIR}/match-mobile.png` });

    await launcher.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Full-width on phones; the chat input is the last thing to hydrate.
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox?.width).toBe(390);
    await expect(dialog.getByTestId("multimodal-input")).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${SHOT_DIR}/drawer-open-mobile.png` });

    expect(consoleErrors).toEqual([]);
  });

  test("sends a message from the drawer", async ({ page }) => {
    test.skip(!hasModelKey, "requires OPENAI_COMPATIBLE_API_KEY in apps/web/.env.local");
    const consoleErrors = collectConsoleErrors(page);

    await completeOnboarding(page);
    await page.getByRole("button", { name: "Chat with Chezy" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const input = dialog.getByTestId("multimodal-input");
    await expect(input).toBeVisible({ timeout: 15000 });
    await input.fill("What neighbourhoods am I searching in?");
    await dialog.getByTestId("send-button").click();

    const userMessage = dialog.getByTestId("message-user");
    await expect(userMessage).toBeVisible();
    await expect(userMessage).toContainText("What neighbourhoods am I searching in?");

    await expect(dialog.getByTestId("message-assistant")).toBeVisible({ timeout: 60000 });
    // Embedded mode must not rewrite the host URL to /chat/[id].
    await expect(page).toHaveURL(/\/explore$/);

    expect(consoleErrors).toEqual([]);
  });
});
