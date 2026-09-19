import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password });
  return agent;
}

describe("Cross-role authorization", () => {
  it("blocks unauthenticated access to a Requester-only route (401)", async () => {
    const res = await request(app).get("/api/tickets");
    expect(res.status).toBe(401);
  });

  it("blocks IT Staff from calling Requester-only ticket routes (403)", async () => {
    const staff = await loginAs("kevin.patel@example.com", "Password123!");
    const res = await staff.get("/api/tickets");
    expect(res.status).toBe(403);
  });

  it("blocks a Requester from calling the IT Staff Ticket Queue (403)", async () => {
    const requester = await loginAs("jennifer.anderson@example.com", "FinalPass456!");
    const res = await requester.get("/api/staff/tickets");
    expect(res.status).toBe(403);
  });

  it("blocks a Requester from calling Administrator user routes (403)", async () => {
    const requester = await loginAs("jennifer.anderson@example.com", "FinalPass456!");
    const res = await requester.get("/api/admin/users");
    expect(res.status).toBe(403);
  });

  it("blocks IT Staff from calling Administrator user routes (403)", async () => {
    const staff = await loginAs("kevin.patel@example.com", "Password123!");
    const res = await staff.get("/api/admin/users");
    expect(res.status).toBe(403);
  });

  it("does not leak another requester's ticket (BR-03, AC-03)", async () => {
    const requesterA = await loginAs("jennifer.anderson@example.com", "FinalPass456!");
    const ticketRes = await requesterA.get("/api/tickets");
    const ownTicketId = ticketRes.body.tickets[0].id;

    const requesterB = await loginAs("michael.brown@example.com", "Password123!");
    const res = await requesterB.get(`/api/tickets/${ownTicketId}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("Administrator can access the IT Staff Ticket Queue", async () => {
    const admin = await loginAs("john.smith@example.com", "Password123!");
    const res = await admin.get("/api/staff/tickets");
    expect(res.status).toBe(200);
  });
});