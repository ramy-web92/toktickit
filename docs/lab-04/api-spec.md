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
| 404 | `NOT_FOUND` | Resource missing **or** not owned by the Requester (BR-15) |
| 409 | `STALE_UPDATE` | `expectedVersion` ≠ current `version`; `details.current` = current resource |
| 409 | `INVALID_TRANSITION` | Transition not in matrix; `details.allowed` = allowed targets |
| 409 | `RESOLUTION_GATE` | `details.reason` ∈ `NO_COMPLETED_ACTION`, `OPEN_ACTIONS_REMAIN` |
| 409 | `TICKET_LOCKED` | Ticket Closed/Cancelled |
| 409 | `ACTION_LOCKED` | Action Completed/Cancelled |
| 422 | `VALIDATION_ERROR` | `details.fields` = `{ field: message }` |
| 422 | `INVALID_ASSIGNEE` | Assignee inactive or not IT_STAFF/ADMIN |
| 500 | `INTERNAL_ERROR` | Unexpected; generic message only |

**ActionTaken resource**
```json
{
  "id": "uuid", "ticketId": "uuid",
  "actionAt": "2026-10-20T03:15:00.000Z",
  "description": "Replaced laptop battery", "result": "Battery holds 6h",
  "status": "COMPLETED",
  "followUpRequired": true, "followUpNote": "Check again in 1 week",
  "attachmentNotes": "See photo battery-label.jpg",
  "createdBy":   { "id": "uuid", "name": "Michael K." },
  "assignee":    { "id": "uuid", "name": "Somchai P." },
  "performedBy": { "id": "uuid", "name": "Somchai P." },
  "version": 3, "createdAt": "...", "updatedAt": "..."
}
```

## Actions Taken

### `GET /api/tickets/:ticketId/actions`
Roles: IT_STAFF, ADMIN (any Ticket); REQUESTER (own Ticket only, else 404).
200 → `{ "items": ActionTaken[] }` ordered by `actionAt ASC, id ASC`.

### `POST /api/tickets/:ticketId/actions`
Roles: IT_STAFF, ADMIN. Header: `Idempotency-Key: <uuid>` (recommended; client always sends one).
```json
{ "description": "string", "actionAt": "ISO?", "result": "string?", "assigneeId": "uuid?",
  "followUpRequired": false, "followUpNote": "string?", "attachmentNotes": "string?" }
```
Server sets `createdById` = current user, `assigneeId` default = current user, `status = PLANNED`, `version = 1`. Fields `createdById`, `performedById`, `status`, `version` in the body are ignored.
- 201 → ActionTaken (new). 200 → ActionTaken (same Idempotency-Key replayed).
- 403, 404, 409 `TICKET_LOCKED`, 422 `VALIDATION_ERROR` / `INVALID_ASSIGNEE`.

### `PATCH /api/tickets/:ticketId/actions/:actionId`
Roles: IT_STAFF, ADMIN. Editable: `description, actionAt, result, assigneeId, followUpRequired, followUpNote, attachmentNotes`.
```json
{ "expectedVersion": 2, "result": "Driver updated", "assigneeId": "uuid" }
```
- 200 → ActionTaken (`version` + 1).
- 400 (no expectedVersion), 403, 404, 409 `STALE_UPDATE` / `ACTION_LOCKED` / `TICKET_LOCKED`, 422.

### `POST /api/tickets/:ticketId/actions/:actionId/transition`
Roles: IT_STAFF, ADMIN.
```json
{ "to": "IN_PROGRESS | COMPLETED | CANCELLED", "expectedVersion": 2, "result": "string?" }
```
`result` may be supplied with `COMPLETED` (required if not already set). On `COMPLETED`, server sets `performedById` = current user.
- 200 → ActionTaken. 409 `INVALID_TRANSITION` / `ACTION_LOCKED` / `STALE_UPDATE`, 422 (missing result).

## Ticket Workflow

### `GET /api/tickets/:ticketId` (extended)
Adds `version`, `resolvedAt`, `closedAt`, `requesterResolvedIndicatedAt`, and `allowedTransitions: TicketStatus[]` computed for the current user.

### `POST /api/tickets/:ticketId/transition`
Roles: per matrix (specification §5.3).
```json
{ "to": "RESOLVED", "expectedVersion": 7, "reason": "string? (required for CANCELLED)" }
```
Single DB transaction: version check → matrix check → gate check (if RESOLVED) → update Ticket (`version` + 1, timestamps per BR-18, clear `requesterResolvedIndicatedAt`) → insert `TicketStatusChange`.
- 200 → Ticket (with new `allowedTransitions`).
- 403, 404, 409 `STALE_UPDATE` / `INVALID_TRANSITION` / `RESOLUTION_GATE`, 422 (missing cancel reason).

### `GET /api/tickets/:ticketId/status-history`
Roles: staff any; Requester own. 200 → `{ "items": [{ fromStatus, toStatus, actor: {id,name}, reason, createdAt }] }` ordered `createdAt ASC`.

### `POST /api/tickets/:ticketId/resolution-indication`
Role: REQUESTER owning the Ticket, status ∈ {IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED}. Body: `{}`.
- 200 → `{ "requesterResolvedIndicatedAt": "ISO" }` (idempotent: repeated call keeps first timestamp). Status unchanged.
- 403 (staff), 404, 409 `INVALID_TRANSITION` (wrong status).

## Dashboards

### `GET /api/dashboard/requester`
Role: REQUESTER. Scope `requesterId = me`.
```json
{
  "generatedAt": "ISO", "timeZone": "Asia/Bangkok",
  "metrics": [
    { "id": "RQ-M1", "label": "My Open Tickets", "value": 3, "drillDown": "/my-tickets?status=active" },
    { "id": "RQ-M2", "label": "Waiting for Me",  "value": 1, "drillDown": "/my-tickets?status=WAITING_FOR_REQUESTER" },
    { "id": "RQ-M3", "label": "Resolved",        "value": 5, "drillDown": "/my-tickets?status=RESOLVED" },
    { "id": "RQ-M4", "label": "Closed",          "value": 12, "drillDown": "/my-tickets?status=CLOSED" }
  ],
  "recentlyUpdated":  [{ "id": "uuid", "code": "TKT-2026-000123", "title": "...", "status": "IN_PROGRESS", "updatedAt": "ISO" }],
  "recentlyResolved": [ ]
}
```
403 for non-Requester roles.

### `GET /api/dashboard/staff`
Roles: IT_STAFF, ADMIN.
```json
{
  "generatedAt": "ISO", "timeZone": "Asia/Bangkok",
  "metrics": [
    { "id": "ST-M1", "label": "Unassigned",        "value": 4,  "drillDown": "/queue?owner=none&status=active" },
    { "id": "ST-M2", "label": "My Assigned",       "value": 16, "drillDown": "/queue?owner=me&status=active" },
    { "id": "ST-M5", "label": "My Open Actions",   "value": 6,  "drillDown": "/queue?actionAssignee=me" },
    { "id": "ST-M6", "label": "Follow-ups Pending","value": 2,  "drillDown": "/queue?followUp=pending" }
  ],
  "byStatus":   [{ "status": "NEW", "value": 14, "drillDown": "/queue?status=NEW" }],
  "byPriority": [{ "itPriority": "HIGH", "value": 5, "drillDown": "/queue?itPriority=HIGH&status=active" }],
  "recentlyUpdated": [ ], "urgent": [ ],
  "users": [{ "role": "IT_STAFF", "active": 6, "inactive": 1 }]
}
```
`users` present only for ADMIN. `byStatus` always contains all 8 statuses; `byPriority` all priorities (zeros included). Lists max 5 items.
403 for Requesters.

### Queue filters (extension of Lab 3 `GET /api/tickets`)
New query params to support drill-down: `owner=none|me`, `status=active|<STATUS>`, `itPriority=<P>`, `actionAssignee=me`, `followUp=pending`. Counts returned by the list for a filter must equal the dashboard metric for the same filter.

## Health

### `GET /api/health`
Public. 200 → `{ "status": "ok", "db": "ok", "version": "<git sha>" }`; 503 → `{ "status": "degraded", "db": "error" }`.

## Authorization summary

| Endpoint | Requester | IT Staff | Admin |
|---|---|---|---|
| GET actions | own Ticket | ✓ | ✓ |
| POST / PATCH / transition action | 403 | ✓ | ✓ |
| POST ticket transition | matrix "R" cells, own | matrix "S" cells | matrix "S" cells |
| GET status-history | own | ✓ | ✓ |
| POST resolution-indication | own | 403 | 403 |
| GET dashboard/requester | ✓ | 403 | 403 |
| GET dashboard/staff | 403 | ✓ | ✓ (+users) |
