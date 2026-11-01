// Lab 4 — E2E-03, E2E-04, E2E-05 (docs/lab-04/tests.md)
import { test, expect } from "@playwright/test";
import { USERS, createTicketAs, login, openRequesterTicket, openStaffTicket } from "./helpers";

test.describe("Lab 4 — Ticket workflow", () => {
  test("E2E-03/04: gate blocks Resolve, Requester indication is advisory, IT resolves and closes (AC-11, AC-12, AC-18)", async ({ browser }) => {
    const ticket = await createTicketAs(USERS.requester, `E2E workflow ${Date.now()}`);

    const staff = await (await browser.newContext()).newPage();
    await login(staff, USERS.staff);
    await openStaffTicket(staff, ticket.ticketNumber);
    const workflow = staff.getByRole("group", { name: "Change status" });
    await workflow.getByRole("button", { name: "Open ticket" }).click();
    await expect(staff.getByText("Status changed to Open.")).toBeVisible();
    await workflow.getByRole("button", { name: "Start work" }).click();
    await expect(staff.getByText("Status changed to In Progress.")).toBeVisible();

    // Gate: no completed action yet
    await workflow.getByRole("button", { name: "Resolve" }).click();
    await expect(staff.getByRole("alert")).toContainText(/complete at least one action/i);

    // Requester says it looks fixed — status does not change
    const requester = await (await browser.newContext()).newPage();
    await login(requester, USERS.requester);
    await openRequesterTicket(requester, ticket.ticketNumber);
    await requester.getByRole("button", { name: "Problem appears resolved" }).click();
    await expect(requester.getByText(/you told IT this looks resolved/i)).toBeVisible();
    await expect(requester.getByText("In Progress").first()).toBeVisible();

    // IT records and completes an action, then resolves and closes
    await staff.getByRole("button", { name: "+ Add action" }).click();
    await staff.getByLabel(/action description/i).fill("Reset network adapter");
    await staff.getByLabel(/^result/i).fill("Connection stable");
    await staff.getByRole("button", { name: "Save" }).click();
    await staff.getByRole("button", { name: /view action: reset network adapter/i }).first().click();
    await staff.getByRole("button", { name: "Complete" }).click();
    await staff.getByRole("button", { name: "Confirm completion" }).click();
    await expect(staff.getByText("Action completed.")).toBeVisible();

    await workflow.getByRole("button", { name: "Resolve" }).click();
    await expect(staff.getByText("Status changed to Resolved.")).toBeVisible();
    await workflow.getByRole("button", { name: "Close" }).click();
    await expect(staff.getByText("Status changed to Closed.")).toBeVisible();

    await staff.getByText(/status history/i).click();
    for (const step of ["Open", "In Progress", "Resolved", "Closed"]) {
      await expect(staff.locator("details ol")).toContainText(step);
    }
    // Closed Ticket: actions are read-only
    await expect(staff.getByRole("button", { name: "+ Add action" })).toHaveCount(0);
  });

  test("E2E-05: two IT Staff editing the same action — the second sees a conflict (AC-13)", async ({ browser }) => {
    const ticket = await createTicketAs(USERS.requester, `E2E conflict ${Date.now()}`);
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await login(a, USERS.staff);
    await login(b, USERS.staff2);

    await openStaffTicket(a, ticket.ticketNumber);
    await a.getByRole("button", { name: "+ Add action" }).click();
    await a.getByLabel(/action description/i).fill("Shared action");
    await a.getByRole("button", { name: "Save" }).click();
    await expect(a.getByText("Action saved.")).toBeVisible();

    await openStaffTicket(b, ticket.ticketNumber);
    for (const page of [a, b]) {
      await page.getByRole("button", { name: /view action: shared action/i }).first().click();
      await page.getByRole("button", { name: "Edit" }).click();
    }

    await a.getByLabel(/^result/i).fill("Edited by Kevin");
    await a.getByRole("button", { name: "Save" }).click();
    await expect(a.getByText("Action updated.")).toBeVisible();

    await b.getByLabel(/^result/i).fill("Edited by Emily");
    await b.getByRole("button", { name: "Save" }).click();
    await expect(b.getByRole("alert")).toContainText(/changed by someone else/i);
    await expect(b.getByLabel(/^result/i)).toHaveValue("Edited by Emily");
  });
});
