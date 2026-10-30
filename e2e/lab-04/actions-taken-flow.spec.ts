// Lab 4 — E2E-01, E2E-02 (docs/lab-04/tests.md)
import { test, expect } from "@playwright/test";
import { USERS, createTicketAs, login, openStaffTicket } from "./helpers";

test.describe("Lab 4 — Actions Taken", () => {
  test("E2E-01: two IT Staff record different actions on one Ticket; completed ones become read-only (AC-01, AC-03)", async ({ browser }) => {
    const ticket = await createTicketAs(USERS.requester, `E2E actions ${Date.now()}`);

    // Kevin adds an action and completes it
    const kevin = await (await browser.newContext()).newPage();
    await login(kevin, USERS.staff);
    await openStaffTicket(kevin, ticket.ticketNumber);
    await kevin.getByRole("button", { name: "+ Add action" }).click();
    await kevin.getByLabel(/action description/i).fill("Checked VPN client logs");
    await kevin.getByRole("button", { name: "Save" }).click();
    await expect(kevin.getByText("Action saved.")).toBeVisible();

    await kevin.getByRole("button", { name: /view action: checked vpn client logs/i }).first().click();
    await kevin.getByRole("button", { name: "Complete" }).click();
    await kevin.getByLabel(/result \*/i).fill("Found expired certificate");
    await kevin.getByRole("button", { name: "Confirm completion" }).click();
    await expect(kevin.getByText("Action completed.")).toBeVisible();
    await expect(kevin.getByText(/can't be edited/i)).toBeVisible();
    await expect(kevin.getByRole("button", { name: "Edit" })).toHaveCount(0);

    // Emily adds a second action on the same Ticket, with follow-up
    const emily = await (await browser.newContext()).newPage();
    await login(emily, USERS.staff2);
    await openStaffTicket(emily, ticket.ticketNumber);
    await emily.getByRole("button", { name: "+ Add action" }).click();
    await emily.getByLabel(/action description/i).fill("Renewed certificate");
    await emily.getByRole("switch", { name: /follow-up required/i }).check();
    await emily.getByRole("button", { name: "Save" }).click();
    await expect(emily.getByText(/follow-up note is required/i)).toBeVisible();
    await emily.getByLabel(/follow-up note/i).fill("Check again next week");
    await emily.getByRole("button", { name: "Save" }).click();
    await expect(emily.getByText("Action saved.")).toBeVisible();

    const rows = emily.locator("table tbody tr");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Checked VPN client logs");
    await expect(rows.nth(0)).toContainText("Completed");
    await expect(rows.nth(0)).toContainText("Kevin Patel");
    await expect(rows.nth(1)).toContainText("Renewed certificate");
    await expect(rows.nth(1)).toContainText("Emily Davis");
  });

  test("E2E-02: inactive IT Staff are not offered as assignees (AC-06)", async ({ page }) => {
    await login(page, USERS.staff);
    const ticket = await createTicketAs(USERS.requester, `E2E assignee ${Date.now()}`);
    await openStaffTicket(page, ticket.ticketNumber);
    await page.getByRole("button", { name: "+ Add action" }).click();
    const options = await page.getByLabel("Assignee").locator("option").allTextContents();
    expect(options).toContain("Kevin Patel");
    expect(options).not.toContain("Amanda Clark");
    expect(options).not.toContain("Jennifer Anderson");
  });
});
