// Lab 4 — API-30, API-31 (docs/lab-04/tests.md): safe failure when the database fails.
// The routers are mounted on a small test app with a database client that always throws.
import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../../src/prisma.js", () => {
  const fail = () => Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:5432 password=secret"));
  const model = new Proxy({}, { get: () => fail });
  return { getPrisma: () => new Proxy({}, { get: (_t, key) => (String(key).startsWith("$") ? fail : model) }) };
});

const { createDashboardRouter } = await import("../../src/lab4/dashboardRouter.js");

function appAs(role: "REQUESTER" | "IT_STAFF") {
  const app = express();
  app.use((req: any, _res, next) => {
    req.session = { userId: 1, role };
    next();
  });
  const requireAuth = (_req: any, _res: any, next: any) => next();
  const requireRole = (...roles: string[]) => (req: any, res: any, next: any) =>
    roles.includes(req.session.role) ? next() : res.status(403).json({ error: { code: "FORBIDDEN" } });
  app.use(createDashboardRouter({ requireAuth, requireRole } as any));
  return app;
}

describe("Dashboard safe failure", () => {
  it("API-30 staff dashboard returns a generic 500 without internals (AC-19)", async () => {
    const res = await request(appAs("IT_STAFF")).get("/api/dashboard/staff");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|password|stack/i);
  });

  it("API-30 requester dashboard returns a generic 500 without internals (AC-19)", async () => {
    const res = await request(appAs("REQUESTER")).get("/api/dashboard/requester");
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|password|stack/i);
  });

  it("API-31 readiness check reports the database as down with 503", async () => {
    const res = await request(appAs("IT_STAFF")).get("/api/health/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "degraded", service: "TokTickIT API", db: "error" });
  });
});
