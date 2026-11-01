// Lab 4 — E2E-06, E2E-07, E2E-08 (docs/lab-04/tests.md)
import { test, expect, Page } from "@playwright/test";
import { USERS, apiAs, createTicketAs, login } from "./helpers";

async function cardValue(page: Page, label: string): Promise<number> {
  const card = page.getByRole("button", { name: new RegExp(`^${label}: \\d+\\. View list$`) });
  const name = (await card.getAttribute("aria-label")) ?? "";
  return Number(name.match(/: (\d+)\./)?.[1]);
}

async function listCount(page: Page): Promise<number> {
  const text = await page.getByText(/\(\d+ tickets?\)/).textContent();
  return Number(text?.match(/\((\d+) tickets?\)/)?.[1]);
}

test.describe("Lab 4 — Dashboards", () => {
  test("E2E-06: Requester card drill-down shows the same count (AC-02, AC-17)", async ({ page }) => {
    await login(page, USERS.requester);
    const value = await cardValue(page, "My Open Tickets");
    expect(value).toBeGreaterThan(0);
    await page.getByRole("button", { name: /^My Open Tickets: / }).click();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "My Tickets" })).toHaveAttribute("aria-current", "page");
    expect(await listCount(page)).toBe(value);
  });

  test("E2E-07: every IT Staff card drills down to the same count in the queue (AC-15, AC-17)", async ({ page }) => {
    await login(page, USERS.staff);
    for (const label of ["Unassigned", "My Assigned", "Tickets with My Open Actions", "Follow-ups Pending"]) {
      await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Dashboard" }).click();
      const value = await cardValue(page, label);
      await page.getByRole("button", { name: new RegExp(`^${label}: `) }).click();
      await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
      if (value === 0) {
        await expect(page.getByText(/no tickets/i).first()).toBeVisible();
      } else {
        expect(await listCount(page), label).toBe(value);
      }
    }
  });

  test("E2E-08: a Requester cannot open another Requester's Ticket (AC-24)", async () => {
    const other = await createTicketAs(USERS.otherRequester, `E2E ownership ${Date.now()}`);
    const api = await apiAs(USERS.requester);
    expect((await api.get(`/api/tickets/${other.id}`)).status()).toBe(404);
    expect((await api.get(`/api/tickets/${other.id}/actions`)).status()).toBe(404);
    expect((await api.get("/api/dashboard/staff")).status()).toBe(403);
    await api.dispose();
  });

  test("Requester with no Tickets sees an empty dashboard (AC-16)", async ({ page }) => {
    await login(page, USERS.emptyRequester);
    expect(await cardValue(page, "My Open Tickets")).toBe(0);
    await expect(page.getByText("You haven't submitted any tickets yet.")).toBeVisible();
  });
});
