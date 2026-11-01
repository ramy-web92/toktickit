import { test, expect } from "@playwright/test";

// Lab 3 E2E, updated in Lab 4 (final regression): users now land on the Dashboard,
// so assertions use roles/labels instead of loose text matches.
test.describe("Lab 3 — Authentication", () => {
  async function signIn(page: import("@playwright/test").Page, email: string, password = "Password123!") {
    await page.goto("/");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.getByRole("button", { name: "Sign In" }).click();
  }

  test("E2E-01: Valid login redirects to role home", async ({ page }) => {
    await signIn(page, "jennifer.anderson@example.com");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("button", { name: "My Tickets" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Jennifer Anderson", { exact: false }).first()).toBeVisible();
    await expect(page.locator("header .badge")).toHaveText("Requester");
  });

  test("E2E-02: Invalid login shows generic error", async ({ page }) => {
    await signIn(page, "jennifer.anderson@example.com", "WrongPassword!");
    await expect(page.getByText("Invalid email or password")).toBeVisible({ timeout: 10000 });
  });

  test("E2E-03: Logout blocks access to protected pages", async ({ page }) => {
    await signIn(page, "jennifer.anderson@example.com");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
  });

  test("E2E-04: First-login password change required", async ({ page }) => {
    // paul.martin is seeded with mustChangePassword = true (Lab 4 seed)
    await signIn(page, "paul.martin@example.com");
    await expect(page.getByText("You must change your password to continue")).toBeVisible({ timeout: 10000 });
  });
});
