// Lab 4 — API-14..API-21 (docs/lab-04/tests.md). Runs against the seeded database.
// Each test works on its own throwaway Tickets, removed in afterAll.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const PASSWORD = "Password123!";
const createdTicketIds: number[] = [];

let staff: ReturnType<typeof request.agent>;
let requester: ReturnType<typeof request.agent>;
let jenniferId: number;
let michaelId: number;
let kevinId: number;
let categoryId: number;
let relatedSystemId: number;

async function loginAs(email: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  return agent;
}

type Status =
  | "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER"
  | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";

async function makeTicket(currentStatus: Status, requesterId = jenniferId) {
  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: `TEST-WF-${randomUUID().slice(0, 8)}`,
      requesterId,
      ownerId: kevinId,
      categoryId,
      relatedSystemId,
      summary: "Workflow test ticket",
      description: "Created by ticket-workflow.api.test.ts",
      requestedPriority: "LOW",
      itPriority: "LOW",
      currentStatus,
    },
  });
  createdTicketIds.push(ticket.id);
  return ticket;
}

async function addAction(ticketId: number, status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED") {
  await prisma.actionTaken.create({
    data: {
      ticketId,
      description: "Test action",
      result: status === "COMPLETED" ? "Done" : null,
      status,
      createdById: kevinId,
      assigneeId: kevinId,
      performedById: status === "COMPLETED" ? kevinId : null,
    },
  });
}

function setStatus(ticketId: number, body: Record<string, unknown>) {
  return staff.patch(`/api/staff/tickets/${ticketId}/status`).send(body);
}

beforeAll(async () => {
  staff = await loginAs("kevin.patel@example.com");
  requester = await loginAs("jennifer.anderson@example.com");
  jenniferId = (await prisma.user.findUniqueOrThrow({ where: { email: "jennifer.anderson@example.com" } })).id;
  michaelId = (await prisma.user.findUniqueOrThrow({ where: { email: "michael.brown@example.com" } })).id;
  kevinId = (await prisma.user.findUniqueOrThrow({ where: { email: "kevin.patel@example.com" } })).id;
  categoryId = (await prisma.category.findFirstOrThrow()).id;
  relatedSystemId = (await prisma.relatedSystem.findFirstOrThrow()).id;
});

afterAll(async () => {
  await prisma.ticketStatusChange.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.actionTaken.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
  await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
  await prisma.$disconnect();
});

describe("PATCH /api/staff/tickets/:id/status — permitted transitions", () => {
  const permitted: Array<[Status, Status]> = [
    ["NEW", "OPEN"], ["NEW", "CANCELLED"],
    ["OPEN", "IN_PROGRESS"], ["OPEN", "WAITING_FOR_REQUESTER"], ["OPEN", "CANCELLED"],
    ["IN_PROGRESS", "WAITING_FOR_REQUESTER"], ["IN_PROGRESS", "RESOLVED"], ["IN_PROGRESS", "CANCELLED"],
    ["WAITING_FOR_REQUESTER", "IN_PROGRESS"], ["WAITING_FOR_REQUESTER", "RESOLVED"], ["WAITING_FOR_REQUESTER", "CANCELLED"],
    ["RESOLVED", "CLOSED"], ["RESOLVED", "REOPENED"],
    ["CLOSED", "REOPENED"],
    ["REOPENED", "OPEN"], ["REOPENED", "IN_PROGRESS"], ["REOPENED", "CANCELLED"],
  ];

  it.each(permitted)("API-14 %s → %s succeeds and is recorded in history (AC-10)", async (from, to) => {
    const ticket = await makeTicket(from);
    if (to === "RESOLVED") await addAction(ticket.id, "COMPLETED");

    const res = await setStatus(ticket.id, {
      status: to,
      expectedVersion: ticket.version,
      ...(to === "CANCELLED" && { reason: "No longer needed" }),
    });

    expect(res.status).toBe(200);
    expect(res.body.ticket.currentStatus).toBe(to);
    expect(res.body.ticket.version).toBe(ticket.version + 1);
    expect(Array.isArray(res.body.ticket.allowedTransitions)).toBe(true);

    const history = await prisma.ticketStatusChange.findMany({ where: { ticketId: ticket.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ fromStatus: from, toStatus: to, actorId: kevinId });
  });

  it("still accepts Lab 3 requests without expectedVersion (regression)", async () => {
    const ticket = await makeTicket("NEW");
    const res = await setStatus(ticket.id, { status: "OPEN" });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/staff/tickets/:id/status — forbidden transitions", () => {
  it.each([
    ["OPEN", "OPEN"],
    ["NEW", "CLOSED"],
    ["CANCELLED", "OPEN"],
    ["CLOSED", "RESOLVED"],
    ["NEW", "NOT_A_STATUS"],
  ])("API-15 %s → %s returns 409 INVALID_TRANSITION", async (from, to) => {
    const ticket = await makeTicket(from as Status);
    const res = await setStatus(ticket.id, { status: to, reason: "x" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
    expect(Array.isArray(res.body.error.details.allowed)).toBe(true);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).currentStatus).toBe(from);
  });

  it("API-15 forbids a Requester from changing the formal status", async () => {
    const ticket = await makeTicket("IN_PROGRESS");
    const res = await requester.patch(`/api/staff/tickets/${ticket.id}/status`).send({ status: "RESOLVED" });
    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown Ticket", async () => {
    const res = await setStatus(99999999, { status: "OPEN" });
    expect(res.status).toBe(404);
  });
});

describe("Resolution gate (BR-17)", () => {
  it("API-16 blocks Resolved when no action is completed (AC-11)", async () => {
    const ticket = await makeTicket("IN_PROGRESS");
    const res = await setStatus(ticket.id, { status: "RESOLVED" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("RESOLUTION_GATE");
    expect(res.body.error.details.reason).toBe("NO_COMPLETED_ACTION");
  });

  it("API-16 blocks Resolved while an action is still open (AC-11)", async () => {
    const ticket = await makeTicket("IN_PROGRESS");
    await addAction(ticket.id, "COMPLETED");
    await addAction(ticket.id, "PLANNED");
    const res = await setStatus(ticket.id, { status: "RESOLVED" });
    expect(res.status).toBe(409);
    expect(res.body.error.details.reason).toBe("OPEN_ACTIONS_REMAIN");
    expect(await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it("API-16 allows Resolved when completed and nothing open", async () => {
    const ticket = await makeTicket("WAITING_FOR_REQUESTER");
    await addAction(ticket.id, "COMPLETED");
    await addAction(ticket.id, "CANCELLED");
    const res = await setStatus(ticket.id, { status: "RESOLVED" });
    expect(res.status).toBe(200);
  });
});

describe("Timestamps (BR-18)", () => {
  it("API-17 sets resolvedAt and closedAt, and Reopen clears them", async () => {
    const ticket = await makeTicket("IN_PROGRESS");
    await addAction(ticket.id, "COMPLETED");

    const resolved = await setStatus(ticket.id, { status: "RESOLVED" });
    expect(resolved.body.ticket.resolvedAt).not.toBeNull();
    expect(resolved.body.ticket.closedAt).toBeNull();

    const closed = await setStatus(ticket.id, { status: "CLOSED" });
    expect(closed.body.ticket.closedAt).not.toBeNull();

    const reopened = await setStatus(ticket.id, { status: "REOPENED" });
    expect(reopened.body.ticket.resolvedAt).toBeNull();
    expect(reopened.body.ticket.closedAt).toBeNull();
  });
});

describe("Requester 'problem appears resolved' (BR-19)", () => {
  it("API-18 stores the indication without changing the status (AC-12)", async () => {
    const ticket = await makeTicket("IN_PROGRESS");
    const first = await requester.post(`/api/tickets/${ticket.id}/resolved-by-requester`);
    expect(first.status).toBe(200);
    expect(first.body.ticket.currentStatus).toBe("IN_PROGRESS");
    expect(first.body.ticket.requesterMarkedResolved).toBe(true);
    expect(first.body.ticket.requesterMarkedResolvedAt).not.toBeNull();

    const second = await requester.post(`/api/tickets/${ticket.id}/resolved-by-requester`);
    expect(second.status).toBe(200);
    expect(second.body.ticket.requesterMarkedResolvedAt).toBe(first.body.ticket.requesterMarkedResolvedAt);
  });

  it("API-18 is reset by the next status change", async () => {
    const ticket = await makeTicket("IN_PROGRESS");
    await requester.post(`/api/tickets/${ticket.id}/resolved-by-requester`);
    const res = await setStatus(ticket.id, { status: "WAITING_FOR_REQUESTER" });
    expect(res.body.ticket.requesterMarkedResolved).toBe(false);
    expect(res.body.ticket.requesterMarkedResolvedAt).toBeNull();
  });

  it("API-18 rejects the indication on a NEW Ticket", async () => {
    const ticket = await makeTicket("NEW");
    const res = await requester.post(`/api/tickets/${ticket.id}/resolved-by-requester`);
    expect(res.status).toBe(409);
  });

  it("API-18 hides another Requester's Ticket and blocks IT Staff", async () => {
    const other = await makeTicket("IN_PROGRESS", michaelId);
    expect((await requester.post(`/api/tickets/${other.id}/resolved-by-requester`)).status).toBe(404);
    expect((await staff.post(`/api/tickets/${other.id}/resolved-by-requester`)).status).toBe(403);
  });
});

describe("Cancel reason (BR-20)", () => {
  it("API-19 requires a reason to cancel and stores it in history", async () => {
    const ticket = await makeTicket("OPEN");
    const missing = await setStatus(ticket.id, { status: "CANCELLED" });
    expect(missing.status).toBe(422);
    expect(missing.body.error.details.fields.reason).toBeDefined();

    const ok = await setStatus(ticket.id, { status: "CANCELLED", reason: "Duplicate of another ticket" });
    expect(ok.status).toBe(200);
    const history = await prisma.ticketStatusChange.findFirstOrThrow({ where: { ticketId: ticket.id } });
    expect(history.reason).toBe("Duplicate of another ticket");
  });
});

describe("Concurrency (BR-22)", () => {
  it("API-20 rejects a stale expectedVersion with the current Ticket", async () => {
    const ticket = await makeTicket("OPEN");
    await setStatus(ticket.id, { status: "IN_PROGRESS", expectedVersion: 1 });
    const stale = await setStatus(ticket.id, { status: "WAITING_FOR_REQUESTER", expectedVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("STALE_UPDATE");
    expect(stale.body.error.details.current.version).toBe(2);
  });

  it("API-20 lets only one of two simultaneous changes win (AC-13)", async () => {
    const ticket = await makeTicket("OPEN");
    const [a, b] = await Promise.all([
      setStatus(ticket.id, { status: "IN_PROGRESS", expectedVersion: 1 }),
      setStatus(ticket.id, { status: "WAITING_FOR_REQUESTER", expectedVersion: 1 }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id } })).toBe(1);
  });

  it("increments version when owner or IT Priority changes", async () => {
    const ticket = await makeTicket("OPEN");
    await staff.patch(`/api/staff/tickets/${ticket.id}/priority`).send({ itPriority: "HIGH" });
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(after.version).toBe(ticket.version + 1);
  });
});

describe("Allowed transitions and history", () => {
  it("API-21 Ticket detail exposes the allowed transitions (FR-09)", async () => {
    const ticket = await makeTicket("RESOLVED");
    const res = await staff.get(`/api/staff/tickets/${ticket.id}`);
    expect(res.status).toBe(200);
    expect(res.body.ticket.allowedTransitions.sort()).toEqual(["CLOSED", "REOPENED"]);
    expect(res.body.ticket).toHaveProperty("version");
  });

  it("status history is ordered and visible to the owning Requester only", async () => {
    const ticket = await makeTicket("NEW");
    await setStatus(ticket.id, { status: "OPEN" });
    await setStatus(ticket.id, { status: "IN_PROGRESS" });

    const res = await requester.get(`/api/tickets/${ticket.id}/status-history`);
    expect(res.status).toBe(200);
    expect(res.body.items.map((h: any) => h.toStatus)).toEqual(["OPEN", "IN_PROGRESS"]);
    expect(res.body.items[0].actor.id).toBe(kevinId);

    const other = await makeTicket("NEW", michaelId);
    expect((await requester.get(`/api/tickets/${other.id}/status-history`)).status).toBe(404);
  });
});
