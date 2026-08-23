import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/dev-requesters", () => {
  it("returns only active development requesters", async () => {
    const res = await request(app).get("/api/dev-requesters");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(4);

    const names = res.body.map((r: { name: string }) => r.name);
    expect(names).not.toContain("Robert Smith");
  });

  it("returns requesters with id, name, and email fields", async () => {
    const res = await request(app).get("/api/dev-requesters");
    expect(res.status).toBe(200);
    const first = res.body[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("name");
    expect(first).toHaveProperty("email");
  });
});