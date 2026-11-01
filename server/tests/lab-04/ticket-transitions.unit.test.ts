// Lab 4 — UNIT-01, UNIT-02 (docs/lab-04/tests.md). Pure rules, no database.
import { describe, it, expect } from "vitest";
import {
  STATUS_TRANSITIONS,
  TICKET_STATUSES,
  TicketStatus,
  Role,
  allowedTransitions,
  canTransitionTicket,
  checkResolutionGate,
  transitionSideEffects,
  validateReason,
} from "../../src/lab4/ticketWorkflow.js";

// Expected matrix from docs/lab-04/specification.md §5.3 (S cells).
const EXPECTED: Record<TicketStatus, TicketStatus[]> = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_REQUESTER", "RESOLVED", "CANCELLED"],
  WAITING_FOR_REQUESTER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["OPEN", "IN_PROGRESS", "CANCELLED"],
  CANCELLED: [],
};
const ROLES: Role[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

describe("UNIT-01 — Ticket transition matrix (BR-16)", () => {
  it("matches the specification table exactly", () => {
    expect(STATUS_TRANSITIONS).toEqual(EXPECTED);
  });

  it("checks all 8 × 8 × 3 combinations", () => {
    let checked = 0;
    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        for (const role of ROLES) {
          const expected = role !== "REQUESTER" && EXPECTED[from].includes(to);
          expect(canTransitionTicket(from, to, role), `${role}: ${from} → ${to}`).toBe(expected);
          checked++;
        }
      }
    }
    expect(checked).toBe(192);
  });

  it("never allows a same-status transition", () => {
    for (const s of TICKET_STATUSES) expect(canTransitionTicket(s, s, "ADMINISTRATOR")).toBe(false);
  });

  it("Cancelled is terminal", () => {
    expect(allowedTransitions("CANCELLED", "IT_STAFF")).toEqual([]);
  });

  it("Requesters never get formal transitions", () => {
    for (const s of TICKET_STATUSES) expect(allowedTransitions(s, "REQUESTER")).toEqual([]);
  });
});

describe("UNIT-02 — Resolution gate (BR-17)", () => {
  it("fails with no actions", () => {
    expect(checkResolutionGate([])).toEqual({ ok: false, reason: "NO_COMPLETED_ACTION" });
  });

  it("fails with only cancelled actions", () => {
    expect(checkResolutionGate(["CANCELLED"])).toEqual({ ok: false, reason: "NO_COMPLETED_ACTION" });
  });

  it("fails while an action is still open", () => {
    expect(checkResolutionGate(["COMPLETED", "PLANNED"])).toEqual({ ok: false, reason: "OPEN_ACTIONS_REMAIN" });
    expect(checkResolutionGate(["COMPLETED", "IN_PROGRESS"])).toEqual({ ok: false, reason: "OPEN_ACTIONS_REMAIN" });
  });

  it("passes with completed actions and nothing open", () => {
    expect(checkResolutionGate(["COMPLETED"])).toEqual({ ok: true });
    expect(checkResolutionGate(["COMPLETED", "CANCELLED", "COMPLETED"])).toEqual({ ok: true });
  });
});

describe("Cancel reason and side effects (BR-18..BR-20)", () => {
  it("requires a reason to cancel", () => {
    expect(validateReason("CANCELLED", undefined).error).toBeDefined();
    expect(validateReason("CANCELLED", "   ").error).toBeDefined();
    expect(validateReason("CANCELLED", "Duplicate request")).toEqual({ value: "Duplicate request" });
  });

  it("keeps the reason optional for other transitions and limits its length", () => {
    expect(validateReason("OPEN", undefined)).toEqual({ value: null });
    expect(validateReason("OPEN", "a".repeat(501)).error).toBeDefined();
  });

  it("sets and clears timestamps", () => {
    const now = new Date();
    expect(transitionSideEffects("RESOLVED", now)).toMatchObject({ resolvedAt: now, requesterMarkedResolved: false });
    expect(transitionSideEffects("CLOSED", now)).toMatchObject({ closedAt: now });
    expect(transitionSideEffects("REOPENED", now)).toMatchObject({ resolvedAt: null, closedAt: null });
    expect(transitionSideEffects("OPEN", now)).not.toHaveProperty("resolvedAt");
  });
});
