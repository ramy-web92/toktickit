# TokTickIT — Sprint 4 Test Plan and Traceability

Tools (assumed from Labs 2–3): Vitest/Jest + Supertest (server), Vitest + React Testing Library (client), Playwright + @axe-core/playwright (E2E). Tests are written before or with the implementation (TDD): each test starts **Planned → Red → Green**. Final column filled at the end of the sprint from the `main` CI run.

Paths: `server/tests/lab-04/`, `client/src/__tests__/lab-04/`, `e2e/lab-04/`.

## Unit

| Test ID | Req / AC | What it tests | Expected | File | Final |
|---|---|---|---|---|---|
| UNIT-01 | BR-16, AC-10 | `canTransition(from,to,role)` for all 8×8×3 combinations vs matrix | Matches spec table exactly | server/tests/lab-04/ticket-transitions.unit.test.ts | |
| UNIT-02 | BR-17, AC-11 | `checkResolutionGate(actions)` with 0 actions / only open / mixed / all done | Correct pass/fail + reason | server/tests/lab-04/ticket-transitions.unit.test.ts | |
| UNIT-03 | BR-11 | Action status transitions incl. final states | Only allowed ones pass | server/tests/lab-04/action-rules.unit.test.ts | |
| UNIT-04 | BR-07..10, AC-05 | Action validation schema (lengths, follow-up note, future date) | Field errors as specified | server/tests/lab-04/action-rules.unit.test.ts | |
| UNIT-05 | §5.5 | Bangkok day-boundary helper (7-day window around midnight UTC) | Correct boundaries | server/tests/lab-04/dashboard-calc.unit.test.ts | |

## API / Integration

| Test ID | Req / AC | What it tests | Expected | File | Final |
|---|---|---|---|---|---|
| API-01 | FR-06 | List actions, staff | 200, ordered actionAt ASC, id ASC | server/tests/lab-04/actions-taken.api.test.ts | |
| API-02 | FR-07, AC-24 | List actions, Requester own vs other's Ticket | 200 / 404 | actions-taken.api.test.ts | |
| API-03 | AC-01 | Create valid action as IT Staff | 201, createdBy = me, assignee = me (default) | actions-taken.api.test.ts | |
| API-04 | BR-04 | Body contains createdById/performedById/status | Ignored by server | actions-taken.api.test.ts | |
| API-05 | AC-04 | Requester POST/PATCH/transition | 403, DB unchanged | actions-taken.api.test.ts | |
| API-06 | AC-05 | followUpRequired true without note | 422 field error | actions-taken.api.test.ts | |
| API-07 | AC-06 | Assign inactive staff / Requester | 422 INVALID_ASSIGNEE | actions-taken.api.test.ts | |
| API-08 | FR-04 | Reassign to other active staff | 200, version+1 | actions-taken.api.test.ts | |
| API-09 | AC-07 | Complete without result / with result | 422 / 200, performedBy = me | actions-taken.api.test.ts | |
| API-10 | AC-08 | Edit or transition COMPLETED/CANCELLED | 409 ACTION_LOCKED | actions-taken.api.test.ts | |
| API-11 | AC-09 | Create action on Closed/Cancelled Ticket | 409 TICKET_LOCKED | actions-taken.api.test.ts | |
| API-12 | AC-13 | Two PATCH with same expectedVersion | 200 then 409 STALE_UPDATE with current | actions-taken.api.test.ts | |
| API-13 | AC-14 | Same Idempotency-Key twice, and in parallel | 1 row; 201 then 200 | actions-taken.api.test.ts | |
| API-14 | AC-10 | Each permitted transition per role | 200 + history row | server/tests/lab-04/ticket-workflow.api.test.ts | |
| API-15 | AC-10 | Representative forbidden transitions (same-status, from Closed/Cancelled, Requester → Resolved) | 409 / 403 | ticket-workflow.api.test.ts | |
| API-16 | AC-11 | Resolve with no completed action / with open action | 409 RESOLUTION_GATE + reason | ticket-workflow.api.test.ts | |
| API-17 | BR-18 | resolvedAt/closedAt set, cleared on Reopen | Timestamps correct | ticket-workflow.api.test.ts | |
| API-18 | AC-12 | Requester resolution indication | 200, status unchanged, idempotent | ticket-workflow.api.test.ts | |
| API-19 | BR-20 | Cancel without reason | 422 | ticket-workflow.api.test.ts | |
| API-20 | AC-13 | Concurrent ticket transitions | One 200, one 409 STALE_UPDATE | ticket-workflow.api.test.ts | |
| API-21 | FR-09 | `allowedTransitions` in Ticket detail per role/status | Matches matrix | ticket-workflow.api.test.ts | |
| API-22 | AC-02 | Requester dashboard scope (two Requesters seeded) | Only own data | server/tests/lab-04/requester-dashboard.api.test.ts | |
| API-23 | §5.5 | Each RQ metric vs raw Prisma query | Equal | requester-dashboard.api.test.ts | |
| API-24 | AC-16 | Requester with no Tickets | All 0, lists [] | requester-dashboard.api.test.ts | |
| API-25 | §5.5 | Staff/Admin calling requester dashboard | 403 | requester-dashboard.api.test.ts | |
| API-26 | AC-15 | Each ST metric vs raw SQL from spec | Equal | server/tests/lab-04/staff-dashboard.api.test.ts | |
| API-27 | BR-25 | byStatus/byPriority include zeros | All keys present | staff-dashboard.api.test.ts | |
| API-28 | FR-15 | Admin gets `users`; IT Staff doesn't; Requester 403 | As specified | staff-dashboard.api.test.ts | |
| API-29 | AC-17 | Queue count for each drill-down filter = metric value | Equal | staff-dashboard.api.test.ts | |
| API-30 | AC-19 | DB error forced on dashboard | 500 generic body, no stack | staff-dashboard.api.test.ts | |
| API-31 | — | `/api/health` up / DB down | 200 / 503 | server/tests/lab-04/health.api.test.ts | |

## Migration / Seed / Regression

| Test ID | Req / AC | What it tests | Expected | File | Final |
|---|---|---|---|---|---|
| MIG-01 | AC-22 | Apply migration on Lab 3 snapshot; row counts of Users/Tickets/Comments/Notes/Attachments | Unchanged | server/tests/lab-04/migration.test.ts | |
| MIG-02 | §7 | Backfill resolvedAt/closedAt | Set for Resolved/Closed | migration.test.ts | |
| MIG-03 | §7 | Down → up cycle | Succeeds, Lab 3 suite green | migration.test.ts | |
| SEED-01 | AC-23 | Run seed twice | Identical counts | server/tests/lab-04/seed.test.ts | |
| SEED-02 | §7 | Seed coverage: all statuses, priorities, 0/1/many actions, inactive staff, empty Requester | Present | seed.test.ts | |
| REG-01 | FR-21 | Full Lab 1–3 server suites | All pass | server/tests/lab-02, lab-03 | |
| REG-02 | FR-21 | Full Lab 2–3 client + E2E suites | All pass | client/…/lab-02, lab-03; e2e/lab-02, lab-03 | |

## UI component

| Test ID | Req / AC | What it tests | Expected | File | Final |
|---|---|---|---|---|---|
| UI-01 | FR-14 | StaffDashboard renders cards, tables, lists from mock | Values + links correct | client/src/__tests__/lab-04/StaffDashboard.test.tsx | |
| UI-02 | FR-17 | StaffDashboard loading / empty / error+Retry | Correct state shown | StaffDashboard.test.tsx | |
| UI-03 | FR-13 | RequesterDashboard renders metrics and lists | Correct | RequesterDashboard.test.tsx | |
| UI-04 | AC-16 | RequesterDashboard empty | 0s + Create Ticket CTA | RequesterDashboard.test.tsx | |
| UI-05 | FR-06 | ActionsTaken list ordering + badges with text | Correct | ActionsTaken.test.tsx | |
| UI-06 | FR-07 | Requester view: no Add/Edit buttons | Absent | ActionsTaken.test.tsx | |
| UI-07 | AC-05 | Follow-up toggle reveals required note; inline error | Shown, focus on field | ActionsTaken.test.tsx | |
| UI-08 | FR-19 | Double click Save | 1 request sent, button disabled | ActionsTaken.test.tsx | |
| UI-09 | FR-20, AC-13 | 409 response keeps input + shows banner | Input preserved | ActionsTaken.test.tsx | |
| UI-10 | AC-08 | Completed action read-only | No edit controls | ActionsTaken.test.tsx | |
| UI-11 | FR-09 | Status menu shows only allowedTransitions | Matches props | TicketWorkflow.test.tsx | |
| UI-12 | BR-20 | Cancel dialog requires reason; focus trap; Esc | As specified | TicketWorkflow.test.tsx | |
| UI-13 | AC-18 | After success, badge + history update | Updated | TicketWorkflow.test.tsx | |
| UI-14 | FR-10 | Requester "This looks resolved" flow | Confirmation text, status unchanged | TicketWorkflow.test.tsx | |

## E2E (Playwright, seeded DB)

| Test ID | Req / AC | What it tests | Expected | File | Final |
|---|---|---|---|---|---|
| E2E-01 | AC-01, AC-03 | Staff adds 3 actions (2 users), edits, completes | Ordered list, read-only completed | e2e/lab-04/actions-taken-flow.spec.ts | |
| E2E-02 | AC-06 | Assignee dropdown excludes inactive staff | Not listed | actions-taken-flow.spec.ts | |
| E2E-03 | AC-11, AC-18 | Resolve blocked → complete actions → resolve → close | Gate message then success | e2e/lab-04/ticket-resolution.spec.ts | |
| E2E-04 | AC-12 | Requester marks "looks resolved", staff sees tag, resolves | Status only changes by staff | ticket-resolution.spec.ts | |
| E2E-05 | AC-13 | Two browser contexts edit same action | Second sees conflict banner | ticket-resolution.spec.ts | |
| E2E-06 | AC-02, AC-17 | Requester dashboard drill-down to My Tickets | Same count | e2e/lab-04/dashboards.spec.ts | |
| E2E-07 | AC-15, AC-17 | Staff dashboard each card drill-down | Same count in Queue | dashboards.spec.ts | |
| E2E-08 | AC-24 | Requester opens other's Ticket URL | Not-found page | dashboards.spec.ts | |

## Responsive, accessibility, style

| Test ID | Req / AC | What it tests | Expected | File | Final |
|---|---|---|---|---|---|
| RESP-01 | AC-20 | 360/768/1280: `scrollWidth <= clientWidth` on dashboards + Ticket Detail | No horizontal scroll | e2e/lab-04/responsive.spec.ts | |
| RESP-02 | AC-20 | Screenshots at 3 widths saved to artifacts | Files exist | responsive.spec.ts | |
| A11Y-01 | AC-21 | axe scan of all Lab 4 screens | 0 serious/critical | e2e/lab-04/a11y.spec.ts | |
| A11Y-02 | AC-21 | Keyboard-only: dashboard card → list; add action; change status | Completed without mouse | a11y.spec.ts | |
| STYLE-01 | §7 ui-spec | Badges/cards use Zen Green tokens (class/computed color check) | Match tokens | client/src/__tests__/lab-04/style.test.tsx | |
| CON-01 | FR-22 | No console errors on all routes | 0 errors | e2e/lab-04/console.spec.ts | |

## Performance smoke

| Test ID | Req / AC | What it tests | Expected | File | Final |
|---|---|---|---|---|---|
| PERF-01 | §5.5 | Staff dashboard with 5 000 seeded Tickets | p95 < 500 ms locally | server/tests/lab-04/perf.smoke.test.ts | |
| PERF-02 | FR-06 | Action list for Ticket with 200 actions | < 300 ms | perf.smoke.test.ts | |

## AC → Test coverage

| AC | Tests |
|---|---|
| AC-01 | API-03, E2E-01 |
| AC-02 | API-22, E2E-06 |
| AC-03 | E2E-01, UI-05 |
| AC-04 | API-05 |
| AC-05 | UNIT-04, API-06, UI-07 |
| AC-06 | API-07, E2E-02 |
| AC-07 | API-09 |
| AC-08 | API-10, UI-10 |
| AC-09 | API-11 |
| AC-10 | UNIT-01, API-14, API-15 |
| AC-11 | UNIT-02, API-16, E2E-03 |
| AC-12 | API-18, UI-14, E2E-04 |
| AC-13 | API-12, API-20, UI-09, E2E-05 |
| AC-14 | API-13, UI-08 |
| AC-15 | API-26, E2E-07 |
| AC-16 | API-24, UI-04 |
| AC-17 | API-29, E2E-06, E2E-07 |
| AC-18 | UI-13, E2E-03 |
| AC-19 | API-30, UI-02 |
| AC-20 | RESP-01, RESP-02 |
| AC-21 | A11Y-01, A11Y-02 |
| AC-22 | MIG-01, MIG-03, REG-01, REG-02 |
| AC-23 | SEED-01 |
| AC-24 | API-02, E2E-08 |
