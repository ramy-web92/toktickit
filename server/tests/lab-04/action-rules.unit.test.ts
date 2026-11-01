// Lab 4 — UNIT-03, UNIT-04 (docs/lab-04/tests.md). Pure rules, no database.
import { describe, it, expect } from "vitest";
import {
  ActionFields,
  canTransitionAction,
  isActionLocked,
  isTicketLockedForActions,
  parseExpectedVersion,
  validateActionFields,
  validateCompletion,
} from "../../src/lab4/actionRules.js";

const now = new Date("2026-10-20T10:00:00Z");
const ticketCreatedAt = new Date("2026-10-19T10:00:00Z");
const ctx = { now, ticketCreatedAt };
const empty: ActionFields = {
  description: "", result: null, followUpRequired: false, followUpNote: null, attachmentNotes: null, actionAt: now,
};

describe("UNIT-03 — Action status transitions (BR-11)", () => {
  it.each([
    ["PLANNED", "IN_PROGRESS", true],
    ["PLANNED", "COMPLETED", true],
    ["PLANNED", "CANCELLED", true],
    ["IN_PROGRESS", "COMPLETED", true],
    ["IN_PROGRESS", "CANCELLED", true],
    ["IN_PROGRESS", "PLANNED", false],
    ["PLANNED", "PLANNED", false],
    ["COMPLETED", "IN_PROGRESS", false],
    ["COMPLETED", "CANCELLED", false],
    ["CANCELLED", "PLANNED", false],
    ["CANCELLED", "COMPLETED", false],
  ] as const)("%s → %s is %s", (from, to, allowed) => {
    expect(canTransitionAction(from, to)).toBe(allowed);
  });

  it("rejects an unknown target status", () => {
    expect(canTransitionAction("PLANNED", "DONE" as never)).toBe(false);
  });

  it("COMPLETED and CANCELLED are locked (BR-12)", () => {
    expect(isActionLocked("COMPLETED")).toBe(true);
    expect(isActionLocked("CANCELLED")).toBe(true);
    expect(isActionLocked("PLANNED")).toBe(false);
    expect(isActionLocked("IN_PROGRESS")).toBe(false);
  });

  it("Closed and Cancelled Tickets are locked for actions (BR-13)", () => {
    expect(isTicketLockedForActions("CLOSED")).toBe(true);
    expect(isTicketLockedForActions("CANCELLED")).toBe(true);
    expect(isTicketLockedForActions("RESOLVED")).toBe(false);
    expect(isTicketLockedForActions("IN_PROGRESS")).toBe(false);
  });
});

describe("UNIT-04 — Action field validation (BR-07..BR-10)", () => {
  it("accepts a minimal valid action and trims text", () => {
    const { value, errors } = validateActionFields({ description: "  Reset password  " }, empty, ctx);
    expect(errors).toEqual({});
    expect(value.description).toBe("Reset password");
    expect(value.followUpNote).toBeNull();
  });

  it("requires a description", () => {
    expect(validateActionFields({ description: "   " }, empty, ctx).errors.description).toBeDefined();
    expect(validateActionFields({}, empty, ctx).errors.description).toBeDefined();
  });

  it("limits the description to 2000 characters", () => {
    expect(validateActionFields({ description: "a".repeat(2000) }, empty, ctx).errors).toEqual({});
    expect(validateActionFields({ description: "a".repeat(2001) }, empty, ctx).errors.description).toBeDefined();
  });

  it("requires a follow-up note when follow-up is needed (BR-08)", () => {
    const { errors } = validateActionFields({ description: "x", followUpRequired: true }, empty, ctx);
    expect(errors.followUpNote).toBeDefined();
  });

  it("clears the follow-up note when follow-up is not needed (BR-08)", () => {
    const { value, errors } = validateActionFields(
      { description: "x", followUpRequired: false, followUpNote: "ignored" }, empty, ctx,
    );
    expect(errors).toEqual({});
    expect(value.followUpNote).toBeNull();
  });

  it("rejects a non-boolean followUpRequired", () => {
    expect(validateActionFields({ description: "x", followUpRequired: "yes" }, empty, ctx).errors.followUpRequired).toBeDefined();
  });

  it("limits attachment notes to 500 characters (BR-10)", () => {
    expect(validateActionFields({ description: "x", attachmentNotes: "a".repeat(501) }, empty, ctx).errors.attachmentNotes).toBeDefined();
  });

  it("rejects an action date in the future beyond the 5-minute tolerance (BR-09)", () => {
    const in4min = new Date(now.getTime() + 4 * 60_000).toISOString();
    const in10min = new Date(now.getTime() + 10 * 60_000).toISOString();
    expect(validateActionFields({ description: "x", actionAt: in4min }, empty, ctx).errors).toEqual({});
    expect(validateActionFields({ description: "x", actionAt: in10min }, empty, ctx).errors.actionAt).toBeDefined();
  });

  it("rejects an action date before the Ticket was created (BR-09)", () => {
    const before = new Date(ticketCreatedAt.getTime() - 2 * 60_000).toISOString();
    expect(validateActionFields({ description: "x", actionAt: before }, empty, ctx).errors.actionAt).toBeDefined();
  });

  it("accepts the picker's whole minute for a Ticket created seconds ago (BR-09)", () => {
    const created = new Date("2026-10-20T10:00:42Z");
    const sameMinute = "2026-10-20T10:00:00.000Z"; // what a minute-precision picker sends
    expect(
      validateActionFields({ description: "x", actionAt: sameMinute }, empty, { now: created, ticketCreatedAt: created }).errors,
    ).toEqual({});
  });

  it("rejects an invalid date", () => {
    expect(validateActionFields({ description: "x", actionAt: "not-a-date" }, empty, ctx).errors.actionAt).toBeDefined();
  });

  it("merges a partial update onto current values (PATCH)", () => {
    const current: ActionFields = { ...empty, description: "Old", followUpRequired: true, followUpNote: "Keep" };
    const { value, errors } = validateActionFields({ result: "Done" }, current, ctx);
    expect(errors).toEqual({});
    expect(value).toMatchObject({ description: "Old", result: "Done", followUpNote: "Keep" });
  });

  it("requires a result to complete (BR-07)", () => {
    expect(validateCompletion(null).result).toBeDefined();
    expect(validateCompletion("  ").result).toBeDefined();
    expect(validateCompletion("Fixed")).toEqual({});
  });

  it("parses expectedVersion (BR-22)", () => {
    expect(parseExpectedVersion(3)).toBe(3);
    expect(parseExpectedVersion("2")).toBe(2);
    expect(parseExpectedVersion(0)).toBeNull();
    expect(parseExpectedVersion(undefined)).toBeNull();
    expect(parseExpectedVersion("abc")).toBeNull();
  });
});
