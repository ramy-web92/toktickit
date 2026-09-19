import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

async function loginAsStaff() {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email: "kevin.patel@example.com", password: "Password123!" });
  return agent;
}

describe("GET /api/staff/tickets", () => {
  it("returns tickets with pagination metadata", async () => {
    const staff = await loginAsStaff();
    const res = await staff.get("/api/staff/tickets");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body).toHaveProperty("pagination");
    expect(res.body.pagination).toHaveProperty("totalItems");
  });

  it("filters by search term", async () => {
    const staff = await loginAsStaff();
    const res = await staff.get("/api/staff/tickets?search=VPN");

    expect(res.status).toBe(200);
    expect(res.body.data.every((t: any) => t.summary.toLowerCase().includes("vpn"))).toBe(true);
  });

  it("returns an empty list for a search term with no matches", async () => {
    const staff = await loginAsStaff();
    const res = await staff.get("/api/staff/tickets?search=zzzznonexistentzzzz");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.totalItems).toBe(0);
  });

  it("filters by owner=unassigned", async () => {
    const staff = await loginAsStaff();
    const res = await staff.get("/api/staff/tickets?owner=unassigned");

    expect(res.status).toBe(200);
    expect(res.body.data.every((t: any) => t.owner === null)).toBe(true);
  });

  it("filters by status", async () => {
    const staff = await loginAsStaff();
    const res = await staff.get("/api/staff/tickets?status=OPEN");

    expect(res.status).toBe(200);
    expect(res.body.data.every((t: any) => t.currentStatus === "OPEN")).toBe(true);
  });

    it("respects an allowed pageSize value", async () => {
    const staff = await loginAsStaff();
    const res = await staff.get("/api/staff/tickets?page=1&pageSize=25");

    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(25);
  });

  it("falls back to the default pageSize for an invalid value rather than erroring", async () => {
    const staff = await loginAsStaff();
    const res = await staff.get("/api/staff/tickets?pageSize=999");

    expect(res.status).toBe(200);
    expect(res.body.pagination.pageSize).toBe(10);
  });

});