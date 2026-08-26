import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/tickets/:id", () => {
  it("returns an owned ticket with its attachments", async () => {
    const res = await request(app).get("/api/tickets/1?requesterId=1");
    expect(res.status).toBe(200);
    expect(res.body.ticket).toHaveProperty("ticketNumber");
    expect(res.body.ticket).toHaveProperty("attachments");
  });

  it("returns 404 when the ticket belongs to another requester", async () => {
    const res = await request(app).get("/api/tickets/1?requesterId=999");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TICKET_NOT_FOUND");
  });
});