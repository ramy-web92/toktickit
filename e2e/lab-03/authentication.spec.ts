import { test, expect } from "@playwright/test";

test.describe("Lab 3 — Authentication", () => {

  test("E2E-01: Valid login redirects to role home", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[type="email"]', "jennifer.anderson@example.com");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button:has-text("Sign In")');
    await expect(page.locator("text=My Tickets")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=Jennifer Anderson")).toBeVisible();
    await expect(page.locator("text=REQUESTER")).toBeVisible();
  });

  test("E2E-02: Invalid login shows generic error", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[type="email"]', "jennifer.anderson@example.com");
    await page.fill('input[type="password"]', "WrongPassword!");
    await page.click('button:has-text("Sign In")');
    await expect(page.locator("text=Invalid email or password")).toBeVisible({ timeout: 10000 });
  });

  test("E2E-03: Logout blocks access to protected pages", async ({ page }) => {
    await page.goto("/");
    await page.fill('input[type="email"]', "jennifer.anderson@example.com");
    await page.fill('input[type="password"]', "Password123!");
    await page.click('button:has-text("Sign In")');
    await expect(page.locator("text=My Tickets")).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Logout")');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
  });

});