// Lab 4 — MIG-01, MIG-02, MIG-03 (docs/lab-04/tests.md)
// Runs against the migrated + seeded development database, like the Lab 2–3 suites.
import { describe, it, expect, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function columnsOf(table: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}`;
  return rows.map((r) => r.column_name);
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("MIG-01 — Lab 4 migration preserves Lab 1–3 data", () => {
  it("keeps all earlier tables populated", async () => {
    expect(await prisma.category.count()).toBeGreaterThanOrEqual(4);
    expect(await prisma.user.count()).toBeGreaterThanOrEqual(10);
    expect(await prisma.ticket.count()).toBeGreaterThanOrEqual(4);
    expect(await prisma.publicComment.count()).toBeGreaterThanOrEqual(1);
    expect(await prisma.internalNote.count()).toBeGreaterThanOrEqual(1);
  });

  it("adds the Lab 4 columns to Ticket without removing Lab 3 columns", async () => {
    const cols = await columnsOf("Ticket");
    for (const c of ["ownerId", "currentStatus", "itPriority", "requesterMarkedResolved"]) {
      expect(cols).toContain(c);
    }
    for (const c of ["version", "resolvedAt", "closedAt", "requesterMarkedResolvedAt"]) {
      expect(cols).toContain(c);
    }
  });

  it("creates the ActionTaken and TicketStatusChange tables", async () => {
    const actionCols = await columnsOf("ActionTaken");
    for (const c of [
      "ticketId", "actionAt", "description", "result", "status", "followUpRequired",
      "followUpNote", "attachmentNotes", "createdById", "assigneeId", "performedById",
      "idempotencyKey", "version",
    ]) {
      expect(actionCols).toContain(c);
    }
    const historyCols = await columnsOf("TicketStatusChange");
    for (const c of ["ticketId", "fromStatus", "toStatus", "actorId", "reason", "createdAt"]) {
      expect(historyCols).toContain(c);
    }
  });
});

describe("MIG-02 — backfill and legacy behavior", () => {
  it("every RESOLVED or CLOSED Ticket has resolvedAt", async () => {
    const missing = await prisma.ticket.count({
      where: { currentStatus: { in: ["RESOLVED", "CLOSED"] }, resolvedAt: null },
    });
    expect(missing).toBe(0);
  });

  it("every CLOSED Ticket has closedAt", async () => {
    const missing = await prisma.ticket.count({ where: { currentStatus: "CLOSED", closedAt: null } });
    expect(missing).toBe(0);
  });

  it("Tickets marked resolved by the Requester have requesterMarkedResolvedAt", async () => {
    const missing = await prisma.ticket.count({
      where: { requesterMarkedResolved: true, requesterMarkedResolvedAt: null },
    });
    expect(missing).toBe(0);
  });

  it("legacy Tickets without Actions Taken remain valid (BR-26)", async () => {
    const withoutActions = await prisma.ticket.count({ where: { actionsTaken: { none: {} } } });
    expect(withoutActions).toBeGreaterThan(0);
  });
});

describe("MIG-03 — rollback script", () => {
  const sql = readFileSync(path.join(serverDir, "prisma/rollback/lab4_down.sql"), "utf8");

  it("removes every object added by the Lab 4 migration", () => {
    expect(sql).toContain('DROP TABLE IF EXISTS "ActionTaken"');
    expect(sql).toContain('DROP TABLE IF EXISTS "TicketStatusChange"');
    expect(sql).toContain('DROP TYPE IF EXISTS "ActionStatus"');
    for (const c of ["closedAt", "requesterMarkedResolvedAt", "resolvedAt", "version"]) {
      expect(sql).toContain(`DROP COLUMN IF EXISTS "${c}"`);
    }
  });

  it("never drops Lab 1–3 tables", () => {
    for (const t of ["User", "Ticket", "Attachment", "PublicComment", "InternalNote", "Category"]) {
      expect(sql).not.toContain(`DROP TABLE IF EXISTS "${t}"`);
    }
  });
});
