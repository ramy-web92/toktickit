import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("POST /api/tickets", () => {
  it("creates a ticket with valid data", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .field("requesterId", "1")
      .field("categoryId", "1")
      .field("relatedSystemId", "1")
      .field("summary", "Automated test ticket")
      .field("description", "This description is long enough to pass validation rules.")
      .field("requestedPriority", "MEDIUM");

    expect(res.status).toBe(201);
    expect(res.body.ticket.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
  });

  it("rejects a summary that is too short", async () => {
    const res = await request(app)
      .post("/api/tickets")
      .field("requesterId", "1")
      .field("categoryId", "1")
      .field("relatedSystemId", "1")
      .field("summary", "Hi")
      .field("description", "This description is long enough to pass validation rules.")
      .field("requestedPriority", "MEDIUM");

    expect(res.status).toBe(422);
    expect(res.body.error.fields.summary).toBeDefined();
  });
});