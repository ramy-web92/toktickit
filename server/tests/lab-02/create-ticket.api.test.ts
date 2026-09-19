import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("POST /api/tickets", () => {
  it("creates a ticket with valid data using the authenticated requester's identity", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "jennifer.anderson@example.com", password: "FinalPass456!" });

    const res = await agent
      .post("/api/tickets")
      .field("categoryId", "1")
      .field("relatedSystemId", "1")
      .field("summary", "Automated test ticket")
      .field("description", "This description is long enough to pass validation rules.")
      .field("requestedPriority", "MEDIUM");

    expect(res.status).toBe(201);
    expect(res.body.ticket.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.ticket.requesterId).toBe(1);
  });

  it("rejects a summary that is too short", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "jennifer.anderson@example.com", password: "FinalPass456!" });

    const res = await agent
      .post("/api/tickets")
      .field("categoryId", "1")
      .field("relatedSystemId", "1")
      .field("summary", "Hi")
      .field("description", "This description is long enough to pass validation rules.")
      .field("requestedPriority", "MEDIUM");

    expect(res.status).toBe(422);
    expect(res.body.error.fields.summary).toBeDefined();
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .field("categoryId", "1")
      .field("relatedSystemId", "1")
      .field("summary", "Should be rejected")
      .field("description", "This description is long enough to pass validation rules.")
      .field("requestedPriority", "MEDIUM");

    expect(res.status).toBe(401);
  });
});