import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/tickets", () => {
  it("returns only tickets owned by the given requester", async () => {
    const res1 = await request(app).get("/api/tickets?requesterId=1");
    const res2 = await request(app).get("/api/tickets?requesterId=2");

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const ids1 = res1.body.tickets.map((t: { id: number }) => t.id);
    const ids2 = res2.body.tickets.map((t: { id: number }) => t.id);
    const overlap = ids1.filter((id: number) => ids2.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("filters results by search term with no matches", async () => {
    const res = await request(app).get(
      "/api/tickets?requesterId=1&search=zzzznonexistentzzzz"
    );
    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(0);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it("returns 400 when requesterId is missing", async () => {
    const res = await request(app).get("/api/tickets");
    expect(res.status).toBe(400);
  });
});