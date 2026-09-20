import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";

const SHOT_DIR = "/tmp/card-actions";

test.use({ viewport: { width: 390, height: 844 } });
// Every case mutates the same guest's feedback / saved state.
test.describe.configure({ mode: "serial" });

// The card actions only exercise the mock viewing flow.
test.beforeAll(() => {
  const envLocal = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  const viewingMode = envLocal.match(/^VIEWING_MODE=(.*)$/m)?.[1]?.trim();
  expect(viewingMode ?? "mock", "VIEWING_MODE must be mock for this e2e").toBe("mock");
});

const TOLERATED_ERRORS: RegExp[] = [
  /react-devtools/i,
  /Failed to load resource.*(fotocasa|idealista|inmuebles|img\..*\.)/i,
];

const collectConsoleErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !TOLERATED_ERRORS.some((re) => re.test(msg.text()))) {
      errors.push(msg.text());
    }
  });
  return errors;
};

// Deterministic profile + cleared feedback/saves via the JES-5 demo tools.
async function resetAndLoadDemo(page: Page) {
  await page.goto("/onboarding");
  const demoTools = page.getByRole("region", { name: "Demo reset" });
  await demoTools.getByRole("button", { name: "Show" }).click();
  await demoTools.getByRole("button", { name: "Reset and load demo" }).click();
  await expect(page).toHaveURL(/\/explore$/, { timeout: 15_000 });
}

const carousel = (page: Page) => page.getByRole("region", { name: "Candidate matches" });
const firstSlide = (page: Page) => carousel(page).getByRole("group").first();

test.describe("explore card actions", () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await resetAndLoadDemo(page);
    await expect(firstSlide(page)).toBeVisible({ timeout: 15_000 });
  });

  test.afterEach(() => {
    expect(consoleErrors).toEqual([]);
  });

  test("heart saves a listing for the session", async ({ page }) => {
    const slide = firstSlide(page);
    const href = await slide.locator("a[href^='/explore/']").getAttribute("href");
    const save = slide.getByRole("button", { name: "Save this listing" });
    // The heart is optimistic; wait for the PUT so the reload below sees the persisted state.
    const persisted = page.waitForResponse(
      (response) => response.url().includes("/api/saved") && response.request().method() === "PUT",
    );
    await save.click();
    const saved = slide.getByRole("button", { name: "Remove from saved" });
    await expect(saved).toHaveAttribute("aria-pressed", "true");
    expect((await persisted).status()).toBe(200);
    await page.screenshot({ path: `${SHOT_DIR}/explore-mobile.png` });

    await page.reload();
    await expect(firstSlide(page)).toBeVisible({ timeout: 15_000 });
    const reloadedSlide = page.locator("article", { has: page.locator(`a[href="${href}"]`) });
    const stillSaved = reloadedSlide.getByRole("button", { name: "Remove from saved" });
    await expect(stillSaved).toHaveAttribute("aria-pressed", "true");

    const removed = page.waitForResponse(
      (response) => response.url().includes("/api/saved") && response.request().method() === "PUT",
    );
    await stillSaved.click();
    expect((await removed).status()).toBe(200);
    await expect(reloadedSlide.getByRole("button", { name: "Save this listing" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("X hides a candidate, persists, can be refined and undone", async ({ page }) => {
    const slide = firstSlide(page);
    const href = await slide.locator("a[href^='/explore/']").getAttribute("href");
    expect(href).toBeTruthy();
    const hiddenCard = page.locator(`a[href='${href}']`);

    await slide.getByRole("button", { name: "Discard this candidate" }).click();
    await expect(hiddenCard).toHaveCount(0);
    await expect(page.getByText("Candidate hidden. No ranking change.")).toBeVisible();
    const refine = page.getByLabel("Refine the reason");
    await expect(refine.getByRole("button", { name: "Too expensive" })).toBeVisible();
    await expect(refine.getByRole("button", { name: "Wrong area" })).toBeVisible();
    await expect(refine.getByRole("button", { name: "Missing balcony" })).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/after-dismiss.png` });

    await page.reload();
    await expect(firstSlide(page)).toBeVisible({ timeout: 15_000 });
    await expect(hiddenCard).toHaveCount(0);

    await page
      .getByLabel("Refine the reason")
      .getByRole("button", { name: "Too expensive" })
      .click();
    await expect(
      page.getByText(/Lower known rents moved up in your comparison|Candidate hidden\. Its rent/),
    ).toBeVisible();
    await expect(page.getByLabel("Refine the reason")).toHaveCount(0);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(hiddenCard).toBeVisible({ timeout: 15_000 });
  });

  test("Book a visit from the card calls, books and remembers the slot", async ({ page }) => {
    const slide = firstSlide(page);
    await slide.getByRole("button", { name: "Book a visit" }).click();
    await expect(slide.getByRole("button", { name: "Calling…" })).toBeVisible();
    const booked = slide.getByText(/^Booked · /);
    await expect(booked).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Simulated/)).toHaveCount(0);
    await page.screenshot({ path: `${SHOT_DIR}/after-book.png` });

    await page.reload();
    await expect(firstSlide(page).getByText(/^Booked · /)).toBeVisible({ timeout: 15_000 });
  });

  test("detail page still offers the reason picker with Other last", async ({ page }) => {
    await firstSlide(page).locator("a[href^='/explore/']").click();
    await expect(page).toHaveURL(/\/explore\/.+/);
    await page.screenshot({ path: `${SHOT_DIR}/match-header-mobile.png` });

    await page.getByRole("button", { name: /^Not for me/ }).click();
    const reasons = page.getByRole("group", { name: "What would you change?" });
    const labels = await reasons.getByRole("button").allInnerTexts();
    expect(labels).toEqual(["Too expensive", "Wrong area", "Missing balcony", "Other", "Cancel"]);
    await reasons.getByRole("button", { name: "Wrong area" }).click();
    await expect(
      page.getByText("Candidate rejected. Your comparison has been updated."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: /^Not for me/ })).toBeVisible();
  });

  test("API ownership and validation", async ({ page, request }) => {
    // Without a session the auth proxy redirects to the GET-only guest route
    // (405) before the handler's own 401; either way nothing is saved.
    const anonymous = await request.put("/api/saved", {
      data: { listingId: "fotocasa:1", saved: true },
    });
    expect(anonymous.ok()).toBe(false);
    const list = await page.request.get("/api/saved");
    expect(((await list.json()) as { listingIds: string[] }).listingIds).not.toContain(
      "fotocasa:1",
    );

    const invalid = await page.request.put("/api/saved", { data: { listingId: "" } });
    expect(invalid.status()).toBe(400);

    const missing = await page.request.patch("/api/feedback", {
      data: { eventId: "550e8400-e29b-41d4-a716-446655440000", reason: "wrong_area" },
    });
    expect(missing.status()).toBe(404);
  });
});

test.describe("explore card actions (desktop)", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("renders the action row on every card", async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await resetAndLoadDemo(page);
    const slide = firstSlide(page);
    await expect(slide).toBeVisible({ timeout: 15_000 });
    await expect(slide.getByRole("button", { name: "Book a visit" })).toBeVisible();
    await expect(slide.getByRole("button", { name: "Save this listing" })).toBeVisible();
    await expect(slide.getByRole("button", { name: "Discard this candidate" })).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/explore-desktop.png`, fullPage: true });
    expect(consoleErrors).toEqual([]);
  });
});
