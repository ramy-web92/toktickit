import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/tickets/:id", () => {
  it("returns an owned ticket with its attachments", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "jennifer.anderson@example.com", password: "FinalPass456!" });

    const res = await agent.get("/api/tickets/1");
    expect(res.status).toBe(200);
    expect(res.body.ticket).toHaveProperty("ticketNumber");
    expect(res.body.ticket).toHaveProperty("attachments");
  });

  it("returns 404 when the ticket belongs to another requester (does not leak existence)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "michael.brown@example.com", password: "Password123!" });

    const res = await agent.get("/api/tickets/1");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/tickets/1");
    expect(res.status).toBe(401);
  });
});