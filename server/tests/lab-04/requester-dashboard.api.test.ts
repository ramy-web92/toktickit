// Lab 4 — API-22..API-25 (docs/lab-04/tests.md). Runs against the seeded database.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const PASSWORD = "Password123!";
const ACTIVE = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;

async function loginAs(email: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  return agent;
}

let jennifer: ReturnType<typeof request.agent>;
let jenniferId: number;

beforeAll(async () => {
  jennifer = await loginAs("jennifer.anderson@example.com");
  jenniferId = (await prisma.user.findUniqueOrThrow({ where: { email: "jennifer.anderson@example.com" } })).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/dashboard/requester", () => {
  it("API-22 returns only the authenticated Requester's data (AC-02)", async () => {
    const res = await jennifer.get("/api/dashboard/requester");
    expect(res.status).toBe(200);
    expect(res.body.timeZone).toBe("Asia/Bangkok");

    const ownIds = new Set(
      (await prisma.ticket.findMany({ where: { requesterId: jenniferId }, select: { id: true } })).map((t) => t.id),
    );
    for (const t of [...res.body.recentlyUpdated, ...res.body.recentlyResolved]) {
      expect(ownIds.has(t.id)).toBe(true);
    }
    expect(res.body.recentlyUpdated.length).toBeLessThanOrEqual(5);
  });

  it("API-23 each metric equals its documented query", async () => {
    const res = await jennifer.get("/api/dashboard/requester");
    const byId = Object.fromEntries(res.body.metrics.map((m: any) => [m.id, m.value]));

    expect(byId["RQ-M1"]).toBe(await prisma.ticket.count({ where: { requesterId: jenniferId, currentStatus: { in: [...ACTIVE] } } }));
    expect(byId["RQ-M2"]).toBe(await prisma.ticket.count({ where: { requesterId: jenniferId, currentStatus: "WAITING_FOR_REQUESTER" } }));
    expect(byId["RQ-M3"]).toBe(await prisma.ticket.count({ where: { requesterId: jenniferId, currentStatus: "RESOLVED" } }));
    expect(byId["RQ-M4"]).toBe(await prisma.ticket.count({ where: { requesterId: jenniferId, currentStatus: "CLOSED" } }));
    expect(byId["RQ-M1"]).toBeGreaterThan(0); // seed gives Jennifer active Tickets
  });

  it("API-23 metric drill-downs return the same count in My Tickets (AC-17)", async () => {
    const res = await jennifer.get("/api/dashboard/requester");
    for (const m of res.body.metrics) {
      const query = m.drillDown.split("?")[1];
      const list = await jennifer.get(`/api/tickets?${query}`);
      expect(list.status).toBe(200);
      expect(list.body.pagination.totalItems, m.id).toBe(m.value);
    }
  });

  it("API-24 a Requester with no Tickets gets zeros and empty lists (AC-16)", async () => {
    const nina = await loginAs("nina.wong@example.com");
    const res = await nina.get("/api/dashboard/requester");
    expect(res.status).toBe(200);
    expect(res.body.metrics).toHaveLength(4);
    for (const m of res.body.metrics) expect(m.value).toBe(0);
    expect(res.body.recentlyUpdated).toEqual([]);
    expect(res.body.recentlyResolved).toEqual([]);
  });

  it("API-25 is forbidden for IT Staff and Administrators", async () => {
    expect((await (await loginAs("kevin.patel@example.com")).get("/api/dashboard/requester")).status).toBe(403);
    expect((await (await loginAs("john.smith@example.com")).get("/api/dashboard/requester")).status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    expect((await request(app).get("/api/dashboard/requester")).status).toBe(401);
  });
});
