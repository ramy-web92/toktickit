// Lab 4 — RESP-01, RESP-02 (docs/lab-04/tests.md)
// For each major Lab 4 screen at mobile / tablet / desktop widths:
//  - asserts the page never scrolls sideways (wide tables scroll inside their own container)
//  - saves a full-page screenshot to artifacts/lab-04/screenshots/<screen>/ (handout Part 9 evidence)
import { test, expect, Page } from "@playwright/test";
import { USERS, login, openStaffTicket } from "./helpers";

const WIDTHS = [
  { name: "mobile", width: 360, height: 780 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "page scrolls horizontally").toBeLessThanOrEqual(0);
}

async function shoot(page: Page, folder: string, name: string, size: string) {
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: `artifacts/lab-04/screenshots/${folder}/${name}-${size}.png`, fullPage: true });
}

for (const vp of WIDTHS) {
  test.describe(`Responsive — ${vp.name} (${vp.width}px)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`IT Staff dashboard and drill-down at ${vp.width}px`, async ({ page }) => {
      await login(page, USERS.staff);
      await expect(page.getByRole("button", { name: /^Unassigned: / })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await shoot(page, "staff-dashboard", "staff-dashboard", vp.name);

      await page.getByRole("button", { name: /^Follow-ups Pending: / }).click();
      await expect(page.getByRole("heading", { name: "Ticket Queue" })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await shoot(page, "staff-dashboard", "drill-down-queue", vp.name);
    });

    test(`Requester dashboard at ${vp.width}px`, async ({ page }) => {
      await login(page, USERS.requester);
      await expect(page.getByRole("button", { name: /^My Open Tickets: / })).toBeVisible();
      await expectNoHorizontalScroll(page);
      await shoot(page, "requester-dashboard", "requester-dashboard", vp.name);
    });

    test(`Empty Requester dashboard at ${vp.width}px`, async ({ page }) => {
      await login(page, USERS.emptyRequester);
      await expect(page.getByText("You haven't submitted any tickets yet.")).toBeVisible();
      await expectNoHorizontalScroll(page);
      await shoot(page, "requester-dashboard", "requester-dashboard-empty", vp.name);
    });

    test(`Actions Taken and workflow at ${vp.width}px`, async ({ page }) => {
      await login(page, USERS.staff);
      await openStaffTicket(page, "TKT-2026-000001");
      await expect(page.getByText("Actions Taken").first()).toBeVisible();
      await expectNoHorizontalScroll(page);
      await shoot(page, "actions-taken", "actions-list", vp.name);

      if (await page.getByRole("button", { name: "+ Add action" }).count()) {
        await page.getByRole("button", { name: "+ Add action" }).click();
        await page.getByRole("button", { name: "Save" }).click(); // empty → validation errors
        await expect(page.getByText("Description is required.")).toBeVisible();
        await expectNoHorizontalScroll(page);
        await shoot(page, "actions-taken", "actions-form-validation", vp.name);
      }
    });

    test(`Requester read-only Actions Taken at ${vp.width}px`, async ({ page }) => {
      await login(page, USERS.requester);
      await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "My Tickets" }).click();
      await page.getByPlaceholder(/search/i).fill("TKT-2026-000001");
      await page.getByRole("button", { name: "TKT-2026-000001" }).first().click();
      await expect(page.getByText("Actions Taken by IT")).toBeVisible();
      await expect(page.getByRole("button", { name: "+ Add action" })).toHaveCount(0);
      await expectNoHorizontalScroll(page);
      await shoot(page, "actions-taken", "requester-read-only", vp.name);
    });
  });
}
