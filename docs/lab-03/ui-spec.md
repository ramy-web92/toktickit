# Lab 3 UI Specification — TokTickIT

## 1. Login Screen

**Route:** `/login`
**Modes:** default, submitting (busy), error

**Fields:**
- Email address (required, validated format)
- Password (required, masked, toggle visibility)

**Behavior:**
- On submit: disable button, show busy state ("Signing in...").
- On failure: show generic message "Invalid email or password." — same
  message whether the email doesn't exist, the password is wrong, or the
  account is inactive.
- On success: redirect based on `mustChangePassword` — if true, go to
  `/change-password`; otherwise go to the role's home screen (My Queue for
  Requester/IT Staff, Users for Administrator).

## 2. Change Password Screen (mandatory first login)

**Route:** `/change-password`
**Modes:** default, submitting, error, success

**Fields:**
- Current (temporary) password
- New password
- Confirm new password

**Validation rules (shown live as checklist):**
- At least 8 characters
- Upper and lower case letters
- At least one number and one special character
- New password and confirmation must match

**Behavior:**
- This screen cannot be bypassed by navigating directly to another URL while
  `mustChangePassword` is true (enforced by backend + route guard).
- On success: `mustChangePassword` becomes false, redirect to role home.

## 3. Authenticated App Shell

**Applies to all screens after login.**

- Top bar: TokTickIT logo, role-specific nav links, "Profile" dropdown
  (shows current user's name + role, Logout action).
- Role-specific nav:
  - Requester: My Tickets, Create Ticket
  - IT Staff: My Queue, Create Ticket (if also allowed)
  - Administrator: Users
- Logout: clears session, redirects to `/login`. Any direct access to a
  protected route afterward redirects to `/login`.

## 4. Requester Ticket Detail (updated from Lab 2)

**Route:** `/tickets/:id`
**Modes:** view, editing (existing Lab 2 fields), submitting

**New in Lab 3:**
- Public Comments section: list (author, role badge, timestamp, content) +
  "Add Public Comment" input/button.
- "Problem Appears Resolved" button/checkbox — sets a flag, does NOT change
  the formal Ticket status.
- Ownership: only the authenticated Requester who owns the Ticket can view
  or act on it (403/redirect otherwise).

## 5. IT Staff Ticket Queue

**Route:** `/queue`
**Modes:** loading, loaded, empty, no-results (after filter/search), error

**Table columns (desktop):** Ticket No., Created Date, Summary, Category,
Requested Priority (badge), IT Priority (badge), Status (badge), Owner.

**Controls:**
- Search box (ticket number or summary)
- Filters: Status, Category, Owner (unassigned/mine/all)
- Sortable columns: Created Date, Requested Priority, IT Priority, Status
- Pagination (page size ~10-20, Prev/Next + page numbers)

**Smaller screens:** collapse to stacked cards, one ticket per card, same
fields, tap to open detail.

**Feedback states:** spinner while loading; "No tickets match your filters"
for empty search results; safe error banner on API failure.

## 6. IT Staff Ticket Detail

**Route:** `/queue/tickets/:id`
**Modes:** view, editing, submitting

**Sections (tabs or accordion):**
- Ticket info (read-only: Ticket No., Category, Related System, Requester,
  Requested Priority, Summary, Description)
- Editable: Ticket Owner (claim/reassign dropdown — active IT Staff/Admin
  only), IT Priority, Status (dropdown limited to permitted transitions)
- Public Comments (tab) — visually green/neutral, shared with Requester
- Internal Notes (tab) — visually distinct (e.g. amber/yellow background,
  "Internal — IT Staff only" label) to prevent accidental public posting
- Attachments (tab, read-only continuity from Lab 2)

**Behavior:**
- Status dropdown only shows transitions valid from the current status for
  the current role (see transition matrix in specification.md BR-13).
- Claim button visible only if Ticket is unassigned; Reassign visible if
  already owned.

## 7. Administrator User Management

**Route:** `/admin/users`
**Modes:** list (default), create (side panel/modal), edit (side panel/modal)

**List view:**
- Columns: Name, Email, Role (badge), Status (Active/Inactive badge), Edit action
- Search box (name or email)
- Optional role filter dropdown

**Create User panel:**
- Full Name (required)
- Email Address (required, validated, uniqueness checked on submit)
- Role (single select: Requester / IT Staff / Administrator)
- Active toggle (default Yes)
- Initial Password (required, same complexity rules as Change Password)

**Edit User panel:**
- Same fields as create, except password is replaced by a "Set New Initial
  Password" action (separate button, requires confirmation) which forces
  `mustChangePassword = true` for that user.
- Deactivate/Activate toggle.
- If editing the last active Administrator: role/active controls show a
  disabled state with a tooltip ("Cannot remove the last active
  Administrator").
- If editing own account: Deactivate action is disabled with a tooltip
  ("You cannot deactivate your own account").

**Feedback:** validation errors inline per field; success toast on save;
conflict error banner for duplicate email; generic error banner for
unexpected API failures.

## 8. Shared Feedback Conventions (reuse Zen Green tokens from Lab 2)

- Loading: spinner + skeleton rows where applicable
- Empty: friendly message + icon, no table borders on empty state
- Validation: red border + inline message under field
- Success: green toast, auto-dismiss
- Forbidden (403): redirect to a "Not authorized" page or inline banner,
  never a blank screen
- Not found (404): "Ticket not found" / "User not found" message with a
  back link

## 9. Responsive Rules

Same breakpoints and rules as Lab 2 (desktop/tablet/mobile). Tables convert
to stacked cards below tablet width; forms remain single-column on mobile.