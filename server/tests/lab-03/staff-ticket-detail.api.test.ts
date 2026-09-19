import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

async function loginAsStaff() {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email: "kevin.patel@example.com", password: "Password123!" });
  return agent;
}

describe("IT Staff Ticket operations", () => {
  it("GET /api/staff/tickets/:id returns full detail for IT Staff", async () => {
    const staff = await loginAsStaff();
    const res = await staff.get("/api/staff/tickets/3");

    expect(res.status).toBe(200);
    expect(res.body.ticket).toHaveProperty("requester");
    expect(res.body.ticket).toHaveProperty("attachments");
  });

  it("GET /api/staff/tickets/:id returns 404 for a non-existent ticket", async () => {
    const staff = await loginAsStaff();
    const res = await staff.get("/api/staff/tickets/999999");
    expect(res.status).toBe(404);
  });

  it("PATCH /api/staff/tickets/:id/owner claims an unassigned ticket", async () => {
    const staff = await loginAsStaff();
    const res = await staff.patch("/api/staff/tickets/3/owner").send({ ownerId: 6 });

    expect(res.status).toBe(200);
    expect(res.body.ticket.ownerId).toBe(6);
  });

  it("PATCH /api/staff/tickets/:id/owner rejects an inactive user as owner", async () => {
    const staff = await loginAsStaff();
    // user id 9 is Amanda Clark, seeded as inactive IT Staff
    const res = await staff.patch("/api/staff/tickets/3/owner").send({ ownerId: 9 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_OWNER");
  });

  it("PATCH /api/staff/tickets/:id/priority updates IT Priority", async () => {
    const staff = await loginAsStaff();
    const res = await staff.patch("/api/staff/tickets/3/priority").send({ itPriority: "HIGH" });

    expect(res.status).toBe(200);
    expect(res.body.ticket.itPriority).toBe("HIGH");
  });

  it("PATCH /api/staff/tickets/:id/status rejects an invalid transition (BR-13)", async () => {
    const staff = await loginAsStaff();
    // ticket 3 should currently be OPEN or NEW from prior tests; jumping to CLOSED directly is never valid
    const res = await staff.patch("/api/staff/tickets/3/status").send({ status: "CLOSED" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

    it("PATCH /api/staff/tickets/:id/status accepts a valid transition", async () => {
    const staff = await loginAsStaff();

    const transitions: Record<string, string> = {
      NEW: "OPEN",
      OPEN: "IN_PROGRESS",
      IN_PROGRESS: "WAITING_FOR_REQUESTER",
      WAITING_FOR_REQUESTER: "IN_PROGRESS",
      RESOLVED: "CLOSED",
      CLOSED: "REOPENED",
      REOPENED: "OPEN",
    };

    const current = await staff.get("/api/staff/tickets/3");
    const next = transitions[current.body.ticket.currentStatus];

    const res = await staff.patch("/api/staff/tickets/3/status").send({ status: next });
    expect(res.status).toBe(200);
    expect(res.body.ticket.currentStatus).toBe(next);
  });
});