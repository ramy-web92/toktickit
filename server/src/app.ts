import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";

export const app = express();
app.use(cors());
app.use(express.json());

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