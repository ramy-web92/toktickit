// Lab 4 — pure Ticket workflow rules (specification §5.3, BR-16..BR-20).
// The matrix is the Lab 3 matrix (Lab 3 BR-13), kept unchanged for regression.

export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

export type Role = "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";

export const TICKET_STATUSES: TicketStatus[] = [
  "NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED",
];

export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};

/** Statuses in which a Requester may mark the problem as appearing resolved (BR-19). */
export const REQUESTER_MARKABLE: TicketStatus[] = ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "REOPENED"];

export const REASON_MAX = 500;

/** Transitions the given role may perform from a status. Requesters never change the formal status. */
export function allowedTransitions(from: TicketStatus, role: Role): TicketStatus[] {
  if (role !== "IT_STAFF" && role !== "ADMINISTRATOR") return [];
  return STATUS_TRANSITIONS[from] ?? [];
}

export function canTransitionTicket(from: TicketStatus, to: TicketStatus, role: Role): boolean {
  return allowedTransitions(from, role).includes(to);
}

export type GateResult = { ok: true } | { ok: false; reason: "NO_COMPLETED_ACTION" | "OPEN_ACTIONS_REMAIN" };

/** BR-17 resolution gate: ≥1 COMPLETED action and no PLANNED / IN_PROGRESS action. */
export function checkResolutionGate(actionStatuses: string[]): GateResult {
  if (actionStatuses.some((s) => s === "PLANNED" || s === "IN_PROGRESS")) {
    return { ok: false, reason: "OPEN_ACTIONS_REMAIN" };
  }
  if (!actionStatuses.includes("COMPLETED")) return { ok: false, reason: "NO_COMPLETED_ACTION" };
  return { ok: true };
}

export const GATE_MESSAGES = {
  NO_COMPLETED_ACTION: "Complete at least one action before resolving this Ticket.",
  OPEN_ACTIONS_REMAIN: "Complete or cancel all open actions before resolving this Ticket.",
} as const;

/** BR-20: a reason is required to cancel; optional otherwise, max 500 chars. */
export function validateReason(to: TicketStatus, reason: unknown): { value: string | null; error?: string } {
  const value = typeof reason === "string" && reason.trim().length > 0 ? reason.trim() : null;
  if (reason !== undefined && reason !== null && typeof reason !== "string") return { value: null, error: "Reason must be text." };
  if (to === "CANCELLED" && !value) return { value: null, error: "A reason is required to cancel a Ticket." };
  if (value && value.length > REASON_MAX) return { value: null, error: `Reason must be at most ${REASON_MAX} characters.` };
  return { value };
}

/** BR-18 / BR-19: timestamp and flag changes that go with a status change. */
export function transitionSideEffects(to: TicketStatus, now: Date) {
  return {
    ...(to === "RESOLVED" && { resolvedAt: now }),
    ...(to === "CLOSED" && { closedAt: now }),
    ...(to === "REOPENED" && { resolvedAt: null, closedAt: null }),
    requesterMarkedResolved: false,
    requesterMarkedResolvedAt: null,
  };
}
