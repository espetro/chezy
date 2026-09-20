import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const SHOT_DIR = "/tmp/flow-ui";

test.use({ viewport: { width: 390, height: 844 } });

// The happy path only works against the mock viewing flow; fail fast if the
// dev server was started with VIEWING_MODE=slng.
test.beforeAll(() => {
  mkdirSync(SHOT_DIR, { recursive: true });
  const envLocal = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
  const viewingMode = envLocal.match(/^VIEWING_MODE=(.*)$/m)?.[1]?.trim();
  expect(
    viewingMode ?? "mock",
    "VIEWING_MODE=slng in apps/web/.env.local: this e2e requires the mock viewing flow",
  ).not.toBe("slng");
});

// Known noisy console sources that are tolerated (one line per reason).
const TOLERATED_ERRORS: RegExp[] = [
  // React DevTools banner can surface as console noise in dev builds.
  /react-devtools/i,
  // Candidate photos come from third-party portal CDNs; offline/sandboxed
  // runs can fail image loads without affecting the flow.
  /Failed to load resource.*(fotocasa|idealista|inmuebles|img\..*\.)/i,
];

// Deterministic profile state: the JES-5 demo tools load the fixture persona
// (Poblenou + Sant Martí, €1,500-2,500) and land on /explore.
async function resetAndLoadDemo(page: Page) {
  await page.goto("/onboarding");
  // Role query, not a raw selector: the Suspense fallback briefly leaves a
  // hidden duplicate <section> in the DOM during hydration.
  const demoTools = page.getByRole("region", { name: "Demo reset" });
  await demoTools.getByRole("button", { name: "Show" }).click();
  await demoTools.getByRole("button", { name: "Reset and load demo" }).click();
  await expect(page).toHaveURL(/\/explore$/, { timeout: 15_000 });
}

// The sticky bars live in OnboardingFlow (.sticky.top-0 stepper) and
// FlowStickyActionBar (.sticky.bottom-0 CTA). body overflow must be visible
// for either to stick to the viewport.
const stickyProbe = (page: Page) =>
  page.evaluate(() => {
    const top = document.querySelector<HTMLElement>(".sticky.top-0");
    const bottom = document.querySelector<HTMLElement>(".sticky.bottom-0");
    return {
      bodyOverflowY: getComputedStyle(document.body).overflowY,
      topBarTop: top ? Math.round(top.getBoundingClientRect().top) : undefined,
      bottomBarBottom: bottom ? Math.round(bottom.getBoundingClientRect().bottom) : undefined,
      innerHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    };
  });

const expectNoHorizontalScroll = async (page: Page) => {
  const { scrollWidth, innerWidth } = await stickyProbe(page);
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
};

test.describe("flow happy path", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await resetAndLoadDemo(page);
  });

  test("landing → onboarding → explore → match detail → simulated viewing call", async ({
    page,
    browser,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !TOLERATED_ERRORS.some((re) => re.test(msg.text()))) {
        consoleErrors.push(msg.text());
      }
    });

    // 0. A guest without a profile cannot skip onboarding.
    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await freshPage.goto("/explore");
    // CHEZY_SKIP_ONBOARDING=1 (dev shortcut) auto-loads the demo persona instead.
    const envLocal = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
    const skipOnboarding = /^CHEZY_SKIP_ONBOARDING="?1"?$/m.test(envLocal);
    await expect(freshPage).toHaveURL(skipOnboarding ? /\/explore$/ : /\/onboarding/);
    await fresh.close();

    // 1. / landing → "Find my home". Flow routes carry the flow title.
    await page.goto("/");
    await expect(page).toHaveTitle("Chezy — your rental agent");
    await expectNoHorizontalScroll(page);
    await page.getByRole("link", { name: "Find my home" }).click();
    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page).toHaveTitle("Chezy — your rental agent");

    // 2. Welcome step → "Let's go". Step order per lib/flow/onboarding-steps.ts:
    // welcome → budget → moveIn → mustHaves → routine → dealBreakers → autonomy → summary.
    await page.getByRole("button", { name: "Let's go" }).click();

    // 3. Budget & space: the persona's values are prefilled → Continue.
    await expect(page.getByText("1. Budget & space")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${SHOT_DIR}/onboarding-budget-mobile.png` });
    await page.getByRole("button", { name: "Continue" }).click();

    // 4. Move-in: Flexible (the persona's mode, re-asserted).
    await page.getByRole("radio", { name: /Flexible/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 5. Must-haves → Continue.
    await page.getByRole("button", { name: "Continue" }).click();

    // 6. Routine: persona zones are preselected; add an address + commute cap.
    await expect(page.getByText("4. Routine & area")).toBeVisible();
    // The persona's "Sant Martí" maps to a district chip ("Poblenou" is a
    // neighbourhood, not a chip value).
    await expect(page.getByRole("button", { name: "Sant Martí" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByLabel(/Work or study address/).fill("Diagonal 405");
    await page.getByRole("radio", { name: "25 min" }).click();

    // Sticky-bar probe needs a step taller than the viewport; shrink the
    // viewport if this step happens to fit.
    if ((await stickyProbe(page)).scrollHeight <= (await stickyProbe(page)).innerHeight) {
      await page.setViewportSize({ width: 390, height: 500 });
    }
    let probe = await stickyProbe(page);
    expect(probe.bodyOverflowY).toBe("visible");
    // Unscrolled with overflowing content, the bottom CTA sticks to the viewport bottom.
    expect(probe.bottomBarBottom).toBe(probe.innerHeight);
    await page.mouse.wheel(0, 200);
    probe = await stickyProbe(page);
    // The stepper sticks to the top while scrolling.
    expect(probe.topBarTop).toBe(0);
    await page.setViewportSize({ width: 390, height: 844 });

    // The sticky counter must show a live number.
    await expect(page.getByText(/\d+ listings? match(?:es)? right now/)).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // 7. Dealbreakers → Continue. 8. Autonomy → confirm. 9. Summary → search.
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Confirm autonomy level/ }).click();
    await page.getByRole("button", { name: /Start searching/ }).click();

    // 10. Explore: at least one candidate card, no overflow at 390px.
    await expect(page).toHaveURL(/\/explore$/, { timeout: 15_000 });
    const firstCard = page.locator("a[href^='/explore/']").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    await expectNoHorizontalScroll(page);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({ path: `${SHOT_DIR}/explore-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });

    // 11. Detail: grounded explanation panel (JES-7) renders deterministic reasons.
    await firstCard.click();
    await expect(page).toHaveURL(/\/explore\/.+/);
    await expect(page.locator('[aria-label="Match explanation"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "Why this home" })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.screenshot({ path: `${SHOT_DIR}/match-mobile.png` });

    // 12. Call gate: ≥95% matches call on mount, lower scores offer "Call the
    // agency". A retryable failure (e.g. a dropped request) is not a live
    // attempt, so the button comes back; click it when offered. The mock call
    // hands its slot to /api/calendar and the gate lands on "Visit booked".
    const callButton = page.getByRole("button", { name: "Call the agency" });
    const calling = page.getByText("Calling the agency");
    const booked = page.getByText("Visit booked", { exact: true });
    await expect(page.getByText("Demo", { exact: true })).toBeVisible();
    await expect(calling.or(booked).or(callButton)).toBeVisible({ timeout: 15_000 });
    if (await callButton.isVisible()) {
      await callButton.click();
      await expect(calling).toBeVisible();
    }
    await expect(booked).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("added to your calendar")).toBeVisible();
    await expect(page.getByText(/Simulated|No phone call/)).toHaveCount(0);
    await page.screenshot({ path: `${SHOT_DIR}/match-booked.png` });

    // The booking receipt survives a reload (checkpoint 4).
    await page.reload();
    await expect(booked).toBeVisible({ timeout: 15_000 });

    // 13. No console errors during the whole run (hydration mismatches included).
    expect(consoleErrors).toEqual([]);
  });
});
