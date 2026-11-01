// Lab 4 — Ticket workflow API (docs/lab-04/api-spec.md, "Ticket Workflow").
// Replaces the Lab 3 status and "problem appears resolved" handlers, same paths.
import { Router, Request, Response, RequestHandler } from "express";
import { getPrisma } from "../prisma.js";
import { parseExpectedVersion } from "./actionRules.js";
import {
  GATE_MESSAGES,
  REQUESTER_MARKABLE,
  Role,
  TicketStatus,
  TICKET_STATUSES,
  allowedTransitions,
  canTransitionTicket,
  checkResolutionGate,
  transitionSideEffects,
  validateReason,
} from "./ticketWorkflow.js";

type Deps = {
  requireAuth: RequestHandler;
  requireRole: (...roles: Role[]) => RequestHandler;
};

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
  }
}

function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  return res.status(status).json({ error: { code, message, ...(details !== undefined && { details }) } });
}

function parseId(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function withAllowedTransitions<T extends { currentStatus: string }>(ticket: T, role: Role) {
  return { ...ticket, allowedTransitions: allowedTransitions(ticket.currentStatus as TicketStatus, role) };
}

export function createWorkflowRouter({ requireAuth, requireRole }: Deps): Router {
  const router = Router();

  // PATCH /api/staff/tickets/:id/status — extended Lab 3 endpoint (BR-16..BR-22)
  router.patch(
    "/api/staff/tickets/:id/status",
    requireAuth,
    requireRole("IT_STAFF", "ADMINISTRATOR"),
    async (req: Request, res: Response) => {
      const ticketId = parseId(req.params.id);
      if (!ticketId) return sendError(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");
      const role = req.session.role as Role;
      const actorId = req.session.userId!;
      const body = (req.body ?? {}) as Record<string, unknown>;
      const to = body.status as TicketStatus;

      // expectedVersion is optional for Lab 3 clients (BR-22), but must be valid if sent.
      let expectedVersion: number | null = null;
      if (body.expectedVersion !== undefined) {
        expectedVersion = parseExpectedVersion(body.expectedVersion);
        if (!expectedVersion) return sendError(res, 400, "BAD_REQUEST", "expectedVersion must be a positive integer.");
      }

      try {
        const updated = await getPrisma().$transaction(async (tx: any) => {
          const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
          if (!ticket) throw new HttpError(404, "TICKET_NOT_FOUND", "Ticket not found.");

          if (expectedVersion !== null && ticket.version !== expectedVersion) {
            throw new HttpError(409, "STALE_UPDATE", "This Ticket was changed by someone else. Review the latest version and try again.", {
              current: withAllowedTransitions(ticket, role),
            });
          }

          if (!TICKET_STATUSES.includes(to) || !canTransitionTicket(ticket.currentStatus, to, role)) {
            throw new HttpError(409, "INVALID_TRANSITION", `Cannot move from ${ticket.currentStatus} to ${String(to)}.`, {
              allowed: allowedTransitions(ticket.currentStatus, role),
            });
          }

          const reason = validateReason(to, body.reason);
          if (reason.error) {
            throw new HttpError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", { fields: { reason: reason.error } });
          }

          if (to === "RESOLVED") {
            const actions = await tx.actionTaken.findMany({ where: { ticketId }, select: { status: true } });
            const gate = checkResolutionGate(actions.map((a: { status: string }) => a.status));
            if (!gate.ok) {
              throw new HttpError(409, "RESOLUTION_GATE", GATE_MESSAGES[gate.reason], { reason: gate.reason });
            }
          }

          // Guard on the version we read, so a concurrent change between read and write is detected.
          const { count } = await tx.ticket.updateMany({
            where: { id: ticketId, version: ticket.version },
            data: { currentStatus: to, version: { increment: 1 }, ...transitionSideEffects(to, new Date()) },
          });
          if (count !== 1) {
            const current = await tx.ticket.findUnique({ where: { id: ticketId } });
            throw new HttpError(409, "STALE_UPDATE", "This Ticket was changed by someone else. Review the latest version and try again.", {
              current: withAllowedTransitions(current, role),
            });
          }

          await tx.ticketStatusChange.create({
            data: { ticketId, fromStatus: ticket.currentStatus, toStatus: to, actorId, reason: reason.value },
          });

          return tx.ticket.findUnique({ where: { id: ticketId } });
        });

        res.status(200).json({ ticket: withAllowedTransitions(updated, role) });
      } catch (e) {
        if (e instanceof HttpError) return sendError(res, e.status, e.code, e.message, e.details);
        sendError(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
      }
    },
  );

  // GET /api/tickets/:id/status-history — staff any Ticket, Requester own Ticket (BR-21)
  router.get("/api/tickets/:id/status-history", requireAuth, async (req: Request, res: Response) => {
    try {
      const prisma = getPrisma();
      const ticketId = parseId(req.params.id);
      if (!ticketId) return sendError(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      const isStaff = req.session.role === "IT_STAFF" || req.session.role === "ADMINISTRATOR";
      if (!ticket || (!isStaff && ticket.requesterId !== req.session.userId)) {
        return sendError(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");
      }

      const items = await prisma.ticketStatusChange.findMany({
        where: { ticketId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          reason: true,
          createdAt: true,
          actor: { select: { id: true, name: true } },
        },
      });
      res.status(200).json({ items });
    } catch {
      sendError(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
    }
  });

  // POST /api/tickets/:id/resolved-by-requester — extended Lab 3 endpoint (BR-19), advisory only
  router.post(
    "/api/tickets/:id/resolved-by-requester",
    requireAuth,
    requireRole("REQUESTER"),
    async (req: Request, res: Response) => {
      try {
        const prisma = getPrisma();
        const ticketId = parseId(req.params.id);
        if (!ticketId) return sendError(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");

        const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId: req.session.userId! } });
        if (!ticket) return sendError(res, 404, "TICKET_NOT_FOUND", "Ticket not found.");

        if (!REQUESTER_MARKABLE.includes(ticket.currentStatus as TicketStatus)) {
          return sendError(res, 409, "INVALID_TRANSITION", "You can only mark a Ticket as resolved while IT is working on it.");
        }

        // Idempotent: the first timestamp is kept. The formal status never changes here.
        const updated = ticket.requesterMarkedResolved
          ? ticket
          : await prisma.ticket.update({
              where: { id: ticketId },
              data: { requesterMarkedResolved: true, requesterMarkedResolvedAt: new Date() },
            });

        res.status(200).json({ ticket: withAllowedTransitions(updated, "REQUESTER") });
      } catch {
        sendError(res, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
      }
    },
  );

  return router;
}
