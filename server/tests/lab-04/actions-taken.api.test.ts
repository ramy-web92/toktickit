// Lab 4 — API-01..API-13 (docs/lab-04/tests.md). Runs against the seeded database.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const PASSWORD = "Password123!";

async function loginAs(email: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password: PASSWORD });
  return agent;
}

async function ticketId(ticketNumber: string) {
  return (await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber } })).id;
}

async function userId(email: string) {
  return (await prisma.user.findUniqueOrThrow({ where: { email } })).id;
}

let staff: ReturnType<typeof request.agent>;
let requester: ReturnType<typeof request.agent>;
let ownTicket: number; // TKT-2026-000001, owned by Jennifer, IN_PROGRESS
let otherTicket: number; // TKT-2026-000002, owned by Michael, OPEN
let closedTicket: number; // TKT-2026-900006, CLOSED
let kevinId: number;
let emilyId: number;

beforeAll(async () => {
  staff = await loginAs("kevin.patel@example.com");
  requester = await loginAs("jennifer.anderson@example.com");
  ownTicket = await ticketId("TKT-2026-000001");
  otherTicket = await ticketId("TKT-2026-000002");
  closedTicket = await ticketId("TKT-2026-900006");
  kevinId = await userId("kevin.patel@example.com");
  emilyId = await userId("emily.davis@example.com");
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createAction(body: Record<string, unknown> = {}, ticket = otherTicket) {
  return staff
    .post(`/api/tickets/${ticket}/actions`)
    .set("Idempotency-Key", randomUUID())
    .send({ description: "Automated test action", ...body });
}

describe("GET /api/tickets/:id/actions", () => {
  it("API-01 returns actions in stable order (actionAt, then id)", async () => {
    const res = await staff.get(`/api/tickets/${ownTicket}/actions`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    const keys = res.body.items.map((a: any) => [new Date(a.actionAt).getTime(), a.id]);
    const sorted = [...keys].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    expect(keys).toEqual(sorted);
    expect(res.body.items[0]).toHaveProperty("createdBy");
    expect(res.body.items[0]).toHaveProperty("assignee");
    expect(res.body.items[0]).not.toHaveProperty("idempotencyKey");
  });

  it("API-02 lets a Requester read actions on their own Ticket only (AC-24)", async () => {
    const own = await requester.get(`/api/tickets/${ownTicket}/actions`);
    expect(own.status).toBe(200);
    expect(own.body.items.length).toBeGreaterThan(0);

    const other = await requester.get(`/api/tickets/${otherTicket}/actions`);
    expect(other.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get(`/api/tickets/${ownTicket}/actions`);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/tickets/:id/actions", () => {
  it("API-03 creates an action with the authenticated creator and default assignee (AC-01)", async () => {
    const res = await createAction({ description: "Checked network cable" });
    expect(res.status).toBe(201);
    expect(res.body.ticketId).toBe(otherTicket);
    expect(res.body.createdBy.id).toBe(kevinId);
    expect(res.body.assignee.id).toBe(kevinId);
    expect(res.body.status).toBe("PLANNED");
    expect(res.body.version).toBe(1);
    expect(res.body.performedBy).toBeNull();
  });

  it("API-04 ignores server-controlled fields sent by the client (BR-04, BR-05)", async () => {
    const res = await createAction({ createdById: emilyId, performedById: emilyId, status: "COMPLETED", version: 9 });
    expect(res.status).toBe(201);
    expect(res.body.createdBy.id).toBe(kevinId);
    expect(res.body.performedBy).toBeNull();
    expect(res.body.status).toBe("PLANNED");
    expect(res.body.version).toBe(1);
  });

  it("API-05 forbids Requesters from creating, editing or transitioning actions (AC-04)", async () => {
    const before = await prisma.actionTaken.count();
    const action = (await createAction()).body;
    const afterCreate = await prisma.actionTaken.count();

    const post = await requester.post(`/api/tickets/${ownTicket}/actions`).send({ description: "Hack" });
    const patch = await requester
      .patch(`/api/tickets/${otherTicket}/actions/${action.id}`)
      .send({ description: "Hack", expectedVersion: 1 });
    const transition = await requester
      .post(`/api/tickets/${otherTicket}/actions/${action.id}/transition`)
      .send({ to: "COMPLETED", expectedVersion: 1, result: "x" });

    expect(post.status).toBe(403);
    expect(patch.status).toBe(403);
    expect(transition.status).toBe(403);
    expect(await prisma.actionTaken.count()).toBe(afterCreate);
    expect(afterCreate).toBe(before + 1);
    const unchanged = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    expect(unchanged.description).toBe("Automated test action");
  });

  it("API-06 requires a follow-up note when follow-up is needed (AC-05)", async () => {
    const res = await createAction({ followUpRequired: true });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.fields.followUpNote).toBeDefined();
  });

  it("API-06b requires a description", async () => {
    const res = await createAction({ description: "   " });
    expect(res.status).toBe(422);
    expect(res.body.error.details.fields.description).toBeDefined();
  });

  it("API-06c rejects an action date in the future (BR-09)", async () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const res = await createAction({ actionAt: future });
    expect(res.status).toBe(422);
    expect(res.body.error.details.fields.actionAt).toBeDefined();
  });

  it("API-07 rejects an inactive IT Staff or a Requester as assignee (AC-06)", async () => {
    const inactive = await createAction({ assigneeId: await userId("amanda.clark@example.com") });
    expect(inactive.status).toBe(422);
    expect(inactive.body.error.code).toBe("INVALID_ASSIGNEE");

    const req = await createAction({ assigneeId: await userId("jennifer.anderson@example.com") });
    expect(req.status).toBe(422);
    expect(req.body.error.code).toBe("INVALID_ASSIGNEE");
  });

  it("API-11 rejects actions on a Closed Ticket (AC-09)", async () => {
    const res = await createAction({}, closedTicket);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TICKET_LOCKED");
  });

  it("API-13 never creates duplicates for the same Idempotency-Key (AC-14)", async () => {
    const key = randomUUID();
    const send = () =>
      staff.post(`/api/tickets/${otherTicket}/actions`).set("Idempotency-Key", key).send({ description: "Retry-safe action" });

    const first = await send();
    const second = await send();
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    const parallelKey = randomUUID();
    const results = await Promise.all(
      [1, 2, 3].map(() =>
        staff.post(`/api/tickets/${otherTicket}/actions`).set("Idempotency-Key", parallelKey).send({ description: "Parallel" }),
      ),
    );
    const ids = new Set(results.map((r) => r.body.id));
    expect(ids.size).toBe(1);
    expect(await prisma.actionTaken.count({ where: { idempotencyKey: parallelKey } })).toBe(1);
  });
});

describe("PATCH /api/tickets/:id/actions/:actionId", () => {
  it("API-08 reassigns an action to another active IT Staff (FR-04)", async () => {
    const action = (await createAction()).body;
    const res = await staff
      .patch(`/api/tickets/${otherTicket}/actions/${action.id}`)
      .send({ assigneeId: emilyId, expectedVersion: action.version });
    expect(res.status).toBe(200);
    expect(res.body.assignee.id).toBe(emilyId);
    expect(res.body.version).toBe(action.version + 1);
  });

  it("requires expectedVersion", async () => {
    const action = (await createAction()).body;
    const res = await staff.patch(`/api/tickets/${otherTicket}/actions/${action.id}`).send({ result: "x" });
    expect(res.status).toBe(400);
  });

  it("API-12 rejects a stale update and returns the current version (AC-13)", async () => {
    const action = (await createAction()).body;
    const url = `/api/tickets/${otherTicket}/actions/${action.id}`;

    const first = await staff.patch(url).send({ result: "First edit", expectedVersion: 1 });
    const second = await staff.patch(url).send({ result: "Second edit", expectedVersion: 1 });

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("STALE_UPDATE");
    expect(second.body.error.details.current.version).toBe(2);
    expect(second.body.error.details.current.result).toBe("First edit");
  });

  it("returns 404 for an action that belongs to another Ticket", async () => {
    const action = (await createAction()).body;
    const res = await staff
      .patch(`/api/tickets/${ownTicket}/actions/${action.id}`)
      .send({ result: "x", expectedVersion: 1 });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/tickets/:id/actions/:actionId/transition", () => {
  it("API-09 requires a result to complete, then sets performedBy (AC-07)", async () => {
    const action = (await createAction()).body;
    const url = `/api/tickets/${otherTicket}/actions/${action.id}/transition`;

    const started = await staff.post(url).send({ to: "IN_PROGRESS", expectedVersion: 1 });
    expect(started.status).toBe(200);
    expect(started.body.status).toBe("IN_PROGRESS");

    const noResult = await staff.post(url).send({ to: "COMPLETED", expectedVersion: 2 });
    expect(noResult.status).toBe(422);
    expect(noResult.body.error.details.fields.result).toBeDefined();

    const done = await staff.post(url).send({ to: "COMPLETED", expectedVersion: 2, result: "Cable replaced" });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe("COMPLETED");
    expect(done.body.result).toBe("Cable replaced");
    expect(done.body.performedBy.id).toBe(kevinId);
  });

  it("API-10 locks completed and cancelled actions (AC-08)", async () => {
    const action = (await createAction()).body;
    const base = `/api/tickets/${otherTicket}/actions/${action.id}`;

    const cancelled = await staff.post(`${base}/transition`).send({ to: "CANCELLED", expectedVersion: 1 });
    expect(cancelled.status).toBe(200);

    const edit = await staff.patch(base).send({ description: "Changed", expectedVersion: 2 });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe("ACTION_LOCKED");

    const reopen = await staff.post(`${base}/transition`).send({ to: "IN_PROGRESS", expectedVersion: 2 });
    expect(reopen.status).toBe(409);
    expect(reopen.body.error.code).toBe("ACTION_LOCKED");
  });

  it("rejects a backward transition", async () => {
    const action = (await createAction()).body;
    const url = `/api/tickets/${otherTicket}/actions/${action.id}/transition`;
    await staff.post(url).send({ to: "IN_PROGRESS", expectedVersion: 1 });
    const back = await staff.post(url).send({ to: "PLANNED", expectedVersion: 2 });
    expect(back.status).toBe(409);
    expect(back.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("lets an Administrator act like IT Staff", async () => {
    const admin = await loginAs("john.smith@example.com");
    const res = await admin
      .post(`/api/tickets/${otherTicket}/actions`)
      .set("Idempotency-Key", randomUUID())
      .send({ description: "Admin action" });
    expect(res.status).toBe(201);
    expect(res.body.createdBy.id).toBe(await userId("john.smith@example.com"));
  });
});

describe("GET /api/staff/assignees", () => {
  it("lists only active IT Staff and Administrators, for IT Staff too", async () => {
    const res = await staff.get("/api/staff/assignees");
    expect(res.status).toBe(200);
    const emails = await prisma.user.findMany({
      where: { id: { in: res.body.users.map((u: any) => u.id) } },
      select: { role: true, isActive: true },
    });
    expect(emails.length).toBeGreaterThan(0);
    for (const u of emails) {
      expect(u.isActive).toBe(true);
      expect(["IT_STAFF", "ADMINISTRATOR"]).toContain(u.role);
    }
  });

  it("is forbidden for Requesters", async () => {
    expect((await requester.get("/api/staff/assignees")).status).toBe(403);
  });
});
