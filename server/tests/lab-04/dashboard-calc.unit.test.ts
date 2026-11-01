// Lab 4 — UNIT-05 (docs/lab-04/tests.md). Pure helpers, no database.
import { describe, it, expect } from "vitest";
import {
  ACTIVE_STATUSES,
  drillDown,
  recentlyResolvedSince,
  requesterListFilters,
  staffQueueFilters,
  startOfDayBangkok,
} from "../../src/lab4/dashboard.js";

describe("UNIT-05 — Asia/Bangkok day boundaries", () => {
  it("uses the Bangkok calendar day, not the UTC one", () => {
    // 2026-10-20 18:30 UTC is already 2026-10-21 01:30 in Bangkok
    const start = startOfDayBangkok(new Date("2026-10-20T18:30:00Z"));
    expect(start.toISOString()).toBe("2026-10-20T17:00:00.000Z"); // 2026-10-21 00:00 Bangkok
  });

  it("stays on the same Bangkok day just before midnight", () => {
    const start = startOfDayBangkok(new Date("2026-10-20T16:59:59Z")); // 23:59:59 Bangkok
    expect(start.toISOString()).toBe("2026-10-19T17:00:00.000Z");
  });

  it("recently resolved window starts 7 Bangkok days back", () => {
    const since = recentlyResolvedSince(new Date("2026-10-20T18:30:00Z"));
    expect(since.toISOString()).toBe("2026-10-13T17:00:00.000Z");
  });
});

describe("Shared list filters (AC-17)", () => {
  it("status=active expands to the 5 active statuses", () => {
    expect(staffQueueFilters({ status: "active" }, 6)).toEqual({ currentStatus: { in: [...ACTIVE_STATUSES] } });
    expect(requesterListFilters({ currentStatus: "active" })).toEqual({ currentStatus: { in: [...ACTIVE_STATUSES] } });
  });

  it("keeps Lab 3 owner filters", () => {
    expect(staffQueueFilters({ owner: "unassigned" }, 6)).toEqual({ ownerId: null });
    expect(staffQueueFilters({ owner: "me" }, 6)).toEqual({ ownerId: 6 });
    expect(staffQueueFilters({ owner: "7" }, 6)).toEqual({ ownerId: 7 });
  });

  it("follow-up pending implies active Tickets", () => {
    const where = staffQueueFilters({ followUp: "pending" }, 6) as any;
    expect(where.currentStatus).toEqual({ in: [...ACTIVE_STATUSES] });
    expect(where.AND[0].actionsTaken.some).toEqual({ status: "COMPLETED", followUpRequired: true });
  });

  it("actionAssignee=me filters on open actions assigned to the current user", () => {
    const where = staffQueueFilters({ actionAssignee: "me" }, 6) as any;
    expect(where.AND[0].actionsTaken.some).toEqual({ assigneeId: 6, status: { in: ["PLANNED", "IN_PROGRESS"] } });
  });

  it("ignores empty params", () => {
    expect(staffQueueFilters({ status: "", owner: "" }, 6)).toEqual({});
    expect(requesterListFilters({})).toEqual({});
  });

  it("builds drill-down links from the same params", () => {
    expect(drillDown("/queue", { owner: "unassigned", status: "active" })).toBe("/queue?owner=unassigned&status=active");
  });
});
