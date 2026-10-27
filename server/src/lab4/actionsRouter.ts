// Lab 4 — Actions Taken API (docs/lab-04/api-spec.md, "Actions Taken").
import { Router, Request, Response, RequestHandler } from "express";
import { getPrisma } from "../prisma.js";
import {
  ACTION_LIMITS,
  ActionFields,
  ActionStatus,
  FieldErrors,
  canTransitionAction,
  isActionLocked,
  isTicketLockedForActions,
  parseExpectedVersion,
  validateActionFields,
  validateCompletion,
} from "./actionRules.js";

type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
type Deps = {
  requireAuth: RequestHandler;
  requireRole: (...roles: Role[]) => RequestHandler;
};

const STAFF_ROLES: Role[] = ["IT_STAFF", "ADMINISTRATOR"];

const actionInclude = {
  createdBy: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  performedBy: { select: { id: true, name: true } },
};

function serialize(action: any) {
  // idempotencyKey is internal and never returned.
  const { idempotencyKey: _key, createdById: _c, assigneeId: _a, performedById: _p, ...rest } = action;
  return rest;
}

function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  return res.status(status).json({ error: { code, message, ...(details !== undefined && { details }) } });
}

function sendValidation(res: Response, fields: FieldErrors) {
  return sendError(res, 422, "VALIDATION_ERROR", "Please correct the highlighted fields.", { fields });
}

function parseId(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** BR-06: assignee must be an active IT Staff or Administrator. */
async function isValidAssignee(userId: unknown): Promise<boolean> {
  if (typeof userId !== "number" || !Number.isInteger(userId)) return false;
  const user = await getPrisma().user.findUnique({ where: { id: userId } });
  return !!user && user.isActive && (user.role === "IT_STAFF" || user.role === "ADMINISTRATOR");
}

function currentFields(action: any): ActionFields {
  return {
    description: action.description,
    result: action.result,
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote,
    attachmentNotes: action.attachmentNotes,
    actionAt: action.actionAt,
  };
}

/**
 * Applies a version-guarded update (BR-22). Returns the updated action, or sends
 * the appropriate 404 / 409 response and returns null.
 */
async function guardedUpdate(
  res: Response,
  ticketId: number,
  actionId: number,
  expectedVersion: number,
  data: Record<string, unknown>,
) {
  const prisma = getPrisma();
  const { count } = await prisma.actionTaken.updateMany({
    where: { id: actionId, ticketId, version: expectedVersion, status: { in: ["PLANNED", "IN_PROGRESS"] } },
    data: { ...data, version: { increment: 1 } },
  });
  const current = await prisma.actionTaken.findFirst({ where: { id: actionId, ticketId }, include: actionInclude });
  if (count === 1) {
    // Activity on an action counts as an update of its Ticket (dashboards "recently updated").
    await prisma.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
    return current;
  }
  if (!current) {
    sendError(res, 404, "NOT_FOUND", "This action was not found.");
  } else if (isActionLocked(current.status as ActionStatus)) {
    sendError(res, 409, "ACTION_LOCKED", "Completed or cancelled actions can't be changed. Add a new action instead.");
  } else {
    sendError(res, 409, "STALE_UPDATE", "This action was changed by someone else. Review the latest version and try again.", {
      current: serialize(current),
    });
  }
  return null;
}

export function createActionsRouter({ requireAuth, requireRole }: Deps): Router {
  const router = Router();

  // GET /api/tickets/:id/actions — staff any Ticket, Requester own Ticket only (BR-03, BR-15)
  router.get("/api/tickets/:id/actions", requireAuth, async (req: Request, res: Response) => {
    try {
      const prisma = getPrisma();
      const ticketId = parseId(req.params.id);
      if (!ticketId) return sendError(res, 404, "NOT_FOUND", "Ticket not found.");

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      const isStaff = STAFF_ROLES.includes(req.session.role as Role);
      if (!ticket || (!isStaff && ticket.requesterId !== req.session.userId)) {
        return sendError(res, 404, "NOT_FOUND", "Ticket not found.");
      }

      const items = await prisma.actionTaken.findMany({
        where: { ticketId },
        include: actionInclude,
        orderBy: [{ actionAt: "asc" }, { id: "asc" }],
      });
      res.status(200).json({ items: items.map(serialize) });
    } catch {
      sendError(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
    }
  });

  // POST /api/tickets/:id/actions — IT Staff / Administrator (BR-03)
  router.post("/api/tickets/:id/actions", requireAuth, requireRole(...STAFF_ROLES), async (req: Request, res: Response) => {
    try {
      const prisma = getPrisma();
      const userId = req.session.userId!;
      const ticketId = parseId(req.params.id);
      if (!ticketId) return sendError(res, 404, "NOT_FOUND", "Ticket not found.");

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return sendError(res, 404, "NOT_FOUND", "Ticket not found.");
      if (isTicketLockedForActions(ticket.currentStatus)) {
        return sendError(res, 409, "TICKET_LOCKED", "Actions can't be added to a closed or cancelled Ticket.");
      }

      // BR-23: duplicate submit / network retry protection
      const rawKey = req.get("Idempotency-Key");
      const idempotencyKey = rawKey && rawKey.trim().length > 0 ? rawKey.trim() : null;
      if (idempotencyKey && idempotencyKey.length > ACTION_LIMITS.idempotencyKey) {
        return sendError(res, 400, "BAD_REQUEST", "Idempotency-Key is too long.");
      }
      if (idempotencyKey) {
        const existing = await prisma.actionTaken.findFirst({
          where: { createdById: userId, ticketId, idempotencyKey },
          include: actionInclude,
        });
        if (existing) return res.status(200).json(serialize(existing));
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const now = new Date();
      const { value, errors } = validateActionFields(
        body,
        { description: "", result: null, followUpRequired: false, followUpNote: null, attachmentNotes: null, actionAt: now },
        { ticketCreatedAt: ticket.createdAt, now },
      );
      if (Object.keys(errors).length > 0) return sendValidation(res, errors);

      // BR-06: assignee defaults to the creator
      const assigneeId = body.assigneeId === undefined || body.assigneeId === null ? userId : body.assigneeId;
      if (!(await isValidAssignee(assigneeId))) {
        return sendError(res, 422, "INVALID_ASSIGNEE", "The assignee must be an active IT Staff member or Administrator.");
      }

      try {
        const created = await prisma.actionTaken.create({
          data: {
            ...value,
            ticketId,
            status: "PLANNED",
            createdById: userId, // BR-04: never from the request body
            assigneeId: assigneeId as number,
            idempotencyKey,
          },
          include: actionInclude,
        });
        await prisma.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } });
        return res.status(201).json(serialize(created));
      } catch (e: any) {
        // Two identical requests raced: the unique key rejected the second one.
        if (e?.code === "P2002" && idempotencyKey) {
          const existing = await prisma.actionTaken.findFirst({
            where: { createdById: userId, ticketId, idempotencyKey },
            include: actionInclude,
          });
          if (existing) return res.status(200).json(serialize(existing));
        }
        throw e;
      }
    } catch {
      sendError(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
    }
  });

  // PATCH /api/tickets/:id/actions/:actionId — IT Staff / Administrator
  router.patch(
    "/api/tickets/:id/actions/:actionId",
    requireAuth,
    requireRole(...STAFF_ROLES),
    async (req: Request, res: Response) => {
      try {
        const prisma = getPrisma();
        const ticketId = parseId(req.params.id);
        const actionId = parseId(req.params.actionId);
        if (!ticketId || !actionId) return sendError(res, 404, "NOT_FOUND", "This action was not found.");

        const body = (req.body ?? {}) as Record<string, unknown>;
        const expectedVersion = parseExpectedVersion(body.expectedVersion);
        if (!expectedVersion) return sendError(res, 400, "BAD_REQUEST", "expectedVersion is required.");

        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        const action = await prisma.actionTaken.findFirst({ where: { id: actionId, ticketId } });
        if (!ticket || !action) return sendError(res, 404, "NOT_FOUND", "This action was not found.");
        if (isTicketLockedForActions(ticket.currentStatus)) {
          return sendError(res, 409, "TICKET_LOCKED", "Actions on a closed or cancelled Ticket can't be changed.");
        }
        if (isActionLocked(action.status as ActionStatus)) {
          return sendError(res, 409, "ACTION_LOCKED", "Completed or cancelled actions can't be changed. Add a new action instead.");
        }

        const { value, errors } = validateActionFields(body, currentFields(action), {
          ticketCreatedAt: ticket.createdAt,
          now: new Date(),
        });
        if (Object.keys(errors).length > 0) return sendValidation(res, errors);

        const data: Record<string, unknown> = { ...value };
        if (body.assigneeId !== undefined) {
          if (!(await isValidAssignee(body.assigneeId))) {
            return sendError(res, 422, "INVALID_ASSIGNEE", "The assignee must be an active IT Staff member or Administrator.");
          }
          data.assigneeId = body.assigneeId;
        }

        const updated = await guardedUpdate(res, ticketId, actionId, expectedVersion, data);
        if (updated) res.status(200).json(serialize(updated));
      } catch {
        sendError(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
      }
    },
  );

  // POST /api/tickets/:id/actions/:actionId/transition — IT Staff / Administrator (BR-11)
  router.post(
    "/api/tickets/:id/actions/:actionId/transition",
    requireAuth,
    requireRole(...STAFF_ROLES),
    async (req: Request, res: Response) => {
      try {
        const prisma = getPrisma();
        const userId = req.session.userId!;
        const ticketId = parseId(req.params.id);
        const actionId = parseId(req.params.actionId);
        if (!ticketId || !actionId) return sendError(res, 404, "NOT_FOUND", "This action was not found.");

        const body = (req.body ?? {}) as Record<string, unknown>;
        const expectedVersion = parseExpectedVersion(body.expectedVersion);
        if (!expectedVersion) return sendError(res, 400, "BAD_REQUEST", "expectedVersion is required.");
        const to = body.to as ActionStatus;

        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        const action = await prisma.actionTaken.findFirst({ where: { id: actionId, ticketId } });
        if (!ticket || !action) return sendError(res, 404, "NOT_FOUND", "This action was not found.");
        if (isTicketLockedForActions(ticket.currentStatus)) {
          return sendError(res, 409, "TICKET_LOCKED", "Actions on a closed or cancelled Ticket can't be changed.");
        }
        if (isActionLocked(action.status as ActionStatus)) {
          return sendError(res, 409, "ACTION_LOCKED", "Completed or cancelled actions can't be changed. Add a new action instead.");
        }
        if (!canTransitionAction(action.status as ActionStatus, to)) {
          return sendError(res, 409, "INVALID_TRANSITION", `Cannot move an action from ${action.status} to ${String(to)}.`, {
            allowed: (["IN_PROGRESS", "COMPLETED", "CANCELLED"] as ActionStatus[]).filter((s) =>
              canTransitionAction(action.status as ActionStatus, s),
            ),
          });
        }

        const data: Record<string, unknown> = { status: to };
        if (to === "COMPLETED") {
          let result = action.result as string | null;
          if (body.result !== undefined) {
            result = typeof body.result === "string" ? body.result.trim() || null : null;
          }
          const errors = validateCompletion(result);
          if (!errors.result && result && result.length > ACTION_LIMITS.result) {
            errors.result = `Result must be at most ${ACTION_LIMITS.result} characters.`;
          }
          if (Object.keys(errors).length > 0) return sendValidation(res, errors);
          data.result = result;
          data.performedById = userId; // BR-05: never from the request body
        }

        const updated = await guardedUpdate(res, ticketId, actionId, expectedVersion, data);
        if (updated) res.status(200).json(serialize(updated));
      } catch {
        sendError(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
      }
    },
  );

  return router;
}
