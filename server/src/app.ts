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