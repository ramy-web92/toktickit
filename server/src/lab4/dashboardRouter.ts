// Lab 4 — Requester and IT Staff dashboards (docs/lab-04/api-spec.md, "Dashboards").
import { Router, Request, Response, RequestHandler } from "express";
import { getPrisma } from "../prisma.js";
import {
  ACTIVE_STATUSES,
  ALL_STATUSES,
  DASHBOARD_TIME_ZONE,
  PRIORITIES,
  RECENT_LIMIT,
  drillDown,
  recentlyResolvedSince,
  requesterListFilters,
  staffQueueFilters,
} from "./dashboard.js";

type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
type Deps = {
  requireAuth: RequestHandler;
  requireRole: (...roles: Role[]) => RequestHandler;
};

const ticketSummary = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  itPriority: true,
  updatedAt: true,
  resolvedAt: true,
  requesterMarkedResolved: true,
};

function sendFailure(res: Response) {
  // AC-19: generic, user-safe message, no internals.
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "We couldn't load the dashboard. Please try again." } });
}

export function createDashboardRouter({ requireAuth, requireRole }: Deps): Router {
  const router = Router();

  // GET /api/dashboard/requester — only the authenticated Requester's Tickets (BR-15, AC-02)
  router.get("/api/dashboard/requester", requireAuth, requireRole("REQUESTER"), async (req: Request, res: Response) => {
    try {
      const prisma = getPrisma();
      const requesterId = req.session.userId!;
      const now = new Date();

      const metricDefs = [
        { id: "RQ-M1", label: "My Open Tickets", currentStatus: "active" },
        { id: "RQ-M2", label: "Waiting for Me", currentStatus: "WAITING_FOR_REQUESTER" },
        { id: "RQ-M3", label: "Resolved", currentStatus: "RESOLVED" },
        { id: "RQ-M4", label: "Closed", currentStatus: "CLOSED" },
      ];

      const [values, recentlyUpdated, recentlyResolved] = await Promise.all([
        Promise.all(
          metricDefs.map((m) =>
            prisma.ticket.count({ where: { requesterId, ...requesterListFilters({ currentStatus: m.currentStatus }) } }),
          ),
        ),
        prisma.ticket.findMany({
          where: { requesterId },
          select: ticketSummary,
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: RECENT_LIMIT,
        }),
        prisma.ticket.findMany({
          where: { requesterId, resolvedAt: { gte: recentlyResolvedSince(now) } },
          select: ticketSummary,
          orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
          take: RECENT_LIMIT,
        }),
      ]);

      res.status(200).json({
        generatedAt: now.toISOString(),
        timeZone: DASHBOARD_TIME_ZONE,
        metrics: metricDefs.map((m, i) => ({
          id: m.id,
          label: m.label,
          value: values[i],
          drillDown: drillDown("/my-tickets", { currentStatus: m.currentStatus }),
        })),
        recentlyUpdated,
        recentlyResolved,
      });
    } catch {
      sendFailure(res);
    }
  });

  // GET /api/dashboard/staff — IT Staff and Administrator
  router.get(
    "/api/dashboard/staff",
    requireAuth,
    requireRole("IT_STAFF", "ADMINISTRATOR"),
    async (req: Request, res: Response) => {
      try {
        const prisma = getPrisma();
        const me = req.session.userId!;
        const now = new Date();
        const count = (params: Record<string, string>) =>
          prisma.ticket.count({ where: staffQueueFilters(params, me) });

        const metricDefs: Array<{ id: string; label: string; params: Record<string, string> }> = [
          { id: "ST-M1", label: "Unassigned", params: { owner: "unassigned", status: "active" } },
          { id: "ST-M2", label: "My Assigned", params: { owner: "me", status: "active" } },
          { id: "ST-M5", label: "Tickets with My Open Actions", params: { actionAssignee: "me" } },
          { id: "ST-M6", label: "Follow-ups Pending", params: { followUp: "pending" } },
        ];

        const active = { currentStatus: { in: [...ACTIVE_STATUSES] } };
        const [metricValues, statusValues, priorityValues, recentlyUpdated, urgent] = await Promise.all([
          Promise.all(metricDefs.map((m) => count(m.params))),
          Promise.all(ALL_STATUSES.map((s) => count({ status: s }))),
          Promise.all(PRIORITIES.map((p) => count({ itPriority: p, status: "active" }))),
          prisma.ticket.findMany({
            where: active,
            select: { ...ticketSummary, owner: { select: { id: true, name: true } } },
            orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
            take: RECENT_LIMIT,
          }),
          prisma.ticket.findMany({
            where: active,
            select: { ...ticketSummary, owner: { select: { id: true, name: true } } },
            // Priority enum order is LOW < MEDIUM < HIGH, so desc puts HIGH first; oldest first within a priority.
            orderBy: [{ itPriority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
            take: RECENT_LIMIT,
          }),
        ]);

        let users: Array<{ role: string; active: number; inactive: number }> | undefined;
        if (req.session.role === "ADMINISTRATOR") {
          const roles = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const;
          users = await Promise.all(
            roles.map(async (role) => ({
              role,
              active: await prisma.user.count({ where: { role, isActive: true } }),
              inactive: await prisma.user.count({ where: { role, isActive: false } }),
              drillDown: drillDown("/admin/users", { role }),
            })),
          );
        }

        res.status(200).json({
          generatedAt: now.toISOString(),
          timeZone: DASHBOARD_TIME_ZONE,
          metrics: metricDefs.map((m, i) => ({
            id: m.id,
            label: m.label,
            value: metricValues[i],
            drillDown: drillDown("/queue", m.params),
          })),
          byStatus: ALL_STATUSES.map((status, i) => ({
            status,
            value: statusValues[i],
            drillDown: drillDown("/queue", { status }),
          })),
          byPriority: PRIORITIES.map((itPriority, i) => ({
            itPriority,
            value: priorityValues[i],
            drillDown: drillDown("/queue", { itPriority, status: "active" }),
          })),
          recentlyUpdated,
          urgent,
          ...(users && { users }),
        });
      } catch {
        sendFailure(res);
      }
    },
  );

  // GET /api/health/ready — API + database readiness (API-31). /api/health stays as in Lab 1.
  router.get("/api/health/ready", async (_req: Request, res: Response) => {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      res.status(200).json({ status: "ok", service: "TokTickIT API", db: "ok" });
    } catch {
      res.status(503).json({ status: "degraded", service: "TokTickIT API", db: "error" });
    }
  });

  return router;
}
