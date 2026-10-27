# TokTickIT — Sprint 4 UI Specification

Design language: Zen Green (Labs 2–3). Reuse existing tokens and components: `AppShell`, `NavBar`, `Card`, `Badge`, `Button`, `Tabs`, `Table`, `FormField`, `Modal`, `EmptyState`, `ErrorState`, `Skeleton`, `Toast`. No new colors or fonts.

Breakpoints: mobile < 768 px (tested at 360), tablet 768–1023 (tested at 768), desktop ≥ 1024 (tested at 1280).

## 1. Navigation

| Role | Nav items (left → right) | Landing page after login |
|---|---|---|
| Requester | Dashboard · My Tickets · Create Ticket · Profile | `/dashboard` |
| IT Staff | Dashboard · Queue · Create Ticket · Profile | `/dashboard` |
| Administrator | Dashboard · Queue · Users · Create Ticket · Profile | `/dashboard` |

Active item: underline + `aria-current="page"`. Mobile: nav collapses into a menu button (`aria-expanded`), focus trapped while open, `Esc` closes.

## 2. Requester Dashboard (`/dashboard`)

**Structure:** heading "Welcome, {firstName}" (h1) → 4 metric cards (RQ-M1..M4) → two-column area: "Recently Updated" list (left, 2/3) and "Quick Actions" (right, 1/3: Create Ticket, View My Tickets) → "Recently Resolved" list.

- Metric card = `<a>` wrapping label, value, "View all" text; accessible name "My Open Tickets: 3, view all".
- List row: Ticket code, title (truncate with ellipsis + full title in `title` attr), status badge (icon + text), relative date with absolute date tooltip.
- A row with `requesterResolvedIndicatedAt` shows a small "You marked as looks resolved" tag.
- **Responsive:** desktop 4 cards in a row; tablet 2×2; mobile 1 column, lists stacked under cards, Quick Actions above lists.
- **States:** loading = skeleton cards/rows; empty (no Tickets) = all counts 0 + EmptyState "No tickets yet" with Create Ticket button; failure = ErrorState "We couldn't load your dashboard" + Retry; 403 = redirect to own dashboard.

## 3. IT Staff Dashboard (`/dashboard`)

**Structure:** h1 "Welcome back, {firstName}" + Refresh button → metric cards row (Unassigned, My Assigned, My Open Actions, Follow-ups Pending) → "Tickets by Status" (compact table of 8 rows, each row a link) and "Tickets by IT Priority" (same) side by side → "Urgent" and "Recently Updated" lists → Quick Actions (Create Ticket, Search Tickets, My Queue).
- Admin: extra card group "Users" (active/inactive per role) linking to `/admin/users?...`.
- Refresh re-fetches; button shows spinner and `aria-busy`; last updated time shown ("Updated 10:42").
- **Responsive:** desktop 4 cards per row, status/priority tables side by side; tablet 2 per row, tables stacked; mobile 1 per row, everything stacked.
- **States:** same pattern as Requester; empty lists show "Nothing here right now" (count stays visible as 0).

## 4. Actions Taken panel (Ticket Detail)

Placed as a tab "Actions Taken (n)" next to existing "Comments" and "Internal Notes" tabs (Internal Notes tab hidden for Requesters, as in Lab 3).

**List mode (all roles)**
- Desktop/tablet: table columns — Date/Time · Description · Result · Status · Assignee · Performed by · Follow-up. Row click / Enter opens view mode.
- Mobile: one card per action (date + status badge on top, description, then labeled fields).
- Action status badges: Planned (outline, clock icon), In Progress (filled, play icon), Completed (green, check icon), Cancelled (grey, strikethrough text + x icon).
- Follow-up = "Yes" badge with note on hover/expand; "No" otherwise.
- Requester sees the list read-only with no "Add action" button.
- Empty: "No actions recorded yet." (+ "Add action" button for staff).

**Create mode (staff)**: "Add action" opens an inline form below the list (not a modal, to avoid focus traps on mobile).
| Field | Control | Rules shown inline |
|---|---|---|
| Action Date/Time | datetime-local, default now | not in future, not before Ticket creation |
| Description * | textarea, counter /2000 | required |
| Result | textarea, counter /2000 | required only to complete |
| Assignee | select of active IT Staff/Admin, default me | inactive users not listed |
| Follow-Up Required? | toggle switch with label | — |
| Follow-up Note * | textarea, shown when toggle on | required when visible |
| Attachment Notes | text input /500 | hint: "Which attachment or image to look at" |
| Performed by | read-only text "Set automatically when completed" | — |

Buttons: Save (primary, disabled + spinner while submitting), Cancel (secondary; confirms if form dirty). Client generates one Idempotency-Key per form open.

**View/Edit mode (staff)**: read-only display with "Edit", "Start", "Complete", "Cancel action" buttons per allowed transitions. Edit switches fields to inputs in place. Completed/Cancelled actions: read-only, no buttons, note "Completed actions can't be edited. Add a new action to correct."
- "Complete" opens a small inline confirm requiring Result if empty.
- "Cancel action" requires confirmation.

**Feedback**: validation errors under each field + summary at top linked to fields, focus moves to first error; success Toast "Action saved" (`role="status"`); 409 STALE_UPDATE banner "This action was changed by someone else. Your edits are kept below — review the latest version and save again." with "Show latest" button; network/5xx: banner + Retry, input preserved.

## 5. Ticket Workflow control

- Ticket header shows status badge and a "Change status" menu button listing only `allowedTransitions` from the API (labels: "Start work", "Wait for requester", "Resolve", "Close", "Reopen", "Cancel ticket").
- If none allowed, the button is not rendered (Closed/Cancelled show "This ticket is closed").
- "Resolve" disabled-with-reason when gate fails locally (e.g. "Complete all open actions first"); server error RESOLUTION_GATE shown as banner with same text.
- "Cancel ticket" opens a dialog with required reason (`role="dialog"`, labelled, focus trapped, `Esc` closes, focus returns to trigger).
- Requester on own active Ticket: existing Lab 3 "Problem appears resolved" button → after success shows "You told IT this looks resolved on {date}. IT Staff will confirm."
- On success: badge, menu, history and dashboard caches refresh; Toast "Status changed to Resolved".
- "Status history" collapsible list under the header.

## 6. Accessibility checklist (applies to all Lab 4 screens)

- [ ] Every interactive element reachable by Tab in visual order; visible focus ring (Zen Green focus token, ≥3:1 contrast).
- [ ] Status and priority conveyed by text + icon, not color alone.
- [ ] Text contrast ≥ 4.5:1; large text ≥ 3:1.
- [ ] Form fields have `<label>`; errors linked via `aria-describedby`; required fields marked in text.
- [ ] Toasts use `role="status"`; error banners use `role="alert"`.
- [ ] Dialogs: labelled, focus trapped, `Esc` closes, focus restored.
- [ ] Metric cards and list rows have meaningful accessible names.
- [ ] Headings in order (one h1 per page).
- [ ] Targets ≥ 44×44 px on mobile.
- [ ] axe-core run reports 0 serious/critical issues.

## 7. Visual and responsive checklist

- [ ] No horizontal page scroll at 360, 768, 1280 px (wide tables scroll inside their own container).
- [ ] No clipped text, overlapping controls, or truncated buttons.
- [ ] Editable vs read-only fields visually distinct (read-only: no border, muted background).
- [ ] Validation messages placed directly under their field.
- [ ] Same spacing, card style, badges and buttons as Labs 2–3.
- [ ] Private (Internal Notes) vs shared (Comments, Actions Taken) content visually distinct (lock icon + "Staff only" label on private).
- [ ] No leftover debug UI, placeholder text, duplicate or obsolete components.

## 8. Screenshots required (`artifacts/lab-04/screenshots/`)

`staff-dashboard/`, `requester-dashboard/`, `actions-taken/` — each at desktop/tablet/mobile, plus: empty state, loading, error, validation error, 409 conflict, resolution gate blocked, Requester read-only view.
