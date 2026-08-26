import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("Attachment lifecycle", () => {
  let ticketId: number;
  let attachmentId: number;

  beforeAll(async () => {
    const createRes = await request(app)
      .post("/api/tickets")
      .field("requesterId", "1")
      .field("categoryId", "1")
      .field("relatedSystemId", "1")
      .field("summary", "Attachment lifecycle test ticket")
      .field("description", "This ticket is used to test the attachment lifecycle end to end.")
      .field("requestedPriority", "LOW")
      .attach("attachments", Buffer.from("fake image content"), {
        filename: "lifecycle-test.png",
        contentType: "image/png",
      }); 
        
    ticketId = createRes.body.ticket.id;
    attachmentId = createRes.body.attachmentResults[0].attachmentId;
  });

  it("soft-removes an attachment with a valid reason", async () => {
    const res = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .send({ requesterId: 1, reason: "Automated test removal" });

    expect(res.status).toBe(200);
    expect(res.body.attachment.isRemoved).toBe(true);
    expect(res.body.attachment.removalReason).toBe("Automated test removal");
  });

  it("rejects removing an already-removed attachment", async () => {
    const res = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .send({ requesterId: 1, reason: "Trying again" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ATTACHMENT_ALREADY_REMOVED");
  });

  it("rejects removal without a reason", async () => {
    const res = await request(app)
      .delete(`/api/attachments/${attachmentId}`)
      .send({ requesterId: 1 });

    expect(res.status).toBe(422);
  });

  it("blocks download of a removed attachment", async () => {
    const res = await request(app).get(
      `/api/attachments/${attachmentId}/download?requesterId=1`
    );
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe("ATTACHMENT_REMOVED");
  });
});