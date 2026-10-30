// Lab 4 — A11Y-01, A11Y-02 (docs/lab-04/tests.md)
import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { USERS, login, openStaffTicket } from "./helpers";

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}

test.describe("Lab 4 — Accessibility", () => {
  test("A11Y-01: no serious or critical axe violations on Lab 4 screens", async ({ page }) => {
    await login(page, USERS.staff);
    await expect(page.getByRole("button", { name: /^Unassigned: / })).toBeVisible();
    expect(await seriousViolations(page), "IT Staff dashboard").toEqual([]);

    await openStaffTicket(page, "TKT-2026-000001");
    await expect(page.getByText("Actions Taken").first()).toBeVisible();
    expect(await seriousViolations(page), "Ticket Detail + Actions Taken").toEqual([]);

    await page.getByRole("button", { name: "Logout" }).click();
    await login(page, USERS.requester);
    await expect(page.getByRole("button", { name: /^My Open Tickets: / })).toBeVisible();
    expect(await seriousViolations(page), "Requester dashboard").toEqual([]);
  });

  test("A11Y-02: keyboard only — dashboard card to filtered queue", async ({ page }) => {
    await login(page, USERS.staff);
    await expect(page.getByRole("button", { name: /^Unassigned: / })).toBeVisible();

    // Tab until the first metric card has focus, then activate it with Enter.
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
      const label = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
      if (label.startsWith("Unassigned:")) break;
    }
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    expect(focused).toMatch(/^Unassigned: \d+\. View list$/);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
  });

  test("A11Y-02: keyboard only — cancel dialog traps focus and Escape closes it", async ({ page }) => {
    await login(page, USERS.staff);
    await openStaffTicket(page, "TKT-2026-900005"); // Waiting for Requester → Cancel available
    const trigger = page.getByRole("button", { name: "Cancel ticket" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: /cancel this ticket/i })).toBeVisible();
    await expect(page.getByLabel(/reason/i)).toBeFocused();
    for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});
