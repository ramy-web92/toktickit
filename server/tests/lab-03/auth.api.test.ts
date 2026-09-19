import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("Authentication", () => {
  describe("POST /api/auth/login", () => {
    it("returns 200 and the user's safe profile on valid credentials", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "jennifer.anderson@example.com", password: "FinalPass456!" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name: "Jennifer Anderson",
        email: "jennifer.anderson@example.com",
        role: "REQUESTER",
      });
      expect(res.body.passwordHash).toBeUndefined();
    });

    it("returns 401 with a generic message on wrong password", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "jennifer.anderson@example.com", password: "wrongpassword" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("returns the identical generic error for an unknown email (BR-06)", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "doesnotexist@example.com", password: "whatever123" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("returns the identical generic error for an inactive account, even with the correct password (BR-07)", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "robert.smith@example.com", password: "Password123!" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    it("returns 400 when email or password is missing", async () => {
      const res = await request(app).post("/api/auth/login").send({ email: "jennifer.anderson@example.com" });
      expect(res.status).toBe(400);
    });
  });

  describe("Session lifecycle", () => {
    it("allows GET /api/auth/me after login, and blocks it after logout", async () => {
      const agent = request.agent(app);

      const loginRes = await agent
        .post("/api/auth/login")
        .send({ email: "kevin.patel@example.com", password: "Password123!" });
      expect(loginRes.status).toBe(200);

      const meRes = await agent.get("/api/auth/me");
      expect(meRes.status).toBe(200);
      expect(meRes.body.role).toBe("IT_STAFF");

      const logoutRes = await agent.post("/api/auth/logout");
      expect(logoutRes.status).toBe(200);

      const meAfterLogoutRes = await agent.get("/api/auth/me");
      expect(meAfterLogoutRes.status).toBe(401);
    });

    it("returns 401 on /api/auth/me with no session at all", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });
  });
});