// Lab 4 E2E helpers.
import { expect, Page, request as playwrightRequest, APIRequestContext } from "@playwright/test";

export const API_URL = process.env.API_URL ?? "http://localhost:3000";
export const PASSWORD = "Password123!";

export const USERS = {
  requester: "jennifer.anderson@example.com",
  otherRequester: "michael.brown@example.com",
  emptyRequester: "nina.wong@example.com",
  staff: "kevin.patel@example.com",
  staff2: "emily.davis@example.com",
  admin: "john.smith@example.com",
};

export async function login(page: Page, email: string) {
  await page.goto("/");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible({ timeout: 15000 });
}

/** API client logged in as a user (session cookie kept in the context). */
export async function apiAs(email: string): Promise<APIRequestContext> {
  const api = await playwrightRequest.newContext({ baseURL: API_URL });
  const res = await api.post("/api/auth/login", { data: { email, password: PASSWORD } });
  expect(res.ok()).toBeTruthy();
  return api;
}

/** Creates a fresh Ticket as a Requester, so each E2E run starts from a known state. */
export async function createTicketAs(email: string, summary: string) {
  const api = await apiAs(email);
  const res = await api.post("/api/tickets", {
    multipart: {
      categoryId: "1",
      relatedSystemId: "1",
      summary,
      description: "Created by the Lab 4 end-to-end tests.",
      requestedPriority: "HIGH",
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  await api.dispose();
  return body.ticket as { id: number; ticketNumber: string };
}

/** Opens a Ticket from the IT Staff queue by searching its number. */
export async function openStaffTicket(page: Page, ticketNumber: string) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Ticket Queue" }).click();
  await page.getByPlaceholder(/search/i).fill(ticketNumber);
  await page.getByRole("button", { name: ticketNumber }).first().click();
  await expect(page.getByText(ticketNumber).first()).toBeVisible();
}

/** Opens a Ticket from the Requester's My Tickets list by searching its number. */
export async function openRequesterTicket(page: Page, ticketNumber: string) {
  await page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "My Tickets" }).click();
  await page.getByPlaceholder(/search/i).fill(ticketNumber);
  await page.getByRole("button", { name: ticketNumber }).first().click();
}
