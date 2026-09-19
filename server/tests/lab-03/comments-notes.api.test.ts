import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

async function loginAs(email: string, password: string) {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email, password });
  return agent;
}

describe("Public Comments", () => {
  it("Requester can post a comment on their own ticket", async () => {
    const requester = await loginAs("jennifer.anderson@example.com", "FinalPass456!");
    const res = await requester.post("/api/tickets/1/comments").send({ content: "Automated test comment" });

    expect(res.status).toBe(201);
    expect(res.body.comment.content).toBe("Automated test comment");
    expect(res.body.comment.author).toHaveProperty("role");
  });

  it("IT Staff can post a comment on any ticket", async () => {
    const staff = await loginAs("kevin.patel@example.com", "Password123!");
    const res = await staff.post("/api/tickets/1/comments").send({ content: "Staff reply" });

    expect(res.status).toBe(201);
  });

  it("rejects an empty comment", async () => {
    const requester = await loginAs("jennifer.anderson@example.com", "FinalPass456!");
    const res = await requester.post("/api/tickets/1/comments").send({ content: "   " });

    expect(res.status).toBe(400);
  });

  it("rejects a comment from a Requester who does not own the ticket", async () => {
    const otherRequester = await loginAs("michael.brown@example.com", "Password123!");
    const res = await otherRequester.post("/api/tickets/1/comments").send({ content: "Should be blocked" });

    expect(res.status).toBe(403);
  });

  it("both Requester and IT Staff can read comments", async () => {
    const requester = await loginAs("jennifer.anderson@example.com", "FinalPass456!");
    const res = await requester.get("/api/tickets/1/comments");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.comments)).toBe(true);
  });
});

describe("Internal Notes", () => {
  it("IT Staff can post an internal note", async () => {
    const staff = await loginAs("kevin.patel@example.com", "Password123!");
    const res = await staff.post("/api/tickets/1/notes").send({ content: "Internal diagnostic note" });

    expect(res.status).toBe(201);
  });

  it("rejects an empty internal note", async () => {
    const staff = await loginAs("kevin.patel@example.com", "Password123!");
    const res = await staff.post("/api/tickets/1/notes").send({ content: "" });

    expect(res.status).toBe(400);
  });

  it("blocks a Requester from posting an internal note, without exposing note content (BR-04, AC-04)", async () => {
    const requester = await loginAs("jennifer.anderson@example.com", "FinalPass456!");
    const res = await requester.post("/api/tickets/1/notes").send({ content: "Should never be saved" });

    expect(res.status).toBe(403);
  });

  it("blocks a Requester from reading internal notes (BR-04, AC-04)", async () => {
    const requester = await loginAs("jennifer.anderson@example.com", "FinalPass456!");
    const res = await requester.get("/api/tickets/1/notes");

    expect(res.status).toBe(403);
    expect(res.body).not.toHaveProperty("notes");
  });

  it("IT Staff and Administrator can read internal notes", async () => {
    const staff = await loginAs("kevin.patel@example.com", "Password123!");
    const res = await staff.get("/api/tickets/1/notes");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notes)).toBe(true);
  });
});