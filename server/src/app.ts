import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import multer from "multer";

export const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const categories = await prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json(categories);
  } catch {
    res.status(500).json({ error: "Unable to retrieve categories" });
  }
});

app.get("/api/dev-requesters", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesters = await prisma.devRequester.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json(requesters);
  } catch {
    res.status(500).json({ error: "Unable to retrieve development requesters" });
  }
});

app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const relatedSystems = await prisma.relatedSystem.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    res.status(200).json(relatedSystems);
  } catch {
    res.status(500).json({ error: "Unable to retrieve related systems" });
  }
});

app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = Number(req.query.requesterId);

    if (!requesterId) {
      return res.status(400).json({ error: { code: "MISSING_REQUESTER_ID" } });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const allowedPageSizes = [10, 25, 50];
    const pageSize = allowedPageSizes.includes(Number(req.query.pageSize))
      ? Number(req.query.pageSize)
      : 10;

    const search = (req.query.search as string) || "";
    const categoryId = req.query.categoryId ? Number(req.query.categoryId) : undefined;
    const requestedPriority = req.query.requestedPriority as string | undefined;
    const currentStatus = req.query.currentStatus as string | undefined;

    const where: any = { requesterId };
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (requestedPriority) where.requestedPriority = requestedPriority;
    if (currentStatus) where.currentStatus = currentStatus;

    const [tickets, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          summary: true,
          requestedPriority: true,
          itPriority: true,
          currentStatus: true,
          updatedAt: true,
          category: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);

    res.status(200).json({
      tickets,
      pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.post("/api/tickets", upload.array("attachments", 5), async (req: Request, res: Response) => {
  const { requesterId, categoryId, relatedSystemId, summary, description, requestedPriority } = req.body;

  const errors: Record<string, string> = {};
  if (!summary || summary.trim().length < 5 || summary.trim().length > 120) {
    errors.summary = "Summary must be between 5 and 120 characters";
  }
  if (!description || description.trim().length < 10 || description.trim().length > 2000) {
    errors.description = "Description must be between 10 and 2000 characters";
  }
  if (!["LOW", "MEDIUM", "HIGH"].includes(requestedPriority)) {
    errors.requestedPriority = "Requested Priority must be LOW, MEDIUM, or HIGH";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(422).json({ error: { code: "VALIDATION_ERROR", fields: errors } });
  }

  try {
    const prisma = getPrisma();
    const count = await prisma.ticket.count();
    const ticketNumber = `TKT-2026-${String(count + 1).padStart(6, "0")}`;

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId: Number(requesterId),
        categoryId: Number(categoryId),
        relatedSystemId: Number(relatedSystemId),
        summary: summary.trim(),
        description: description.trim(),
        requestedPriority,
        itPriority: requestedPriority,
      },
    });

    const files = (req.files as Express.Multer.File[]) || [];
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    const attachmentResults = [];

    for (const file of files) {
      if (!allowedTypes.includes(file.mimetype)) {
        attachmentResults.push({ fileName: file.originalname, status: "REJECTED", reason: "UNSUPPORTED_FILE_TYPE" });
        continue;
      }
      const storedFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`;
      const attachment = await prisma.attachment.create({
        data: {
          ticketId: ticket.id,
          storedFileName,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        },
      });
      attachmentResults.push({ fileName: file.originalname, status: "UPLOADED", attachmentId: attachment.id });
    }

    res.status(201).json({ ticket, attachmentResults });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});
