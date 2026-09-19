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
];

test.describe("onboarding happy path", () => {
  test("landing → preferences → verify → feed → viewing → detail", async ({
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

    // 1. Landing: h1 + barrio input + CTA.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Tu agente autónomo/ }),
    ).toBeVisible();
    await page.getByPlaceholder(/barrio preferido/).fill("Gràcia");
    await page.getByRole("button", { name: /Activar mi Agente/ }).click();

    // 2. Preferences: Gràcia chip preselected, submit.
    await expect(page).toHaveURL(/\/onboarding\/preferences/);
    await expect(
      page.getByRole("button", { name: "Gràcia", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByRole("button", { name: /Guardar y Continuar/ })
      .click();

    // 3. Verify: consent + activate.
    await expect(page).toHaveURL(/\/onboarding\/verify/);
    await page.getByText(/Autorizo a Chezy/).click();
    await page
      .getByRole("button", { name: /Activar Agente Autónomo/ })
      .click();

    // 4. Feed: at least one card, request a viewing.
    await expect(page).toHaveURL(/\/feed/);
    const cards = page.getByTestId("listing-card");
    await expect(cards.first()).toBeVisible();
    await cards
      .first()
      .getByRole("button", { name: /Reservar visita con Chezy/ })
      .click();
    await expect(
      cards.first().getByText(/Visita pre-agendada/),
    ).toBeVisible({ timeout: 10_000 });

    // 5. Detail page via the card title (the cover is a bare <a> child of
    // <article>; the title link sits inside the body div).
    const titleLink = cards.first().locator("div a[href^='/listing/']");
    await titleLink.click();
    await expect(page).toHaveURL(/\/listing\//);
    await expect(
      page
        .getByText("Perfil del Barrio")
        .or(page.getByText(/€\s*\/\s*mes/))
        .first(),
    ).toBeVisible();
    await page.goBack();

    // 6. No console errors during the whole run.
    expect(consoleErrors).toEqual([]);
  });
});
