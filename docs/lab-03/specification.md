# Lab 3 Engineering Specification — TokTickIT

## 1. Sprint Goal

This sprint replaces the temporary Development Requester selector with real
email/password authentication (session-based) and three roles (Requester,
IT Staff, Administrator). It delivers the first operational IT Staff workflow
(Ticket Queue, claiming, IT Priority, Public Comments, Internal Notes) along
with a minimalist Administrator user-management screen, while preserving all
Lab 2 Requester functionality.

## 2. Stakeholder Request (Interpreted)

The system must now rely on real authenticated user accounts instead of a
development selector. Administrators need a simple screen to manage accounts
(create, edit, activate/deactivate, reset password). A user signing in with
an initial password must change it before entering the application.
Requesters continue using the Lab 2 ticket functions, but their identity now
comes from the authenticated account. IT Staff need a professional Ticket
Queue to find, claim, and reassign tickets, set IT Priority, communicate
with Requesters via Public Comments, and record private Internal Notes.
Every API and screen must be protected by role and ownership — hiding a
button is not authorization.

## 3. Scope

### Included
- Session-based authentication (login/logout/current-user, server-side
  session, httpOnly cookie) + mandatory password change on first login
- Role-based authorization + server-side ownership checks
- Migration from Development Requester to real User model
- Full regression of Lab 2 Requester functions (Tickets, Attachments) under
  authenticated identity
- IT Staff: Ticket Queue (search/filter/sort/pagination), Ticket Detail,
  ownership, IT Priority, statuses, Public Comments, Internal Notes
- Minimalist Administrator user management (limited CRUD, single role,
  activation/deactivation, initial password)

### Explicitly Excluded
- Email invitations, password-reset email, MFA, SSO, self-registration
- User deletion, bulk operations, account history, multiple roles per user
- Actions Taken (deferred to Lab 4)
- SLA/escalation, KPI dashboards
- JWT/token-based auth (not needed for this single-client web app stack)

## 4. Functional Requirements

- FR-01: The system shall allow a user to authenticate with an email and password.
- FR-02: The system shall force a user flagged as "must change password" into a
  Change Password screen before any other screen is accessible.
- FR-03: The system shall provide a logout action that invalidates the session.
- FR-04: The system shall provide a current-user endpoint returning the
  authenticated user's safe profile (id, name, email, role) — never the
  password hash.
- FR-05: The system shall restrict navigation and actions shown to a user
  based on their role (Requester, IT Staff, Administrator).
- FR-06: A Requester shall create and manage only their own Tickets, identity
  taken from the authenticated session (not from client input).
- FR-07: A Requester shall be able to post Public Comments and mark a Ticket
  as "problem appears resolved" (without changing the formal status).
- FR-08: IT Staff shall view a shared Ticket Queue with search, filter, sort,
  and pagination.
- FR-09: IT Staff shall open a Ticket Detail screen, claim or reassign
  ownership, set IT Priority, and update the status within permitted
  transitions.
- FR-10: IT Staff shall post Public Comments and Internal Notes on a Ticket.
- FR-11: Internal Notes shall be visible only to IT Staff and Administrator.
- FR-12: An Administrator shall view a list of users with search (name/email)
  and optional role filter.
- FR-13: An Administrator shall create a user with name, email, one role,
  activation state, and an initial password.
- FR-14: An Administrator shall edit a user's name, email, role, and
  activation state.
- FR-15: An Administrator shall set a new initial password for a user,
  forcing a password change at next login.

## 5. Business Rules

- BR-01: Only an active user with valid credentials may authenticate.
- BR-02: A user marked as requiring a password change cannot enter the normal
  application until a new valid password is saved.
- BR-03: The authenticated user identity, not a requesterId supplied by the
  client, determines ownership of Requester operations.
- BR-04: Public Comments are visible to the Requester, IT Staff, and
  Administrator. Internal Notes are visible only to IT Staff and Administrator.
- BR-05: A Requester may indicate that the problem appears resolved, but
  cannot formally set the Ticket to Resolved or Closed.
- BR-06: Login attempts with an unknown email or wrong password return the
  same generic error ("Invalid email or password") to avoid account enumeration.
- BR-07: An inactive account cannot authenticate, even with a correct password;
  the error message must not reveal that the account exists or is inactive.
- BR-08: Passwords are never stored in plaintext; they are hashed with a slow,
  salted hashing algorithm (e.g. bcrypt).
- BR-09: Logout invalidates the server-side session; any subsequent request
  with the old session cookie is treated as unauthenticated.
- BR-10: Email addresses must be unique across all users; creating or editing
  a user with a duplicate email is rejected with a conflict error.
- BR-11: A Ticket may have zero or one primary Ticket Owner, who must be an
  active IT Staff or Administrator user.
- BR-12: Requested Priority is set once by the Requester and never changes.
  IT Priority initially copies Requested Priority and may only be changed
  afterward by IT Staff or Administrator.
- BR-13: Ticket status transitions follow a defined matrix; only permitted
  roles may perform a given transition (e.g. only IT Staff/Administrator can
  set Resolved or Closed).
- BR-14: Public Comments and Internal Notes are append-only; empty or
  whitespace-only content is rejected.
- BR-15: An Administrator cannot deactivate their own account.
- BR-16: The system must always have at least one active Administrator;
  deactivating or changing the role of the last active Administrator is
  rejected.
- BR-17: Deactivation is used instead of deletion; no user record is ever
  deleted through the Administrator UI.

## 6. UI Specification Summary

See `ui-spec.md` for full screen-by-screen detail. Screens: Login, Change
Password, authenticated App Shell, Requester Ticket Detail (updated), IT
Staff Ticket Queue, IT Staff Ticket Detail, Administrator User Management.

## 7. Data Changes

- New `User` model: id, name, email (unique), passwordHash, role (enum:
  REQUESTER / IT_STAFF / ADMINISTRATOR), isActive (boolean), mustChangePassword
  (boolean), createdAt, updatedAt.
- `Ticket.requesterId` now references `User.id` (migrated from Development
  Requester records).
- `Ticket.ownerId` (nullable) references `User.id` (IT Staff/Administrator).
- `Ticket.itPriority` (enum, same values as Requested Priority), initially
  copied from `requestedPriority`.
- New `PublicComment` model: id, ticketId, authorId, content, createdAt.
- New `InternalNote` model: id, ticketId, authorId, content, createdAt.
- Migration: existing Development Requester rows are converted into `User`
  rows with role REQUESTER and a documented seeded initial password.

## 8. API Contract

See `api-spec.md` for full endpoint list, request/response shapes, and
status codes.

## 9. Acceptance Criteria

- AC-01: Given an active user with valid credentials, when the user logs in,
  then the backend establishes an authenticated session and returns the
  user's id, name, and role.
- AC-02: Given a user who must change the initial password, when login
  succeeds, then normal application screens remain unavailable until a valid
  new password is saved.
- AC-03: Given an authenticated Requester, when the client supplies another
  requesterId, then the backend still applies the authenticated identity and
  does not return another Requester's data.
- AC-04: Given a Requester account, when an Internal Note endpoint is
  requested, then the operation is rejected (403) without exposing note
  content.
- AC-05: Given an inactive account with a correct password, when the user
  attempts login, then the backend returns the same generic error as an
  invalid password, without confirming the account exists.
- AC-06: Given an Administrator, when they attempt to deactivate their own
  account, then the operation is rejected.
- AC-07: Given the last active Administrator, when any user attempts to
  deactivate or change that account's role, then the operation is rejected.
- AC-08: Given an authenticated IT Staff user, when they claim an unassigned
  Ticket, then the Ticket's ownerId is set to that IT Staff user.
- AC-09: Given a Requester, when they attempt to set a Ticket's status to
  Resolved or Closed, then the operation is rejected.
- AC-10: Given a logged-out user, when they call any protected endpoint using
  the old session cookie, then the request is rejected as unauthenticated.

## 10. Definition of Done

- All FR/BR/AC above implemented and covered by at least one automated test.
- All Lab 2 Requester tests still pass (no regression).
- Seed data matches the required minimums (Section 5.3 of the lab sheet).
- No plaintext passwords anywhere in code, logs, or the repository.
- `.env` excluded from Git; `.env.example` committed.
- All protected endpoints tested directly (not only through the UI) for
  unauthorized-role rejection.

## 11. Assumptions and Decisions

- AD-01: Authentication uses server-side sessions with an httpOnly, secure
  (in production), sameSite cookie rather than JWT, since TokTickIT is a
  single first-party web client with no mobile app or third-party API
  consumer in scope, and easy server-side revocation on logout is preferred
  over managing JWT expiry/revocation.