// Lab 4 — dashboard calculations and shared list filters (specification §5.5).
// The dashboard counts and the drill-down lists use the SAME filter builders,
// so a metric always equals the number of rows its drill-down shows (AC-17).

export const ACTIVE_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"] as const;
export const ALL_STATUSES = [
  "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

/** D-05: day boundaries use Asia/Bangkok (UTC+7, no daylight saving time). */
export const DASHBOARD_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the current calendar day in Bangkok, as a UTC instant. */
export function startOfDayBangkok(now: Date): Date {
  const local = now.getTime() + BANGKOK_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - BANGKOK_OFFSET_MS);
}

/** RQ-L2 window: from the start of the Bangkok day 7 days ago. */
export function recentlyResolvedSince(now: Date): Date {
  return new Date(startOfDayBangkok(now).getTime() - 7 * DAY_MS);
}

export const RECENT_LIMIT = 5;

type Query = Record<string, unknown>;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Status filter shared by both lists: a single status, or "active". */
export function statusFilter(value: unknown) {
  const s = str(value);
  if (!s) return undefined;
  if (s === "active") return { in: [...ACTIVE_STATUSES] };
  return s;
}

/**
 * IT Staff Ticket Queue filters (Lab 3 + Lab 4 drill-down params).
 * Search, category and sorting stay in the Lab 3 handler.
 */
export function staffQueueFilters(query: Query, currentUserId: number): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  const status = statusFilter(query.status);
  if (status) where.currentStatus = status;

  const owner = str(query.owner);
  if (owner === "unassigned") where.ownerId = null;
  else if (owner === "me") where.ownerId = currentUserId;
  else if (owner && !Number.isNaN(Number(owner))) where.ownerId = Number(owner);

  const itPriority = str(query.itPriority);
  if (itPriority) where.itPriority = itPriority;

  // ST-M5: Tickets with an open action assigned to me
  if (query.actionAssignee === "me") {
    and.push({ actionsTaken: { some: { assigneeId: currentUserId, status: { in: ["PLANNED", "IN_PROGRESS"] } } } });
  }
  // ST-M6: active Tickets with a completed action that needs follow-up
  if (query.followUp === "pending") {
    and.push({ actionsTaken: { some: { status: "COMPLETED", followUpRequired: true } } });
    if (!status) where.currentStatus = { in: [...ACTIVE_STATUSES] };
  }

  if (and.length > 0) where.AND = and;
  return where;
}

/** Requester "My Tickets" status filter (Lab 2 param currentStatus, plus "active"). */
export function requesterListFilters(query: Query): Record<string, unknown> {
  const status = statusFilter(query.currentStatus);
  return status ? { currentStatus: status } : {};
}

/** Builds a drill-down link from the same query params the list API accepts. */
export function drillDown(path: string, params: Record<string, string>): string {
  return `${path}?${new URLSearchParams(params).toString()}`;
}
