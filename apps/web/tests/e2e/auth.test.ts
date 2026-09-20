import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test.describe("Authentication Pages", () => {
  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  });

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign up" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("can navigate from login to register", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL("/register");
  });

  test("can navigate from register to login", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/login");
  });

  // The guest escape hatch exists so the live demo never has to type credentials.
  test("guest link enters onboarding without an account", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: "Explore as a guest" }).click();
    await expect(page).toHaveURL(/\/onboarding/);
  });

  // Regression: before this, register signed the user in and proxy.ts bounced the
  // now non-guest session back to the landing page instead of into the flow.
  test("registering lands in onboarding", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Email").fill(`e2e-${Date.now()}@chezy.test`);
    await page.getByLabel("Password").fill("chezy-e2e-pw");
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: "Let's go" })).toBeVisible();
  });

  test("rejects a password under six characters without leaving the page", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Email").fill(`e2e-${Date.now()}@chezy.test`);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Sign up" }).click();

    await expect(page.getByRole("alert")).toContainText("6+ characters");
    await expect(page).toHaveURL(/\/register/);
  });
});
