# TokTickIT — Sprint 4 API Specification

Base path: `/api`. Auth: existing session/JWT from Labs 2–3. All bodies JSON. All timestamps ISO-8601 UTC.
All Lab 2–3 endpoints remain unchanged unless noted.

## Conventions

**Error body (all errors)**
```json
{ "error": { "code": "STALE_UPDATE", "message": "This item was changed by someone else.", "details": { } } }
```
Messages are user-safe: no stack traces, SQL, or internal IDs of other users' resources.

| HTTP | code | When |
|---|---|---|
| 400 | `BAD_REQUEST` | Malformed JSON, missing `expectedVersion` |
| 401 | `UNAUTHENTICATED` | No/expired session |
| 403 | `FORBIDDEN` | Role not allowed for this operation |
| 404 | `NOT_FOUND` / `TICKET_NOT_FOUND` | Resource missing **or** not owned by the Requester (BR-15). Endpoints inherited from Lab 3 keep `TICKET_NOT_FOUND`. |
| 409 | `STALE_UPDATE` | `expectedVersion` ≠ current `version`; `details.current` = current resource |
| 409 | `INVALID_TRANSITION` | Transition not in matrix; `details.allowed` = allowed targets |
| 409 | `RESOLUTION_GATE` | `details.reason` ∈ `NO_COMPLETED_ACTION`, `OPEN_ACTIONS_REMAIN` |
| 409 | `TICKET_LOCKED` | Ticket Closed/Cancelled |
| 409 | `ACTION_LOCKED` | Action Completed/Cancelled |
| 422 | `VALIDATION_ERROR` | `details.fields` = `{ field: message }` |
| 422 | `INVALID_ASSIGNEE` | Assignee inactive or not IT_STAFF/ADMINISTRATOR |
| 500 | `INTERNAL_ERROR` | Unexpected; generic message only |

**ActionTaken resource**
```json
{
  "id": 12, "ticketId": 1,
  "actionAt": "2026-10-20T03:15:00.000Z",
  "description": "Replaced laptop battery", "result": "Battery holds 6h",
  "status": "COMPLETED",
  "followUpRequired": true, "followUpNote": "Check again in 1 week",
  "attachmentNotes": "See photo battery-label.jpg",
  "createdBy":   { "id": 6, "name": "Kevin Patel" },
  "assignee":    { "id": 7, "name": "Emily Davis" },
  "performedBy": { "id": 7, "name": "Emily Davis" },
  "version": 3, "createdAt": "...", "updatedAt": "..."
}
```

## Actions Taken

### `GET /api/staff/assignees`
Roles: IT_STAFF, ADMINISTRATOR. 200 → `{ "users": [{ "id": 6, "name": "Kevin Patel", "role": "IT_STAFF" }] }` — active IT Staff and Administrators only, ordered by name. Used by the action assignee and "Reassign to…" pickers.

### `GET /api/tickets/:ticketId/actions`
Roles: IT_STAFF, ADMINISTRATOR (any Ticket); REQUESTER (own Ticket only, else 404).
200 → `{ "items": ActionTaken[] }` ordered by `actionAt ASC, id ASC`.

### `POST /api/tickets/:ticketId/actions`
Roles: IT_STAFF, ADMINISTRATOR. Header: `Idempotency-Key: <uuid>` (recommended; client always sends one).
```json
{ "description": "string", "actionAt": "ISO?", "result": "string?", "assigneeId": 7,
  "followUpRequired": false, "followUpNote": "string?", "attachmentNotes": "string?" }
```
Server sets `createdById` = current user, `assigneeId` default = current user, `status = PLANNED`, `version = 1`. Fields `createdById`, `performedById`, `status`, `version` in the body are ignored.
- 201 → ActionTaken (new). 200 → ActionTaken (same Idempotency-Key replayed).
- 403, 404, 409 `TICKET_LOCKED`, 422 `VALIDATION_ERROR` / `INVALID_ASSIGNEE`.

### `PATCH /api/tickets/:ticketId/actions/:actionId`
Roles: IT_STAFF, ADMINISTRATOR. Editable: `description, actionAt, result, assigneeId, followUpRequired, followUpNote, attachmentNotes`.
```json
{ "expectedVersion": 2, "result": "Driver updated", "assigneeId": 7 }
```
- 200 → ActionTaken (`version` + 1).
- 400 (no expectedVersion), 403, 404, 409 `STALE_UPDATE` / `ACTION_LOCKED` / `TICKET_LOCKED`, 422.

### `POST /api/tickets/:ticketId/actions/:actionId/transition`
Roles: IT_STAFF, ADMINISTRATOR.
```json
{ "to": "IN_PROGRESS | COMPLETED | CANCELLED", "expectedVersion": 2, "result": "string?" }
```
`result` may be supplied with `COMPLETED` (required if not already set). On `COMPLETED`, server sets `performedById` = current user.
- 200 → ActionTaken. 409 `INVALID_TRANSITION` / `ACTION_LOCKED` / `STALE_UPDATE`, 422 (missing result).

## Ticket Workflow (extends Lab 3 endpoints)

### `GET /api/staff/tickets/:id` (extended)
Adds `version`, `resolvedAt`, `closedAt`, `requesterMarkedResolvedAt`, and `allowedTransitions: TicketStatus[]` computed from the matrix.
The Requester view `GET /api/tickets/:id` adds the same fields except `allowedTransitions` (always empty for Requesters).

### `PATCH /api/staff/tickets/:id/status` (extended Lab 3 endpoint)
Roles: IT_STAFF, ADMINISTRATOR.
```json
{ "status": "RESOLVED", "expectedVersion": 7, "reason": "string? (required for CANCELLED)" }
```
Single DB transaction: version check (if `expectedVersion` sent) → matrix check → gate check (if RESOLVED) → update Ticket (`version` + 1, timestamps per BR-18, reset `requesterMarkedResolved`) → insert `TicketStatusChange`.
- 200 → `{ "ticket": Ticket }` (with new `allowedTransitions`).
- 403, 404, 409 `STALE_UPDATE` / `INVALID_TRANSITION` / `RESOLUTION_GATE`, 422 (missing cancel reason).

### `GET /api/tickets/:id/status-history`
Roles: staff any Ticket; Requester own Ticket (else 404). 200 → `{ "items": [{ fromStatus, toStatus, actor: {id,name}, reason, createdAt }] }` ordered `createdAt ASC, id ASC`.

### `POST /api/tickets/:id/resolved-by-requester` (extended Lab 3 endpoint)
Role: REQUESTER owning the Ticket, status ∈ {IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED}.
- 200 → `{ "ticket": Ticket }` with `requesterMarkedResolved = true` and `requesterMarkedResolvedAt` (first timestamp kept on repeat). Status unchanged.
- 403 (staff), 404, 409 `INVALID_TRANSITION` (wrong status).

## Dashboards

### `GET /api/dashboard/requester`
Role: REQUESTER. Scope `requesterId = me`.
```json
{
  "generatedAt": "ISO", "timeZone": "Asia/Bangkok",
  "metrics": [
    { "id": "RQ-M1", "label": "My Open Tickets", "value": 3, "drillDown": "/my-tickets?currentStatus=active" },
    { "id": "RQ-M2", "label": "Waiting for Me",  "value": 1, "drillDown": "/my-tickets?currentStatus=WAITING_FOR_REQUESTER" },
    { "id": "RQ-M3", "label": "Resolved",        "value": 5, "drillDown": "/my-tickets?currentStatus=RESOLVED" },
    { "id": "RQ-M4", "label": "Closed",          "value": 12, "drillDown": "/my-tickets?currentStatus=CLOSED" }
  ],
  "recentlyUpdated":  [{ "id": 1, "ticketNumber": "TKT-2026-000001", "title": "...", "status": "IN_PROGRESS", "updatedAt": "ISO" }],
  "recentlyResolved": [ ]
}
```
403 for non-Requester roles.

### `GET /api/dashboard/staff`
Roles: IT_STAFF, ADMINISTRATOR.
```json
{
  "generatedAt": "ISO", "timeZone": "Asia/Bangkok",
  "metrics": [
    { "id": "ST-M1", "label": "Unassigned",        "value": 4,  "drillDown": "/queue?owner=unassigned&status=active" },
    { "id": "ST-M2", "label": "My Assigned",       "value": 16, "drillDown": "/queue?owner=me&status=active" },
    { "id": "ST-M5", "label": "Tickets with My Open Actions", "value": 3,  "drillDown": "/queue?actionAssignee=me" },
    { "id": "ST-M6", "label": "Follow-ups Pending","value": 2,  "drillDown": "/queue?followUp=pending" }
  ],
  "byStatus":   [{ "status": "NEW", "value": 14, "drillDown": "/queue?status=NEW" }],
  "byPriority": [{ "itPriority": "HIGH", "value": 5, "drillDown": "/queue?itPriority=HIGH&status=active" }],
  "recentlyUpdated": [ ], "urgent": [ ],
  "users": [{ "role": "IT_STAFF", "active": 3, "inactive": 1, "drillDown": "/admin/users?role=IT_STAFF" }]
}
```
`users` present only for ADMINISTRATOR. `byStatus` always contains all 8 statuses; `byPriority` all priorities (zeros included). Lists max 5 items.
403 for Requesters.

### Queue filters (extension of Lab 3 `GET /api/staff/tickets` and `GET /api/tickets`)
Lab 3 already supports `owner=unassigned|me|<id>` and `status` on `GET /api/staff/tickets`, and `currentStatus` on `GET /api/tickets`. New values/params for drill-down: `status=active` / `currentStatus=active`, `itPriority=<P>`, `actionAssignee=me`, `followUp=pending`. The list and the dashboard use the same filter builder (`src/lab4/dashboard.ts`). Sort fields now also accept `ticketNumber`, `summary` and `updatedAt`. Counts returned by the list for a filter must equal the dashboard metric for the same filter.

## Health

### `GET /api/health` (Lab 1, unchanged)
Public. 200 → `{ "status": "ok", "service": "TokTickIT API" }`.

### `GET /api/health/ready`
Public. 200 → `{ "status": "ok", "service": "TokTickIT API", "db": "ok" }`; 503 → `{ "status": "degraded", "service": "TokTickIT API", "db": "error" }`.

## Authorization summary

| Endpoint | Requester | IT Staff | Administrator |
|---|---|---|---|
| GET /api/staff/assignees | 403 | ✓ | ✓ |
| GET actions | own Ticket | ✓ | ✓ |
| POST / PATCH / transition action | 403 | ✓ | ✓ |
| PATCH /api/staff/tickets/:id/status | 403 | matrix | matrix |
| GET status-history | own | ✓ | ✓ |
| POST resolved-by-requester | own | 403 | 403 |
| GET dashboard/requester | ✓ | 403 | 403 |
| GET dashboard/staff | 403 | ✓ | ✓ (+users) |
