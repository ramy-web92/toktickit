// Lab 4 — API-31 (docs/lab-04/tests.md): readiness check with a working database.
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("GET /api/health/ready", () => {
  it("API-31 reports API and database as ok", async () => {
    const res = await request(app).get("/api/health/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", service: "TokTickIT API", db: "ok" });
  });

  it("keeps the Lab 1 /api/health contract unchanged", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body).toEqual({ status: "ok", service: "TokTickIT API" });
  });
});
