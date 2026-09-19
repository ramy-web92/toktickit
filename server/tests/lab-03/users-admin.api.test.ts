import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

async function loginAsAdmin() {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email: "john.smith@example.com", password: "Password123!" });
  return agent;
}

describe("Administrator user management", () => {
  it("lists users", async () => {
    const admin = await loginAsAdmin();
    const res = await admin.get("/api/admin/users");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThan(0);
  });

  it("searches users by name or email", async () => {
    const admin = await loginAsAdmin();
    const res = await admin.get("/api/admin/users?search=jennifer");

    expect(res.status).toBe(200);
    expect(res.body.users.every((u: any) => u.name.toLowerCase().includes("jennifer"))).toBe(true);
  });

  it("filters users by role", async () => {
    const admin = await loginAsAdmin();
    const res = await admin.get("/api/admin/users?role=IT_STAFF");

    expect(res.status).toBe(200);
    expect(res.body.users.every((u: any) => u.role === "IT_STAFF")).toBe(true);
  });

  it("creates a user with valid data", async () => {
    const admin = await loginAsAdmin();
    const res = await admin.post("/api/admin/users").send({
      name: "New Test Requester",
      email: `test.${Date.now()}@example.com`,
      role: "REQUESTER",
      isActive: true,
      initialPassword: "TempInitPass1!",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("REQUESTER");
  });

  it("rejects creating a user with a duplicate email (BR-10)", async () => {
    const admin = await loginAsAdmin();
    const res = await admin.post("/api/admin/users").send({
      name: "Duplicate",
      email: "jennifer.anderson@example.com",
      role: "REQUESTER",
      isActive: true,
      initialPassword: "TempInitPass1!",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("rejects an invalid role value", async () => {
    const admin = await loginAsAdmin();
    const res = await admin.post("/api/admin/users").send({
      name: "Bad Role",
      email: `badrole.${Date.now()}@example.com`,
      role: "SUPERUSER",
      isActive: true,
      initialPassword: "TempInitPass1!",
    });

    expect(res.status).toBe(400);
  });

  it("edits a user's name, email, role, and activation state", async () => {
    const admin = await loginAsAdmin();
    const res = await admin.patch("/api/admin/users/2").send({ name: "Michael Brown Updated" });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Michael Brown Updated");
  });

  it("prevents an Administrator from deactivating their own account (BR-15)", async () => {
    const admin = await loginAsAdmin();
    const res = await admin.patch("/api/admin/users/10").send({ isActive: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SELF_DEACTIVATION_BLOCKED");
  });

  it("prevents demoting the last active Administrator (BR-16)", async () => {
    const admin = await loginAsAdmin();
    const res = await admin.patch("/api/admin/users/10").send({ role: "IT_STAFF" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LAST_ADMIN_PROTECTED");
  });

    it("sets a new initial password that requires a password change", async () => {
    const admin = await loginAsAdmin();

    // Use a freshly created throwaway user rather than mutating a shared
    // seeded account other tests depend on for login.
    const createRes = await admin.post("/api/admin/users").send({
      name: "Password Reset Target",
      email: `resettarget.${Date.now()}@example.com`,
      role: "REQUESTER",
      isActive: true,
      initialPassword: "TempInitPass1!",
    });
    const targetId = createRes.body.user.id;

    const res = await admin.post(`/api/admin/users/${targetId}/reset-password`).send({ newInitialPassword: "BrandNewPass1!" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("blocks non-Administrator roles from accessing admin routes", async () => {
    const staffAgent = request.agent(app);
    await staffAgent.post("/api/auth/login").send({ email: "kevin.patel@example.com", password: "Password123!" });

    const res = await staffAgent.get("/api/admin/users");
    expect(res.status).toBe(403);
  });
});