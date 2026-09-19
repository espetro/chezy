import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

// The happy path only works against the mock viewing flow; fail fast if the
// dev server was started with VIEWING_MODE=slng.
test.beforeAll(() => {
  const envLocal = readFileSync(
    path.resolve(process.cwd(), ".env.local"),
    "utf8",
  );
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

test.describe("flow happy path", () => {
  test("landing → onboarding → explore → match detail → viewing call", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        !TOLERATED_ERRORS.some((re) => re.test(msg.text()))
      ) {
        consoleErrors.push(msg.text());
      }
    });

    // 1. / landing → "Find my home".
    await page.goto("/");
    await page.getByRole("link", { name: "Find my home" }).click();
    await expect(page).toHaveURL(/\/onboarding/);

    // 2. Welcome step → "Let's go".
    await page.getByRole("button", { name: "Let's go" }).click();

    // 3. Routine: address + 25 min commute + Gràcia chip.
    await page
      .getByLabel(/Work or study address/)
      .fill("Diagonal 405");
    await page.getByRole("radio", { name: "25 min" }).click();
    await page
      .getByRole("button", { name: "Gràcia", exact: true })
      .click();

    // The sticky counter must show a live number.
    await expect(
      page.getByText(/\d+ listings? match(?:es)? right now/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();

    // 4. Budget & space: defaults are fine → Continue.
    await page.getByRole("button", { name: "Continue" }).click();

    // 5. Move-in: Flexible.
    await page.getByRole("radio", { name: /Flexible/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 6. Must-haves → Continue. 7. Dealbreakers → Continue.
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    // 8. Autonomy (default cowork) → confirm, then start searching.
    await page
      .getByRole("button", { name: /Confirm autonomy level/ })
      .click();
    await page.getByRole("button", { name: /Start searching/ }).click();

    // 9. Explore: at least one candidate card.
    await expect(page).toHaveURL(/\/explore$/, { timeout: 15_000 });
    const firstCard = page.locator("a[href^='/explore/']").first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    // 10. Detail: match reasoning visible.
    await firstCard.click();
    await expect(page).toHaveURL(/\/explore\/.+/);
    await expect(page.getByText("Why it's a match")).toBeVisible();

    // 11. Call gate: either it auto-called (≥95%) or we click the button.
    const callNow = page.getByRole("button", { name: "Call the agency now" });
    if (await callNow.isVisible()) {
      await callNow.click();
    }
    await expect(
      page.getByText(/Visit booked|Live call in progress/),
    ).toBeVisible({ timeout: 10_000 });

    // 12. No console errors during the whole run.
    expect(consoleErrors).toEqual([]);
  });
});
