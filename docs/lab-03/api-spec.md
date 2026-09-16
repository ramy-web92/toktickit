# Lab 3 API Specification — TokTickIT

Session-based authentication using an httpOnly, sameSite=lax cookie
(`connect.sid` or equivalent). No JWT. All protected endpoints require a
valid session; role and ownership are enforced server-side on every request.

## Conventions

**Status codes used consistently:**
- `200` OK / `201` Created — success
- `400` Bad Request — invalid input (validation failure)
- `401` Unauthorized — not authenticated (no/invalid session)
- `403` Forbidden — authenticated but not allowed (wrong role/ownership)
- `404` Not Found — resource doesn't exist (or hidden for privacy — see below)
- `409` Conflict — duplicate email, invalid state transition, last-admin rule
- `500` Internal Server Error — unexpected failure, no stack trace returned

**Safe error body shape:**
```json
{ "error": "INVALID_CREDENTIALS", "message": "Invalid email or password." }
```
No stack traces, no database error text, no secrets in any response body.

**Privacy rule:** when a Requester requests a Ticket/Attachment/Note they
don't own, return `403` or `404` (not "you can't see this ticket owned by
X") — never confirm existence of another user's resource.

---

## 1. Authentication

### POST /api/auth/login
- Body: `{ email, password }`
- 200: `{ id, name, email, role, mustChangePassword }` + sets session cookie
- 401: generic `INVALID_CREDENTIALS` for wrong password, unknown email, OR
  inactive account (identical response in all three cases)
- 400: missing/malformed email or password

### POST /api/auth/logout
- Requires session
- 200: session destroyed, cookie cleared
- 401 if already unauthenticated (idempotent-safe, can also just return 200)

### GET /api/auth/me
- Requires session
- 200: `{ id, name, email, role, mustChangePassword }`
- 401 if no valid session
- Never returns passwordHash or any secret

### POST /api/auth/change-password
- Requires session (works even if `mustChangePassword=true`, that's its purpose)
- Body: `{ currentPassword, newPassword }`
- 200: `{ success: true }`, `mustChangePassword` set to false
- 400: newPassword fails complexity rules, or currentPassword incorrect
- 401 if no session

---

## 2. Requester Ticket & Attachment APIs (Lab 2, now authenticated)

All routes below require an authenticated session with role REQUESTER (or
IT_STAFF/ADMINISTRATOR where noted), and filter/verify ownership using
`req.session.userId` — never a client-supplied `requesterId`.

### GET /api/tickets
- Returns only Tickets owned by the authenticated Requester
- 200: `[{ id, ticketNumber, summary, category, requestedPriority, status, createdAt, ... }]`

### POST /api/tickets
- Body: ticket fields (category, relatedSystem, summary, description, requestedPriority)
- `requesterId` is taken from session, any client-sent value is ignored
- 201: created ticket
- 400: validation errors

### GET /api/tickets/:id
- 200: full ticket detail, only if owned by the authenticated Requester
- 403/404: not owned (no distinguishing info revealed)

### PATCH /api/tickets/:id
- Existing Lab 2 editable fields, ownership-checked as above

### POST /api/tickets/:id/attachments, GET /api/tickets/:id/attachments
- Same ownership rule as above; unchanged from Lab 2 otherwise

### POST /api/tickets/:id/resolved-by-requester
- Sets a `requesterMarkedResolved` flag (does not change formal `status`)
- 200 on success; 403 if not the owning Requester

---

## 3. Public Comments

### GET /api/tickets/:id/comments
- Visible to: owning Requester, IT Staff, Administrator
- 200: `[{ id, authorId, authorName, authorRole, content, createdAt }]`

### POST /api/tickets/:id/comments
- Body: `{ content }`
- 400 if content empty/whitespace or exceeds max length (e.g. 2000 chars)
- 201: created comment
- 403 if requester doesn't own the ticket and isn't IT Staff/Admin

---

## 4. Internal Notes (IT Staff / Administrator only)

### GET /api/tickets/:id/notes
- 200 for IT Staff/Administrator only
- 403 for Requester — no note content or count leaked

### POST /api/tickets/:id/notes
- Body: `{ content }`
- 201 for IT Staff/Administrator
- 400 if empty/whitespace or too long
- 403 for Requester

---

## 5. IT Staff Ticket Queue

### GET /api/staff/tickets
- Requires role IT_STAFF or ADMINISTRATOR
- Query params:
  - `search` (matches ticket number or summary, case-insensitive)
  - `status`, `category`, `owner` (`unassigned` | `me` | a userId)
  - `sortBy` (one of: `createdAt`, `requestedPriority`, `itPriority`, `status`) + `sortDir` (`asc`|`desc`)
  - `page` (default 1), `pageSize` (default 10, max 50)
- 200: `{ data: [...], pagination: { page, pageSize, totalItems, totalPages } }`
- 400 on invalid/unrecognized query parameter values (e.g. unknown sortBy) —
  falls back to default rather than crashing, but documents the value used

### GET /api/staff/tickets/:id
- Full ticket detail for IT Staff/Administrator (no ownership restriction —
  any IT Staff can view any ticket)
- 403 for Requester role calling this endpoint
- 404 if ticket doesn't exist

### PATCH /api/staff/tickets/:id/owner
- Body: `{ ownerId }` (claim = own userId; reassign = another active IT Staff/Admin id)
- 200: updated ticket
- 400 if ownerId refers to inactive user or invalid role
- 403 for Requester

### PATCH /api/staff/tickets/:id/priority
- Body: `{ itPriority }`
- 200: updated ticket; `requestedPriority` untouched
- 403 for Requester

### PATCH /api/staff/tickets/:id/status
- Body: `{ status }`
- Validated against the transition matrix (BR-13) for the caller's role
- 200: updated ticket
- 409 if transition not permitted from current status
- 403 if role not permitted to perform this transition (e.g. Requester)

---

## 6. Administrator User Management

All routes require role ADMINISTRATOR.

### GET /api/admin/users
- Query params: `search` (name or email), `role` (optional filter)
- 200: `[{ id, name, email, role, isActive }]`
- 403 for non-Administrator

### POST /api/admin/users
- Body: `{ name, email, role, isActive, initialPassword }`
- 201: created user (`mustChangePassword` forced to true)
- 409 if email already exists
- 400 if role invalid or required fields missing

### PATCH /api/admin/users/:id
- Body: any of `{ name, email, role, isActive }`
- 200: updated user
- 409 duplicate email
- 409 if this would deactivate the last active Administrator or change their role
- 409 if `:id` is the caller's own id and `isActive: false` is requested

### POST /api/admin/users/:id/reset-password
- Body: `{ newInitialPassword }`
- 200: `{ success: true }`; sets `mustChangePassword = true` for that user
- 403 for non-Administrator

---

## 7. Safe Error Examples

```json
// 401
{ "error": "UNAUTHENTICATED", "message": "Please sign in to continue." }

// 403
{ "error": "FORBIDDEN", "message": "You do not have permission to perform this action." }

// 409 (duplicate email)
{ "error": "EMAIL_ALREADY_EXISTS", "message": "A user with this email already exists." }

// 409 (last admin)
{ "error": "LAST_ADMIN_PROTECTED", "message": "Cannot remove the last active Administrator." }
```