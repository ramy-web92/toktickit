import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/tickets", () => {
  it("returns only tickets owned by the authenticated requester (BR-03)", async () => {
    const agent1 = request.agent(app);
    await agent1.post("/api/auth/login").send({ email: "jennifer.anderson@example.com", password: "FinalPass456!" });
    const res1 = await agent1.get("/api/tickets");

    const agent2 = request.agent(app);
    await agent2.post("/api/auth/login").send({ email: "michael.brown@example.com", password: "Password123!" });
    const res2 = await agent2.get("/api/tickets");

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const ids1 = res1.body.tickets.map((t: { id: number }) => t.id);
    const ids2 = res2.body.tickets.map((t: { id: number }) => t.id);
    const overlap = ids1.filter((id: number) => ids2.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("filters results by search term with no matches", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "jennifer.anderson@example.com", password: "FinalPass456!" });

    const res = await agent.get("/api/tickets?search=zzzznonexistentzzzz");
    expect(res.status).toBe(200);
    expect(res.body.tickets).toHaveLength(0);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/tickets");
    expect(res.status).toBe(401);
  });
});