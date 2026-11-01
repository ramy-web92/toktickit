// Lab 4 — hardening (review of #44): Ticket numbers are max + 1, never count + 1,
// so they stay unique after deletions and never collide with seed numbers (9000xx).
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const prisma = getPrisma();
const created: number[] = [];

async function createTicket(agent: ReturnType<typeof request.agent>) {
  const res = await agent
    .post("/api/tickets")
    .field("categoryId", "1")
    .field("relatedSystemId", "1")
    .field("summary", "Ticket number test")
    .field("description", "Created by ticket-number.api.test.ts and removed afterwards.")
    .field("requestedPriority", "LOW");
  expect(res.status).toBe(201);
  created.push(res.body.ticket.id);
  return res.body.ticket as { id: number; ticketNumber: string };
}

const seq = (n: string) => Number(n.split("-")[2]);

afterAll(async () => {
  await prisma.attachment.deleteMany({ where: { ticketId: { in: created } } });
  await prisma.ticket.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
});

describe("Ticket number generation", () => {
  it("increments from the highest existing number and stays below the seed range", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "jennifer.anderson@example.com", password: "Password123!" });

    const a = await createTicket(agent);
    const b = await createTicket(agent);
    expect(a.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(seq(b.ticketNumber)).toBe(seq(a.ticketNumber) + 1);
    expect(seq(b.ticketNumber)).toBeLessThan(900000);
  });

  it("stays unique after a Ticket is deleted (count + 1 would collide)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: "jennifer.anderson@example.com", password: "Password123!" });

    const a = await createTicket(agent);
    const b = await createTicket(agent);
    await prisma.attachment.deleteMany({ where: { ticketId: a.id } });
    await prisma.ticket.delete({ where: { id: a.id } });

    const c = await createTicket(agent);
    expect(seq(c.ticketNumber)).toBe(seq(b.ticketNumber) + 1);
  });
});
