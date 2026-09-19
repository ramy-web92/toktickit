import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import bcrypt from "bcryptjs";
import { getPrisma } from "./prisma.js";
import multer from "multer";

export const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "insecure-fallback-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

// Extend Express's session type to carry our authenticated user id.
declare module "express-session" {
  interface SessionData {
    userId?: number;
    role?: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  }
}

// --- Auth middleware ---
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Please sign in to continue." } });
  }
  next();
}

function requireRole(...roles: Array<"REQUESTER" | "IT_STAFF" | "ADMINISTRATOR">) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId || !req.session.role || !roles.includes(req.session.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." } });
    }
    next();
  };
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// --- Authentication routes ---

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email and password are required." } });
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });

    // Same generic error whether the email doesn't exist, password is
    // wrong, or the account is inactive — do not help attackers enumerate
    // accounts (BR-06, BR-07).
    const genericError = () =>
      res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } });

    if (!user || !user.isActive) {
      return genericError();
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return genericError();
    }

    req.session.userId = user.id;
    req.session.role = user.role;

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.post("/api/auth/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
    }
    res.clearCookie("connect.sid");
    res.status(200).json({ success: true });
  });
});

app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { id: req.session.userId! } });

    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: { code: "UNAUTHENTICATED" } });
    }

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.post("/api/auth/change-password", requireAuth, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Current and new password are required." } });
  }

  const strongEnough =
    newPassword.length >= 8 &&
    /[a-z]/.test(newPassword) &&
    /[A-Z]/.test(newPassword) &&
    /[0-9]/.test(newPassword) &&
    /[^A-Za-z0-9]/.test(newPassword);

  if (!strongEnough) {
    return res.status(400).json({
      error: {
        code: "WEAK_PASSWORD",
        message: "Password must be at least 8 characters and include upper/lower case, a number, and a special character.",
      },
    });
  }

  try {
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.session.userId! } });

    const currentMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentMatches) {
      return res.status(400).json({ error: { code: "INVALID_CURRENT_PASSWORD", message: "Current password is incorrect." } });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustChangePassword: false },
    });

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
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

app.get("/api/tickets", requireAuth, requireRole("REQUESTER"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const requesterId = req.session.userId!;



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

app.post("/api/tickets", requireAuth, requireRole("REQUESTER"), upload.array("attachments", 5), async (req: Request, res: Response) => {
  const requesterId = req.session.userId!;
  const { categoryId, relatedSystemId, summary, description, requestedPriority } = req.body;

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
        requesterId, 
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

app.get("/api/tickets/:id", requireAuth, requireRole("REQUESTER"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const requesterId = req.session.userId!;

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, requesterId },
      include: {
        category: { select: { name: true } },
        relatedSystem: { select: { name: true } },
        attachments: {
          select: {
            id: true,
            originalFileName: true,
            sizeBytes: true,
            uploadedAt: true,
            isRemoved: true,
            removedAt: true,
            removalReason: true,
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: { code: "TICKET_NOT_FOUND" } });
    }

    res.status(200).json({ ticket });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.get("/api/attachments/:id/download", requireAuth, requireRole("REQUESTER"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const attachmentId = Number(req.params.id);
    const requesterId = req.session.userId!;

    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticket: { requesterId } },
    });

    if (!attachment) {
      return res.status(404).json({ error: { code: "ATTACHMENT_NOT_FOUND" } });
    }
    if (attachment.isRemoved) {
      return res.status(410).json({ error: { code: "ATTACHMENT_REMOVED" } });
    }

    res.status(200).json({ message: "File would be streamed here", fileName: attachment.originalFileName });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.delete("/api/attachments/:id", requireAuth, requireRole("REQUESTER"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const attachmentId = Number(req.params.id);
    const requesterId = req.session.userId!;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 3) {
      return res.status(422).json({
        error: { code: "VALIDATION_ERROR", fields: { reason: "Reason is required (min 3 characters)" } },
      });
    }

        const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticket: { requesterId } },
    });

    if (!attachment) {
      return res.status(404).json({ error: { code: "ATTACHMENT_NOT_FOUND" } });
    }
    if (attachment.isRemoved) {
      return res.status(409).json({ error: { code: "ATTACHMENT_ALREADY_REMOVED" } });
    }

    const updated = await prisma.attachment.update({
      where: { id: attachmentId },
      data: { isRemoved: true, removedAt: new Date(), removalReason: reason.trim() },
    });

    res.status(200).json({ attachment: updated });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

// --- IT Staff Ticket Queue & Ticket operations ---

const ALLOWED_SORT_FIELDS = ["createdAt", "requestedPriority", "itPriority", "currentStatus"] as const;

// BR-13: permitted status transitions per role.
const STATUS_TRANSITIONS: Record<string, string[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};

app.get("/api/staff/tickets", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();

    const page = Math.max(1, Number(req.query.page) || 1);
    const allowedPageSizes = [10, 25, 50];
    const pageSize = allowedPageSizes.includes(Number(req.query.pageSize))
      ? Number(req.query.pageSize)
      : 10;

    const search = (req.query.search as string) || "";
    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;
    const owner = req.query.owner as string | undefined;

    const sortByRaw = req.query.sortBy as string | undefined;
    const sortBy = ALLOWED_SORT_FIELDS.includes(sortByRaw as any)
      ? (sortByRaw as typeof ALLOWED_SORT_FIELDS[number])
      : "createdAt";
    const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";

    const where: any = {};
    if (search) {
      where.OR = [
        { ticketNumber: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) where.currentStatus = status;
    if (category) where.category = { name: category };

    if (owner === "unassigned") {
      where.ownerId = null;
    } else if (owner === "me") {
      where.ownerId = req.session.userId;
    } else if (owner && !isNaN(Number(owner))) {
      where.ownerId = Number(owner);
    }

    const [tickets, totalItems] = await Promise.all([
      prisma.ticket.findMany({
        where,
        select: {
          id: true,
          ticketNumber: true,
          createdAt: true,
          summary: true,
          requestedPriority: true,
          itPriority: true,
          currentStatus: true,
          updatedAt: true,
          category: { select: { name: true } },
          owner: { select: { id: true, name: true } },
        },
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);

    res.status(200).json({
      data: tickets,
      pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) },
    });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.get("/api/staff/tickets/:id", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        category: { select: { name: true } },
        relatedSystem: { select: { name: true } },
        requester: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
        attachments: {
          select: { id: true, originalFileName: true, sizeBytes: true, uploadedAt: true, isRemoved: true },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: { code: "TICKET_NOT_FOUND" } });
    }

    res.status(200).json({ ticket });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.patch("/api/staff/tickets/:id/owner", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const { ownerId } = req.body;

    const newOwner = await prisma.user.findUnique({ where: { id: Number(ownerId) } });
    if (!newOwner || !newOwner.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(newOwner.role)) {
      return res.status(400).json({ error: { code: "INVALID_OWNER", message: "Owner must be an active IT Staff or Administrator." } });
    }

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { ownerId: newOwner.id },
    });

    res.status(200).json({ ticket });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.patch("/api/staff/tickets/:id/priority", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const { itPriority } = req.body;

    if (!["LOW", "MEDIUM", "HIGH"].includes(itPriority)) {
      return res.status(400).json({ error: { code: "INVALID_PRIORITY" } });
    }

    const ticket = await prisma.ticket.update({
      where: { id: ticketId },
      data: { itPriority },
    });

    res.status(200).json({ ticket });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.patch("/api/staff/tickets/:id/status", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const { status: newStatus } = req.body;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: { code: "TICKET_NOT_FOUND" } });
    }

    const allowedNextStatuses = STATUS_TRANSITIONS[ticket.currentStatus] || [];
    if (!allowedNextStatuses.includes(newStatus)) {
      return res.status(409).json({
        error: { code: "INVALID_TRANSITION", message: `Cannot move from ${ticket.currentStatus} to ${newStatus}.` },
      });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { currentStatus: newStatus },
    });

    res.status(200).json({ ticket: updated });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

// --- Public Comments (Requester who owns the ticket, or IT Staff/Administrator) ---

app.get("/api/tickets/:id/comments", requireAuth, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const { userId, role } = req.session;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: { code: "TICKET_NOT_FOUND" } });
    }
    if (role === "REQUESTER" && ticket.requesterId !== userId) {
      return res.status(403).json({ error: { code: "FORBIDDEN" } });
    }

    const comments = await prisma.publicComment.findMany({
      where: { ticketId },
      include: { author: { select: { name: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({ comments });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.post("/api/tickets/:id/comments", requireAuth, async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const { content } = req.body;
    const { userId, role } = req.session;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Comment cannot be empty." } });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Comment too long (max 2000 characters)." } });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      return res.status(404).json({ error: { code: "TICKET_NOT_FOUND" } });
    }
    if (role === "REQUESTER" && ticket.requesterId !== userId) {
      return res.status(403).json({ error: { code: "FORBIDDEN" } });
    }

    const comment = await prisma.publicComment.create({
      data: { ticketId, authorId: userId!, content: content.trim() },
      include: { author: { select: { name: true, role: true } } },
    });

    res.status(201).json({ comment });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

// --- Internal Notes (IT Staff / Administrator only) ---

app.get("/api/tickets/:id/notes", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);

    const notes = await prisma.internalNote.findMany({
      where: { ticketId },
      include: { author: { select: { name: true, role: true } } },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({ notes });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.post("/api/tickets/:id/notes", requireAuth, requireRole("IT_STAFF", "ADMINISTRATOR"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Note cannot be empty." } });
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Note too long (max 2000 characters)." } });
    }

    const note = await prisma.internalNote.create({
      data: { ticketId, authorId: req.session.userId!, content: content.trim() },
      include: { author: { select: { name: true, role: true } } },
    });

    res.status(201).json({ note });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

// --- Requester: mark problem as appearing resolved (BR-05, does not change formal status) ---

app.post("/api/tickets/:id/resolved-by-requester", requireAuth, requireRole("REQUESTER"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const ticketId = Number(req.params.id);
    const requesterId = req.session.userId!;

    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId } });
    if (!ticket) {
      return res.status(404).json({ error: { code: "TICKET_NOT_FOUND" } });
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { requesterMarkedResolved: true },
    });

    res.status(200).json({ ticket: updated });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

// --- Administrator User Management ---

app.get("/api/admin/users", requireAuth, requireRole("ADMINISTRATOR"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const search = (req.query.search as string) || "";
    const role = req.query.role as string | undefined;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }
    if (role) where.role = role;

    const users = await prisma.user.findMany({
      where,
      select: { id: true, name: true, email: true, role: true, isActive: true },
      orderBy: { id: "asc" },
    });

    res.status(200).json({ users });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.post("/api/admin/users", requireAuth, requireRole("ADMINISTRATOR"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const { name, email, role, isActive, initialPassword } = req.body;

    const errors: Record<string, string> = {};
    if (!name || name.trim().length < 2) errors.name = "Name is required.";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Valid email is required.";
    if (!["REQUESTER", "IT_STAFF", "ADMINISTRATOR"].includes(role)) errors.role = "Invalid role.";
    if (!initialPassword || initialPassword.length < 8) errors.initialPassword = "Initial password must be at least 8 characters.";

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", fields: errors } });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: { code: "EMAIL_ALREADY_EXISTS", message: "A user with this email already exists." } });
    }

    const passwordHash = await bcrypt.hash(initialPassword, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email,
        role,
        isActive: isActive ?? true,
        passwordHash,
        mustChangePassword: true,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    res.status(201).json({ user });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.patch("/api/admin/users/:id", requireAuth, requireRole("ADMINISTRATOR"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const targetId = Number(req.params.id);
    const { name, email, role, isActive } = req.body;
    const actingAdminId = req.session.userId!;

    const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
    if (!targetUser) {
      return res.status(404).json({ error: { code: "USER_NOT_FOUND" } });
    }

    // Prevent an Administrator from deactivating their own account (BR-15).
    if (targetId === actingAdminId && isActive === false) {
      return res.status(409).json({ error: { code: "SELF_DEACTIVATION_BLOCKED", message: "You cannot deactivate your own account." } });
    }

    // Prevent removing/demoting the last active Administrator (BR-16).
    const wouldStopBeingActiveAdmin =
      targetUser.role === "ADMINISTRATOR" &&
      targetUser.isActive &&
      ((role && role !== "ADMINISTRATOR") || isActive === false);

    if (wouldStopBeingActiveAdmin) {
      const activeAdminCount = await prisma.user.count({ where: { role: "ADMINISTRATOR", isActive: true } });
      if (activeAdminCount <= 1) {
        return res.status(409).json({ error: { code: "LAST_ADMIN_PROTECTED", message: "Cannot remove the last active Administrator." } });
      }
    }

    if (email && email !== targetUser.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: { code: "EMAIL_ALREADY_EXISTS", message: "A user with this email already exists." } });
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: {
        ...(name && { name: name.trim() }),
        ...(email && { email }),
        ...(role && { role }),
        ...(typeof isActive === "boolean" && { isActive }),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    res.status(200).json({ user: updated });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});

app.post("/api/admin/users/:id/reset-password", requireAuth, requireRole("ADMINISTRATOR"), async (req: Request, res: Response) => {
  try {
    const prisma = getPrisma();
    const targetId = Number(req.params.id);
    const { newInitialPassword } = req.body;

    if (!newInitialPassword || newInitialPassword.length < 8) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "New password must be at least 8 characters." } });
    }

    const passwordHash = await bcrypt.hash(newInitialPassword, 10);
    await prisma.user.update({
      where: { id: targetId },
      data: { passwordHash, mustChangePassword: true },
    });

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ error: { code: "INTERNAL_ERROR" } });
  }
});