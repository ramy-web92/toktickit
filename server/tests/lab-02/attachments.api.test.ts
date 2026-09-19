import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("Attachment lifecycle", () => {
  const agent = request.agent(app);
  let attachmentId: number;

  beforeAll(async () => {
    await agent.post("/api/auth/login").send({ email: "jennifer.anderson@example.com", password: "FinalPass456!" });

    const createRes = await agent
      .post("/api/tickets")
      .field("categoryId", "1")
      .field("relatedSystemId", "1")
      .field("summary", "Attachment lifecycle test ticket")
      .field("description", "This ticket is used to test the attachment lifecycle end to end.")
      .field("requestedPriority", "LOW")
      .attach("attachments", Buffer.from("fake image content"), {
        filename: "lifecycle-test.png",
        contentType: "image/png",
      });

    
    attachmentId = createRes.body.attachmentResults[0].attachmentId;
  });

  it("soft-removes an attachment with a valid reason", async () => {
    const res = await agent
      .delete(`/api/attachments/${attachmentId}`)
      .send({ reason: "Automated test removal" });

    expect(res.status).toBe(200);
    expect(res.body.attachment.isRemoved).toBe(true);
    expect(res.body.attachment.removalReason).toBe("Automated test removal");
  });

  it("rejects removing an already-removed attachment", async () => {
    const res = await agent
      .delete(`/api/attachments/${attachmentId}`)
      .send({ reason: "Trying again" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ATTACHMENT_ALREADY_REMOVED");
  });

  it("rejects removal without a reason", async () => {
    const res = await agent.delete(`/api/attachments/${attachmentId}`).send({});
    expect(res.status).toBe(422);
  });

  it("blocks download of a removed attachment", async () => {
    const res = await agent.get(`/api/attachments/${attachmentId}/download`);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("ATTACHMENT_REMOVED");
  });
});