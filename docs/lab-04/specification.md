# TokTickIT — Sprint 4 Engineering Specification

> Status: v1.2 — v1.1 aligned with the Lab 3 codebase after peer review; v1.2 records the decisions taken during implementation (D-08..D-12). Must be merged to `lab4-staging` before any implementation PR.
> Related: [api-spec.md](./api-spec.md) · [ui-spec.md](./ui-spec.md) · [tests.md](./tests.md)
> Naming: names follow the existing Lab 3 schema — integer ids, `Role` = `REQUESTER | IT_STAFF | ADMINISTRATOR`, `Ticket.currentStatus`, `Ticket.ownerId`, `Ticket.itPriority`, `Ticket.requesterMarkedResolved`.

## 1. Sprint Goal

Deliver the complete service-desk workflow: IT Staff can plan and record the work done on a Ticket through Actions Taken, Ticket status changes follow one enforced transition matrix with a resolution gate, each role gets a concise dashboard linked to the detailed screens, and every Lab 1–3 feature keeps working under the Zen Green design.

## 2. Stakeholder Request (interpretation)

The service desk can receive and discuss Tickets but cannot track the actual work. We add a list of Actions Taken under each Ticket, written by IT Staff (not necessarily the Ticket Owner). The Owner stays responsible for the Ticket as a whole. A Requester can say "this looks fixed", but only IT Staff can formally resolve. Dashboards give a fast starting point and always link back to real lists. Finally, the whole product is hardened and polished.

## 3. Scope

**Included**
- Actions Taken: model, migration, seed, API, UI (list, create, view/edit, assign, complete, cancel).
- Final Ticket status-transition matrix, resolution gate, Requester resolution indication.
- Requester and IT Staff dashboards (Administrator reuses IT Staff dashboard + user counts).
- Optimistic concurrency on Ticket and Action Taken updates; idempotent Action creation.
- Final regression of Labs 1–3, accessibility, responsive and visual polish.

**Excluded** (handout §4.2): SLA clocks, escalation, on-call, any external notification (email/SMS/LINE/push), inventory/parts/cost, timesheets/payroll, multi-level approval, e-signature, BI/report builders/exports, multi-tenancy, production cloud ops, "from yesterday" trend deltas shown in the mockup (would require historical snapshots — see D-06).

## 4. Functional Requirements

### Actions Taken
- **FR-01** IT Staff and Administrators can create an Action Taken on any Ticket they can access.
- **FR-02** An Action Taken records: Action Date/Time, Description, Result, Performed by (auto), Follow-Up Required?, Follow-Up Note, Attachment Notes, Assignee, Status.
- **FR-03** IT Staff and Administrators can edit an Action Taken while its status is `PLANNED` or `IN_PROGRESS`.
- **FR-04** IT Staff and Administrators can assign an Action Taken to any active IT Staff or Administrator.
- **FR-05** An Action Taken can be moved `PLANNED → IN_PROGRESS → COMPLETED`, or cancelled from `PLANNED`/`IN_PROGRESS`.
- **FR-06** The Ticket Detail shows all Actions Taken of the Ticket in stable order (Action Date/Time ascending, then `id`).
- **FR-07** Requesters can view (read-only) all Actions Taken of Tickets they own.

### Ticket workflow
- **FR-08** The Ticket status changes only through the transition matrix in §5.3, enforced by the backend.
- **FR-09** The Ticket Detail shows only the transitions permitted for the current user and status.
- **FR-10** A Requester can indicate that the problem appears resolved on a Ticket they own; this is advisory and does not change the status.
- **FR-11** Every Ticket status change is recorded in an append-only status history (from, to, actor, timestamp, optional reason).
- **FR-12** After a successful status change, the Ticket summary (badge, allowed transitions, history) refreshes without a full page reload.

### Dashboards
- **FR-13** A Requester sees a dashboard computed only from Tickets they own (metrics in §5.5).
- **FR-14** IT Staff see an operational dashboard (metrics in §5.5).
- **FR-15** Administrators see the IT Staff dashboard plus active/inactive user counts by role.
- **FR-16** Every metric card and list item links to a filtered list or Ticket Detail.
- **FR-17** Dashboards show loading, empty, forbidden and safe-failure states.

### Hardening
- **FR-18** Write operations reject stale updates (`409 STALE_UPDATE`) instead of silently overwriting.
- **FR-19** Repeated submits or network retries never create duplicate Actions Taken.
- **FR-20** Forms keep user input after a recoverable failure (validation, 409, 5xx, network).
- **FR-21** All Lab 1–3 features (auth, role navigation, My Tickets, Ticket Detail, attachments, public comments, internal notes, queue, user management) keep passing their tests.
- **FR-22** No console errors, broken links, placeholder text or unfinished controls in the final build.

## 5. Business Rules

### 5.1 Actions Taken
- **BR-01** An Action Taken belongs to exactly one Ticket (non-null FK, no re-parenting).
- **BR-02** The Ticket Owner coordinates the Ticket; an Action Taken may be created, assigned to, or performed by a different IT Staff member.
- **BR-03** Only `IT_STAFF` and `ADMINISTRATOR` can create, edit, assign or transition an Action Taken. Requesters have read-only access on Tickets they own. Enforced in the backend on every write.
- **BR-04** `createdById` is always the authenticated user; it is never taken from the request body.
- **BR-05** `performedById` is set automatically to the authenticated user who moves the action to `COMPLETED`. It is never taken from the request body.
- **BR-06** If no assignee is given at creation, the assignee defaults to the creator. An assignee must be an active (`isActive = true`) user with role `IT_STAFF` or `ADMINISTRATOR`; otherwise `422 INVALID_ASSIGNEE`.
- **BR-07** Description: required, trimmed, 1–2000 chars. Result: optional while `PLANNED`/`IN_PROGRESS`, **required** to move to `COMPLETED` (1–2000 chars).
- **BR-08** If `followUpRequired = true`, `followUpNote` is required (1–1000 chars). If `false`, `followUpNote` is stored as `null`.
- **BR-09** `actionAt` defaults to the server time at creation; it may be edited but cannot be more than 5 minutes in the future (clock tolerance) nor before the Ticket's `createdAt`.
- **BR-10** Attachment Notes: optional free text, max 500 chars (it describes which attachment/image to look at; it is not an upload).
- **BR-11** Action status transitions: `PLANNED → IN_PROGRESS`, `PLANNED → COMPLETED`, `IN_PROGRESS → COMPLETED`, `PLANNED|IN_PROGRESS → CANCELLED`. `COMPLETED` and `CANCELLED` are final.
- **BR-12** Append-only: Actions Taken are never deleted. `COMPLETED` and `CANCELLED` actions are read-only; corrections are made by adding a new action.
- **BR-13** Actions Taken cannot be created or edited when the Ticket is `Closed` or `Cancelled` (`409 TICKET_LOCKED`).

### 5.2 Assignment and ownership
- **BR-14** A Ticket has at most one Owner (`ownerId`, nullable = unassigned). Owner rules from Lab 3 are unchanged.
- **BR-15** A Requester can only read Tickets, Actions Taken and dashboard data they own. Access to another Requester's Ticket returns `404` (no existence leak).

### 5.3 Ticket status transition matrix

The Lab 3 matrix (Lab 3 BR-13) is **kept unchanged** so that Lab 3 regression tests keep passing. Lab 4 adds the resolution gate, timestamps, history and concurrency on top of it.

| From \ To | Open | In Progress | Waiting for Requester | Resolved | Closed | Reopened | Cancelled |
|---|---|---|---|---|---|---|---|
| **New** | S | – | – | – | – | – | S |
| **Open** | – | S | S | – | – | – | S |
| **In Progress** | – | – | S | S* | – | – | S |
| **Waiting for Requester** | – | S | – | S* | – | – | S |
| **Resolved** | – | – | – | – | S | S | – |
| **Closed** | – | – | – | – | – | S | – |
| **Reopened** | S | S | – | – | – | – | S |
| **Cancelled** | – | – | – | – | – | – | – |

S = IT Staff or Administrator · `*` = resolution gate (BR-17) · – = forbidden. Requesters never change the formal status (Lab 3 BR-05); they can only mark the problem as appearing resolved (BR-19).

- **BR-16** Any transition not in the matrix, including same-status, returns `409 INVALID_TRANSITION`. Cancelled is terminal. A Requester calling the status endpoint gets `403`.
- **BR-17** Resolution gate: a Ticket can move to `Resolved` only if (a) the actor is IT Staff/Administrator, (b) it has at least one `COMPLETED` Action Taken, and (c) it has no `PLANNED` or `IN_PROGRESS` Action Taken. Otherwise `409 RESOLUTION_GATE` with the failing condition in `details`.
- **BR-18** Moving to `Resolved` sets `resolvedAt = now()`; moving to `Reopened` clears `resolvedAt` and `closedAt`; moving to `Closed` sets `closedAt = now()`.
- **BR-19** The existing Lab 3 "problem appears resolved" action sets `requesterMarkedResolved = true` and `requesterMarkedResolvedAt = now()` on a Ticket the Requester owns, in status `In Progress`, `Waiting for Requester` or `Reopened`. It never changes the status. Both fields are reset on any subsequent status change.
- **BR-20** A move to `Cancelled` requires a reason (1–500 chars) stored in the status history.
- **BR-21** Status history is append-only; rows are never updated or deleted.

### 5.4 Concurrency and duplicates
- **BR-22** `Ticket` and `ActionTaken` carry an integer `version`, incremented on every update. Update/transition requests carry `expectedVersion`; on mismatch the server returns `409 STALE_UPDATE` with the current resource. The Lab 4 UI always sends it. For Ticket endpoints inherited from Lab 3, `expectedVersion` is optional so earlier clients and tests keep working; Action Taken endpoints require it.
- **BR-23** `POST` create of an Action Taken accepts an `Idempotency-Key` header (UUID). A repeated key from the same user for the same Ticket returns the originally created action with `200` instead of creating a duplicate.

### 5.5 Dashboard calculations

"Active" = status in {New, Open, In Progress, Waiting for Requester, Reopened}. All timestamps stored in UTC; day boundaries computed in `Asia/Bangkok`. "Recent" lists are limited to 5 items, ordered by `updatedAt DESC, id DESC`.

**Requester (scope: `requesterId = currentUser.id`)**

| Metric ID | Label | Calculation | Drill-down |
|---|---|---|---|
| RQ-M1 | My Open Tickets | count(active) | `/my-tickets?currentStatus=active` |
| RQ-M2 | Waiting for Me | count(status = Waiting for Requester) | `/my-tickets?currentStatus=WAITING_FOR_REQUESTER` |
| RQ-M3 | Resolved | count(status = Resolved) | `/my-tickets?currentStatus=RESOLVED` |
| RQ-M4 | Closed | count(status = Closed) | `/my-tickets?currentStatus=CLOSED` |
| RQ-L1 | Recently Updated | top 5 by updatedAt | Ticket Detail |
| RQ-L2 | Recently Resolved | top 5 with resolvedAt ≥ start of day (Bangkok) − 7 days | Ticket Detail |

**IT Staff (scope: all Tickets)**

| Metric ID | Label | Calculation | Drill-down |
|---|---|---|---|
| ST-M1 | Unassigned | count(active AND ownerId IS NULL) | `/queue?owner=unassigned&status=active` |
| ST-M2 | My Assigned | count(active AND ownerId = me) | `/queue?owner=me&status=active` |
| ST-M3 | By Status | count grouped by status (all 8, zeros included) | `/queue?status=<STATUS>` |
| ST-M4 | By IT Priority | count(active) grouped by itPriority (zeros included) | `/queue?itPriority=<P>&status=active` |
| ST-M5 | Tickets with My Open Actions | count(DISTINCT Tickets having an ActionTaken with assigneeId = me AND status IN (PLANNED, IN_PROGRESS)) | `/queue?actionAssignee=me` |
| ST-M6 | Follow-ups Pending | count(Tickets active with ≥1 COMPLETED action where followUpRequired = true) | `/queue?followUp=pending` |
| ST-L1 | Recently Updated | top 5 active by updatedAt | Ticket Detail |
| ST-L2 | Urgent | top 5 active with highest itPriority, oldest createdAt first | Ticket Detail |

**Administrator (`ADMINISTRATOR`):** ST-* plus AD-M1 = count(User) grouped by role and isActive → `/admin/users?role=<R>`.

- **BR-24** Dashboard metrics are computed by the backend from the database at request time; the client never computes counts from Ticket lists. Each metric and its drill-down list are built with the same filter function, so a card and the list it opens always show the same number.
- **BR-25** A metric with no matching records returns `0` (never omitted); an empty list returns `[]`.
- **BR-26** Legacy Tickets (created before Lab 4) with zero Actions Taken are counted normally; they just cannot pass the resolution gate until an action is completed.

## 6. UI Specification Summary

See [ui-spec.md](./ui-spec.md). New: role-based Dashboard as landing page (Requester and IT Staff variants), Actions Taken panel on Ticket Detail (list + create mode + view/edit mode), status-transition control showing only allowed transitions, Requester "Looks resolved" button. All screens reuse Zen Green components, keep keyboard focus visible, use text + icon for status (not color alone), and avoid horizontal scrolling from 360 px upward.

## 7. Data Changes

```prisma
enum ActionStatus { PLANNED IN_PROGRESS COMPLETED CANCELLED }

model ActionTaken {
  id               Int          @id @default(autoincrement())
  ticketId         Int          // FK Ticket, onDelete: Restrict
  actionAt         DateTime     @default(now())
  description      String       @db.VarChar(2000)
  result           String?      @db.VarChar(2000)
  status           ActionStatus @default(PLANNED)
  followUpRequired Boolean      @default(false)
  followUpNote     String?      @db.VarChar(1000)
  attachmentNotes  String?      @db.VarChar(500)
  createdById      Int          // FK User
  assigneeId       Int          // FK User
  performedById    Int?         // FK User, set on COMPLETED
  idempotencyKey   String?      @db.VarChar(64)
  version          Int          @default(1)
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  @@unique([createdById, ticketId, idempotencyKey])
  @@index([ticketId, actionAt, id])
  @@index([assigneeId, status])
}

model TicketStatusChange {
  id         Int          @id @default(autoincrement())
  ticketId   Int          // FK Ticket, onDelete: Restrict
  fromStatus TicketStatus
  toStatus   TicketStatus
  actorId    Int          // FK User
  reason     String?      @db.VarChar(500)
  createdAt  DateTime     @default(now())
  @@index([ticketId, createdAt])
}

// Added to Ticket (all nullable or defaulted, nothing removed):
//   requesterMarkedResolvedAt DateTime?
//   version                   Int       @default(1)
//   resolvedAt                DateTime?
//   closedAt                  DateTime?
//   @@index([currentStatus, ownerId])  @@index([requesterId, currentStatus])  @@index([updatedAt])
```

**Migration (`lab4_actions_taken`)** — additive only: new enum, two new tables, nullable/defaulted columns on `Ticket`. No column dropped or renamed. Backfill in the same migration: `resolvedAt = updatedAt` for Tickets already `Resolved`/`Closed`; `closedAt = updatedAt` for `Closed`; `requesterMarkedResolvedAt = updatedAt` where `requesterMarkedResolved = true`; `version = 1` by default.

**Rollback/recovery** — a down script (`prisma/rollback/lab4_down.sql`) drops the two new tables, the enum and the added columns; Lab 1–3 data is untouched. Tested by: migrate up → seed → down → Lab 3 regression suite passes → up again.

**Seed** — idempotent via `upsert` on unique emails/ticket numbers and fixed `idempotencyKey` values for actions. New users and tickets are appended after the Lab 3 ones so existing ids used by Lab 2–3 tests never change. Covers every Ticket status and IT Priority, assigned and unassigned Tickets, Tickets with 0, 1 and 3+ Actions Taken (mixing all action statuses, with and without follow-up), one inactive IT Staff (for invalid-assignee tests), and one Requester with zero Tickets (empty dashboard).

**Design decisions (justified)**
- **DD-1 Integer `version` instead of `updatedAt` comparison** — timestamps can collide at millisecond precision and depend on client clock serialization; an integer is exact, cheap and easy to test.
- **DD-2 Separate `TicketStatusChange` table** — makes status history append-only and auditable, and keeps `resolvedAt` derivable/verifiable; storing history in a JSON column would be neither indexable nor enforceably append-only.
- **DD-3 `onDelete: Restrict` on ActionTaken → Ticket** — Tickets are never hard-deleted (cancel instead), so a cascade would only ever destroy audit data by mistake.
- **DD-4 Composite index `(ticketId, actionAt, id)`** — serves the stable-ordered list on Ticket Detail in one index scan.

## 8. API Contract

See [api-spec.md](./api-spec.md). New endpoints: list/create/update/transition Actions Taken, Ticket transition, allowed transitions, Requester resolution indication, Requester dashboard, Staff dashboard, assignee list, readiness check. Uniform error body `{ error: { code, message, details? } }`.

## 9. Acceptance Criteria

| ID | Criterion |
|---|---|
| AC-01 | Given a permitted IT Staff user and valid data, when an Action Taken is created, then it is saved under the correct Ticket with the authenticated creator and the approved (or defaulted) assignee. |
| AC-02 | Given an authenticated Requester, when dashboard data is retrieved, then only metrics and recent Tickets owned by that Requester are returned. |
| AC-03 | Given an IT Staff user on Ticket Detail, when they add, edit and complete several actions, then all actions appear in stable order and the completed ones become read-only. |
| AC-04 | Given a Requester, when they call any Action Taken write endpoint, then the server returns 403 and nothing changes. |
| AC-05 | Given `followUpRequired = true` and no note, when saving, then 422 is returned with a field error and the form keeps the input. |
| AC-06 | Given an inactive or Requester-role assignee, when creating or reassigning an action, then 422 INVALID_ASSIGNEE is returned. |
| AC-07 | Given an action in `IN_PROGRESS` with no result, when completing it, then 422 is returned; with a result, it becomes `COMPLETED` and `performedBy` = current user. |
| AC-08 | Given a `COMPLETED` or `CANCELLED` action, when any edit or transition is attempted, then 409 is returned. |
| AC-09 | Given a Ticket in `Closed` or `Cancelled`, when an action is created or edited, then 409 TICKET_LOCKED is returned. |
| AC-10 | Given each (status, role) pair, when a transition is requested, then only matrix-permitted transitions succeed and all others return 409 INVALID_TRANSITION or 403. |
| AC-11 | Given a Ticket with no completed action or with an open action, when IT Staff request `Resolved`, then 409 RESOLUTION_GATE is returned with the failing condition. |
| AC-12 | Given a Requester owning an In Progress Ticket, when they indicate "looks resolved", then `requesterMarkedResolved` and its timestamp are stored and the status is unchanged. |
| AC-13 | Given two users holding version N, when both submit an update, then the first succeeds and the second gets 409 STALE_UPDATE with the current data. |
| AC-14 | Given the same Idempotency-Key sent twice, when creating an action, then exactly one action exists. |
| AC-15 | Given the seed data, when the IT Staff dashboard is retrieved, then each metric equals the result of its documented SQL query. |
| AC-16 | Given a Requester with no Tickets, when opening the dashboard, then all counts are 0 and empty states with a "Create Ticket" action are shown. |
| AC-17 | Given any metric card, when it is activated by mouse or keyboard, then the matching filtered list opens with the same count. |
| AC-18 | Given a status change, when it succeeds, then the status badge, allowed transitions and history update without a full reload and a history row is appended. |
| AC-19 | Given the dashboard API fails, when the page loads, then a safe error message with Retry is shown and no stack trace or raw error is displayed. |
| AC-20 | Given viewports 360, 768 and 1280 px, when visiting all Lab 4 screens, then there is no horizontal page scroll, clipping or overlap. |
| AC-21 | Given keyboard-only use, when operating dashboards, Actions Taken and status controls, then every control is reachable, focus is visible, and status is conveyed by text, not color alone. |
| AC-22 | Given the migration applied to a Lab 3 database, when the Lab 1–3 regression suite runs, then all tests pass and no prior data is lost. |
| AC-23 | Given the seed is run twice, when counting records, then counts are identical. |
| AC-24 | Given a Requester requesting another Requester's Ticket actions, then 404 is returned. |

## 10. Definition of Done (Product Completion)

- [ ] All FR/BR implemented; every AC mapped to ≥1 passing automated test in `tests.md`.
- [ ] Backend enforces every authorization rule; verified by tests that bypass the UI.
- [ ] Migration up/down/up tested on a Lab 3 snapshot; seed idempotent.
- [ ] Unit, API, UI component, E2E and Lab 1–3 regression suites pass on `main` in CI.
- [ ] Dashboard counts verified against documented queries (evidence in `artifacts/lab-04/`).
- [ ] Loading, empty, validation, forbidden, not-found, conflict and failure states implemented on every Lab 4 screen.
- [ ] No console errors, broken links, placeholder text, TODOs in UI, or dead controls.
- [ ] Desktop/tablet/mobile screenshots captured; accessibility checklist completed.
- [ ] README updated (setup, migrate, seed, test, demo accounts).
- [ ] All Issues Done; every PR reviewed and recorded in `reviewer.md`; flow feature → `lab4-staging` → `main`.

## 11. Assumptions and Decisions

- **D-01** The handout's grading mentions assign/complete/cancel/inactive-assignee for Actions Taken, which the field list does not define. We add `assignee` and `status` to Actions Taken to support planning, as requested by the stakeholder ("plan and track the actual work").
- **D-02** "Performed by (auto)" = the user who completes the action; `createdBy` is tracked separately.
- **D-03** Requesters see all Actions Taken of their own Tickets (handout §8.3). Internal Notes remain staff-only.
- **D-04** The Lab 3 transition matrix is kept as is (including Closed → Reopened by IT Staff) to preserve regression; Lab 4 only adds the resolution gate.
- **D-05** Time zone for day boundaries is `Asia/Bangkok`.
- **D-06** Dashboard "+N from yesterday" deltas from the mockup are excluded: they need daily snapshots, which no approved data model provides.
- **D-07** Unauthorized access to another Requester's resources returns 404 rather than 403, to avoid leaking Ticket existence.
- **D-08** ST-M5 counts **Tickets** (not actions) that have an open action assigned to the current user, so the card equals the number of rows in its drill-down queue (AC-17).
- **D-09** Ticket numbers are generated as the highest existing number + 1 (Lab 3 used count + 1, which collides after deletions). Numbers `TKT-<year>-9000xx` are reserved for seed data.
- **D-10** `GET /api/health` keeps its Lab 1 contract (a Lab 1 test checks it exactly); the database check is a separate `GET /api/health/ready`.
- **D-11** Assignee pickers use `GET /api/staff/assignees` (active IT Staff and Administrators). The Lab 3 reassign list used the Administrator-only users route and was empty for IT Staff.
- **D-12** Lab 2–3 regression tests used a password changed by hand on one database; they now use the seeded password so the full suite passes on a fresh `db:reset`. A seeded "new hire" (`paul.martin`) covers the first-login password change.
