// Lab 4 — API-26..API-29 (docs/lab-04/tests.md). Runs against the seeded database.
// API-26 compares every metric with a raw SQL query: this is the evidence that
// dashboard numbers match the database (handout Part 5).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const PASSWORD = "Password123!";
const ACTIVE_SQL = `('NEW','OPEN','IN_PROGRESS','WAITING_FOR_REQUESTER','REOPENED')`;

async function loginAs(email: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  return agent;
}

async function sqlCount(sql: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(sql);
  return Number(rows[0].n);
}

let staff: ReturnType<typeof request.agent>;
let kevinId: number;
let dashboard: any;

beforeAll(async () => {
  staff = await loginAs("kevin.patel@example.com");
  kevinId = (await prisma.user.findUniqueOrThrow({ where: { email: "kevin.patel@example.com" } })).id;
  dashboard = (await staff.get("/api/dashboard/staff")).body;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const metric = (id: string) => dashboard.metrics.find((m: any) => m.id === id).value;

describe("GET /api/dashboard/staff", () => {
  it("API-26 ST-M1 Unassigned matches SQL (AC-15)", async () => {
    expect(metric("ST-M1")).toBe(
      await sqlCount(`SELECT COUNT(*) AS n FROM "Ticket" WHERE "ownerId" IS NULL AND "currentStatus" IN ${ACTIVE_SQL}`),
    );
  });

  it("API-26 ST-M2 My Assigned matches SQL", async () => {
    expect(metric("ST-M2")).toBe(
      await sqlCount(`SELECT COUNT(*) AS n FROM "Ticket" WHERE "ownerId" = ${kevinId} AND "currentStatus" IN ${ACTIVE_SQL}`),
    );
  });

  it("API-26 ST-M5 Tickets with my open actions matches SQL", async () => {
    expect(metric("ST-M5")).toBe(
      await sqlCount(`SELECT COUNT(DISTINCT "ticketId") AS n FROM "ActionTaken"
        WHERE "assigneeId" = ${kevinId} AND "status" IN ('PLANNED','IN_PROGRESS')`),
    );
  });

  it("API-26 ST-M6 Follow-ups pending matches SQL", async () => {
    expect(metric("ST-M6")).toBe(
      await sqlCount(`SELECT COUNT(DISTINCT t."id") AS n FROM "Ticket" t JOIN "ActionTaken" a ON a."ticketId" = t."id"
        WHERE a."status" = 'COMPLETED' AND a."followUpRequired" = true AND t."currentStatus" IN ${ACTIVE_SQL}`),
    );
  });

  it("API-26 By Status matches SQL for every status", async () => {
    for (const row of dashboard.byStatus) {
      expect(row.value, row.status).toBe(
        await sqlCount(`SELECT COUNT(*) AS n FROM "Ticket" WHERE "currentStatus" = '${row.status}'`),
      );
    }
  });

  it("API-26 By IT Priority matches SQL (active Tickets only)", async () => {
    for (const row of dashboard.byPriority) {
      expect(row.value, row.itPriority).toBe(
        await sqlCount(`SELECT COUNT(*) AS n FROM "Ticket" WHERE "itPriority" = '${row.itPriority}' AND "currentStatus" IN ${ACTIVE_SQL}`),
      );
    }
  });

  it("API-26 seed data gives non-zero metrics", () => {
    expect(metric("ST-M1")).toBeGreaterThan(0);
    expect(metric("ST-M5")).toBeGreaterThan(0);
    expect(metric("ST-M6")).toBeGreaterThan(0);
  });

  it("API-27 always returns all 8 statuses and 3 priorities, zeros included (BR-25)", () => {
    expect(dashboard.byStatus.map((r: any) => r.status)).toEqual([
      "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
    ]);
    expect(dashboard.byPriority.map((r: any) => r.itPriority)).toEqual(["LOW", "MEDIUM", "HIGH"]);
  });

  it("recent and urgent lists are active Tickets, max 5, urgent sorted by priority", () => {
    expect(dashboard.recentlyUpdated.length).toBeLessThanOrEqual(5);
    expect(dashboard.urgent.length).toBeLessThanOrEqual(5);
    const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 } as Record<string, number>;
    const ranks = dashboard.urgent.map((t: any) => rank[t.itPriority]);
    expect(ranks).toEqual([...ranks].sort((a: number, b: number) => b - a));
    for (const t of [...dashboard.recentlyUpdated, ...dashboard.urgent]) {
      expect(["RESOLVED", "CLOSED", "CANCELLED"]).not.toContain(t.currentStatus);
    }
  });

  it("API-28 Administrator also gets user counts; IT Staff does not; Requester is forbidden (FR-15)", async () => {
    expect(dashboard).not.toHaveProperty("users");

    const admin = await (await loginAs("john.smith@example.com")).get("/api/dashboard/staff");
    expect(admin.status).toBe(200);
    const itStaff = admin.body.users.find((u: any) => u.role === "IT_STAFF");
    expect(itStaff.active).toBe(await prisma.user.count({ where: { role: "IT_STAFF", isActive: true } }));
    expect(itStaff.inactive).toBe(await prisma.user.count({ where: { role: "IT_STAFF", isActive: false } }));

    const requester = await (await loginAs("jennifer.anderson@example.com")).get("/api/dashboard/staff");
    expect(requester.status).toBe(403);
  });

  it("API-29 every drill-down returns the same count in the Ticket Queue (AC-17)", async () => {
    const links = [...dashboard.metrics, ...dashboard.byStatus, ...dashboard.byPriority];
    for (const item of links) {
      const query = item.drillDown.split("?")[1];
      const list = await staff.get(`/api/staff/tickets?${query}`);
      expect(list.status).toBe(200);
      expect(list.body.pagination.totalItems, item.drillDown).toBe(item.value);
    }
  });
});
