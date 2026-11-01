// Lab 4 — SEED-01, SEED-02 (docs/lab-04/tests.md)
import { describe, it, expect, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function runSeed() {
  execSync("npx tsx prisma/seed.ts", { cwd: serverDir, stdio: "ignore" });
}

async function counts() {
  return {
    users: await prisma.user.count(),
    tickets: await prisma.ticket.count(),
    actions: await prisma.actionTaken.count(),
    comments: await prisma.publicComment.count(),
    notes: await prisma.internalNote.count(),
  };
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("SEED-01 — seed is idempotent", () => {
  it("running the seed twice produces identical counts", async () => {
    runSeed();
    const first = await counts();
    runSeed();
    const second = await counts();
    expect(second).toEqual(first);
  }, 120_000);
});

describe("SEED-02 — seed covers the Lab 4 scenarios", () => {
  it("covers every Ticket status", async () => {
    const statuses = await prisma.ticket.groupBy({ by: ["currentStatus"] });
    const present = statuses.map((s) => s.currentStatus);
    for (const s of ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]) {
      expect(present).toContain(s);
    }
  });

  it("covers every IT Priority", async () => {
    const priorities = (await prisma.ticket.groupBy({ by: ["itPriority"] })).map((p) => p.itPriority);
    for (const p of ["LOW", "MEDIUM", "HIGH"]) expect(priorities).toContain(p);
  });

  it("has assigned and unassigned Tickets", async () => {
    expect(await prisma.ticket.count({ where: { ownerId: null } })).toBeGreaterThan(0);
    expect(await prisma.ticket.count({ where: { ownerId: { not: null } } })).toBeGreaterThan(0);
  });

  it("has Tickets with zero, one and many Actions Taken", async () => {
    const tickets = await prisma.ticket.findMany({ select: { _count: { select: { actionsTaken: true } } } });
    const actionCounts = tickets.map((t) => t._count.actionsTaken);
    expect(actionCounts).toContain(0);
    expect(actionCounts).toContain(1);
    expect(Math.max(...actionCounts)).toBeGreaterThanOrEqual(3);
  });

  it("covers every Action status and a follow-up", async () => {
    const statuses = (await prisma.actionTaken.groupBy({ by: ["status"] })).map((s) => s.status);
    for (const s of ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]) expect(statuses).toContain(s);
    expect(await prisma.actionTaken.count({ where: { followUpRequired: true } })).toBeGreaterThan(0);
  });

  it("completed actions have a result and a performer; others do not (BR-05, BR-07)", async () => {
    expect(await prisma.actionTaken.count({ where: { status: "COMPLETED", OR: [{ result: null }, { performedById: null }] } })).toBe(0);
    expect(await prisma.actionTaken.count({ where: { status: { not: "COMPLETED" }, performedById: { not: null } } })).toBe(0);
  });

  it("has an inactive IT Staff user (invalid assignee tests)", async () => {
    expect(await prisma.user.count({ where: { role: "IT_STAFF", isActive: false } })).toBeGreaterThan(0);
  });

  it("has an active Requester with zero Tickets (empty dashboard)", async () => {
    const empty = await prisma.user.count({
      where: { role: "REQUESTER", isActive: true, ticketsRequested: { none: {} } },
    });
    expect(empty).toBeGreaterThan(0);
  });
});
