import { mkdirSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";

// Mock provider only: ADAPTATION_MOCK_SCENARIO picks the labelled fixture the
// dev server was started with (valid | invalid_first | invalid_twice). The
// runner inherits .env.local through playwright.config.ts; an explicit env
// var wins. This spec never talks to Devin and is never the sponsor proof.
const scenario = process.env.ADAPTATION_MOCK_SCENARIO ?? "valid";
const SHOT_DIR = `/tmp/jes13-e2e/${scenario}`;
mkdirSync(SHOT_DIR, { recursive: true });

test.use({ viewport: { width: 390, height: 844 } });
test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  expect(process.env.ADAPTATION_MODE ?? "mock", "ADAPTATION_MODE must be mock for this e2e").toBe(
    "mock",
  );
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

async function resetAndLoadDemo(page: Page) {
  await page.goto("/onboarding");
  const demoTools = page.getByRole("region", { name: "Demo reset" });
  await demoTools.getByRole("button", { name: "Show" }).click();
  await demoTools.getByRole("button", { name: "Reset and load demo" }).click();
  await expect(page).toHaveURL(/\/explore$/, { timeout: 15_000 });
}

const carousel = (page: Page) => page.getByRole("region", { name: "Candidate matches" });
const firstSlide = (page: Page) => carousel(page).getByRole("group").first();
const status = (page: Page) => page.getByRole("region", { name: "Comparison status" });
// The live status line alone: the region also contains the opened Run trace, whose
// entries can satisfy a text assertion ahead of the line itself.
const statusLine = (page: Page) => status(page).getByRole("status");
const panel = (page: Page) => page.getByRole("region", { name: "Adaptive comparison" });

// Opens the run trace disclosure inside `scope` without toggling it closed.
const openTrace = async (scope: Locator) => {
  const details = scope.locator("details").filter({ hasText: "Run trace" });
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await details.locator("summary").click();
  }
  return scope.getByRole("list", { name: "Run trace" });
};

// Rejects the first card for a missing balcony, which starts the mock session.
async function rejectForMissingBalcony(page: Page) {
  const slide = firstSlide(page);
  await expect(slide).toBeVisible({ timeout: 15_000 });
  await slide.getByRole("button", { name: "Discard this candidate" }).click();
  await page
    .getByLabel("Refine the reason")
    .getByRole("button", { name: "Missing balcony" })
    .click();
  await expect(status(page)).toBeVisible({ timeout: 15_000 });
  await expect(status(page)).toContainText("Simulated:");
}

const EXHAUSTED =
  "Devin's corrected comparison still didn't match your listings. Your feed is unchanged.";

test.describe(`adaptive comparison, mock scenario ${scenario}`, () => {
  let consoleErrors: string[];

  test.beforeEach(async ({ page }) => {
    consoleErrors = collectConsoleErrors(page);
    await resetAndLoadDemo(page);
  });

  test.afterEach(() => {
    expect(consoleErrors).toEqual([]);
  });

  test.skip(scenario !== "valid", "valid scenario only");
  test("a valid first candidate is accepted and rendered from trusted data", async ({ page }) => {
    await rejectForMissingBalcony(page);
    await expect(panel(page)).toBeVisible({ timeout: 60_000 });
    if (process.env.FORGE_TRIGGER_MODE === "mock") {
      await expect(
        panel(page).getByRole("status").filter({ hasText: "Simulated: capability gap recorded" }),
      ).toBeVisible();
      const trace = await openTrace(panel(page));
      await expect(trace.locator("[data-step='capability_gap']")).toBeVisible();
    }
    await expect(panel(page)).toContainText("Accepted on the first attempt.");
    await expect(panel(page)).not.toContainText("Unknown listing");
    await expect(status(page)).toHaveCount(0);
    await page.screenshot({ path: `${SHOT_DIR}/panel.png`, fullPage: true });
  });
});

test.describe(`validator correction, mock scenario ${scenario}`, () => {
  test.skip(scenario !== "invalid_first", "invalid_first scenario only");

  test("the refused first candidate is corrected once and only the accepted one renders", async ({
    page,
  }) => {
    const consoleErrors = collectConsoleErrors(page);
    await resetAndLoadDemo(page);
    await rejectForMissingBalcony(page);

    await expect(status(page)).toContainText("refused Devin's first comparison", {
      timeout: 60_000,
    });
    await expect(status(page)).toContainText("Attempt 2 of 2.");
    // The refused candidate is never rendered while the correction is pending.
    await expect(panel(page)).toHaveCount(0);
    await page.screenshot({ path: `${SHOT_DIR}/correcting.png`, fullPage: true });

    await expect(panel(page)).toBeVisible({ timeout: 60_000 });
    await expect(panel(page)).toContainText(
      "Accepted on attempt 2 after the validator refused the first candidate.",
    );
    await expect(panel(page)).not.toContainText("Unknown listing");
    expect(await panel(page).getByRole("columnheader").count()).toBeGreaterThanOrEqual(3);
    await expect(panel(page).getByRole("row").filter({ hasText: "Balcony" })).toBeVisible();

    const trace = await openTrace(panel(page));
    await expect(trace.locator("[data-step='rejected']")).toContainText(
      /Validator refused candidate 1: .*unknown_listing/,
    );
    await expect(trace.locator("[data-step='correcting']")).toHaveCount(1);
    await expect(trace.locator("[data-step='accepted']")).toContainText("Candidate 2 accepted");
    await page.screenshot({ path: `${SHOT_DIR}/accepted-with-trace.png`, fullPage: true });

    // A reload keeps the accepted panel and starts nothing new.
    await page.reload();
    await expect(panel(page)).toBeVisible({ timeout: 15_000 });
    await expect(status(page)).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
  });
});

test.describe(`retry exhaustion, mock scenario ${scenario}`, () => {
  test.skip(scenario !== "invalid_twice", "invalid_twice scenario only");

  test("a second refusal fails, survives reload and offers one deliberate new attempt", async ({
    page,
  }) => {
    const consoleErrors = collectConsoleErrors(page);
    await resetAndLoadDemo(page);
    await rejectForMissingBalcony(page);

    await expect(statusLine(page)).toContainText(EXHAUSTED, { timeout: 90_000 });
    await expect(panel(page)).toHaveCount(0);
    const tryAgain = status(page).getByRole("button", { name: "Try again" });
    await expect(tryAgain).toBeVisible();
    // The feed stays usable behind the failure.
    await expect(firstSlide(page)).toBeVisible();
    await page.screenshot({ path: `${SHOT_DIR}/failed.png`, fullPage: true });

    // A refresh neither hides the failure nor starts a new attempt.
    await page.reload();
    await expect(statusLine(page)).toContainText(EXHAUSTED, { timeout: 15_000 });
    await expect(status(page).getByRole("button", { name: "Try again" })).toBeVisible();
    await expect((await openTrace(status(page))).locator("[data-step='retried']")).toHaveCount(0);

    await status(page).getByRole("button", { name: "Try again" }).click();
    await expect(statusLine(page)).toContainText(/Queued for Devin|Devin is building/, {
      timeout: 15_000,
    });
    await expect(statusLine(page)).toContainText(EXHAUSTED, { timeout: 90_000 });
    await expect(status(page).getByRole("button", { name: "Try again" })).toBeEnabled();
    const trace = await openTrace(status(page));
    await expect(trace.locator("[data-step='retried']")).toContainText(
      "New attempt started (run 2)",
    );
    await expect(trace.locator("[data-step='failed']")).toHaveCount(2);
    await expect(panel(page)).toHaveCount(0);
    await page.screenshot({ path: `${SHOT_DIR}/failed-after-retry.png`, fullPage: true });
    expect(consoleErrors).toEqual([]);
  });
});
